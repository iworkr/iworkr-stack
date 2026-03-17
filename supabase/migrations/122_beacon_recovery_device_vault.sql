-- ============================================================
-- Migration 122: Project Beacon-Recovery — Device Vault
-- FCM device registry hardening + RLS + upsert RPC
-- ============================================================

-- ── Extend existing user_devices table ────────────────────
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure UNIQUE constraint on fcm_token for upsert idempotency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_fcm_token_key'
  ) THEN
    ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_fcm_token_key UNIQUE (fcm_token);
  END IF;
END $$;

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
CREATE POLICY "Users can view their own devices" ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own devices" ON public.user_devices;
CREATE POLICY "Users can insert their own devices" ON public.user_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own devices" ON public.user_devices;
CREATE POLICY "Users can update their own devices" ON public.user_devices
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;
CREATE POLICY "Users can delete their own devices" ON public.user_devices
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for edge functions (dead-token pruning)
DROP POLICY IF EXISTS "Service role full access" ON public.user_devices;
CREATE POLICY "Service role full access" ON public.user_devices
  USING (auth.role() = 'service_role');

-- ── upsert_device_token RPC ────────────────────────────────
-- Idempotent: Insert new token OR update last_active_at on conflict.
-- Handles edge case of device changing hands by updating user_id.
-- Called by Flutter client after FCM token generation / rotation.
CREATE OR REPLACE FUNCTION public.upsert_device_token(
  p_fcm_token  TEXT,
  p_platform   TEXT,
  p_device_model TEXT DEFAULT NULL,
  p_app_version  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_devices (
    user_id, fcm_token, device_type, device_name,
    app_version, is_active, last_active_at, last_refreshed_at, created_at
  )
  VALUES (
    auth.uid(), p_fcm_token, p_platform, p_device_model,
    p_app_version, true, NOW(), NOW(), NOW()
  )
  ON CONFLICT (fcm_token)
  DO UPDATE SET
    user_id         = auth.uid(),
    device_type     = p_platform,
    device_name     = COALESCE(p_device_model, user_devices.device_name),
    app_version     = COALESCE(p_app_version,  user_devices.app_version),
    is_active       = true,
    last_active_at  = NOW(),
    last_refreshed_at = NOW();
END;
$$;

-- ── delete_dead_device_token RPC ───────────────────────────
-- Called by dispatch-outbound Edge Function when Firebase responds
-- with messaging/registration-token-not-registered.
CREATE OR REPLACE FUNCTION public.delete_dead_device_token(p_fcm_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_devices WHERE fcm_token = p_fcm_token;
END;
$$;
