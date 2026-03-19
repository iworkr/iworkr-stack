-- ============================================================
-- Migration 062: Project Beacon — Outbound Communications Engine
-- SAFE: All statements idempotent with existence checks.
-- ============================================================

-- 1. outbound_queue table
CREATE TABLE IF NOT EXISTS public.outbound_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  priority INT DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  recipient_address TEXT NOT NULL,
  payload_subject VARCHAR(255),
  payload_body TEXT NOT NULL,
  payload_metadata JSONB DEFAULT '{}',
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','bounced','opted_out')),
  provider_message_id TEXT,
  cost_microcents INT DEFAULT 0,
  retry_count INT DEFAULT 0,
  execute_after TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outbound_queue_hot ON public.outbound_queue (status, execute_after) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_outbound_queue_org ON public.outbound_queue (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_user ON public.outbound_queue (user_id);

-- RLS
ALTER TABLE public.outbound_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outbound_queue_select_org_member') THEN
    CREATE POLICY outbound_queue_select_org_member ON public.outbound_queue FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = outbound_queue.organization_id AND user_id = auth.uid() AND status = 'active')
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. workspace_communication_settings table
CREATE TABLE IF NOT EXISTS public.workspace_communication_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN DEFAULT false,
  sms_roster_published BOOLEAN DEFAULT false,
  sms_shift_modified_urgent BOOLEAN DEFAULT true,
  sms_shift_modified_standard BOOLEAN DEFAULT false,
  sms_announcements BOOLEAN DEFAULT false,
  sms_payslips BOOLEAN DEFAULT false,
  email_roster_published BOOLEAN DEFAULT true,
  email_shift_modified BOOLEAN DEFAULT true,
  email_announcements BOOLEAN DEFAULT true,
  email_payslips BOOLEAN DEFAULT true,
  push_always_on BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '06:00',
  quiet_hours_override_urgent BOOLEAN DEFAULT true,
  twilio_sender_id VARCHAR(11) DEFAULT 'iWorkr',
  estimated_monthly_sms_cost_microcents INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ws_comm_settings_org_unique UNIQUE (organization_id)
);

ALTER TABLE public.workspace_communication_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ws_comm_settings_select_member') THEN
    CREATE POLICY ws_comm_settings_select_member ON public.workspace_communication_settings FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = workspace_communication_settings.organization_id AND user_id = auth.uid() AND status = 'active')
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ws_comm_settings_manage_admin') THEN
    CREATE POLICY ws_comm_settings_manage_admin ON public.workspace_communication_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = workspace_communication_settings.organization_id AND user_id = auth.uid() AND role IN ('owner','admin','manager') AND status = 'active')
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Extend user_notification_preferences
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT false;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS email_roster BOOLEAN DEFAULT true;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS email_shifts BOOLEAN DEFAULT true;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS email_announcements BOOLEAN DEFAULT true;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS email_payslips BOOLEAN DEFAULT true;
ALTER TABLE public.user_notification_preferences ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(10) DEFAULT 'push';

-- 4. Extend profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;

-- 5. enqueue_outbound function
CREATE OR REPLACE FUNCTION public.enqueue_outbound(
  p_org_id UUID,
  p_user_id UUID,
  p_channel VARCHAR(10),
  p_event_type VARCHAR(50),
  p_subject VARCHAR(255),
  p_body TEXT,
  p_priority INT DEFAULT 2,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ws RECORD;
  v_prefs RECORD;
  v_profile RECORD;
  v_address TEXT;
  v_queue_id UUID;
BEGIN
  -- Check workspace settings
  SELECT * INTO v_ws FROM public.workspace_communication_settings WHERE organization_id = p_org_id;
  IF NOT FOUND THEN
    -- No settings = use defaults (push only)
    IF p_channel != 'push' THEN
      RETURN jsonb_build_object('queued', false, 'reason', 'no_workspace_settings');
    END IF;
  END IF;

  -- SMS master switch
  IF p_channel = 'sms' AND (v_ws IS NULL OR v_ws.sms_enabled = false) THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'sms_disabled_workspace');
  END IF;

  -- Check user prefs
  SELECT * INTO v_prefs FROM public.user_notification_preferences WHERE user_id = p_user_id;
  IF FOUND AND p_channel = 'sms' AND (v_prefs.sms_enabled = false OR v_prefs.sms_opt_out = true) THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'sms_disabled_user');
  END IF;

  -- Check profile sms opt-out
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF p_channel = 'sms' AND v_profile.sms_opt_out = true THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'sms_opted_out');
  END IF;

  -- Resolve recipient address
  IF p_channel = 'sms' THEN
    v_address := v_profile.phone;
    IF v_address IS NULL OR v_address = '' THEN
      RETURN jsonb_build_object('queued', false, 'reason', 'no_phone_number');
    END IF;
  ELSIF p_channel = 'email' THEN
    v_address := v_profile.email;
    IF v_address IS NULL OR v_address = '' THEN
      RETURN jsonb_build_object('queued', false, 'reason', 'no_email');
    END IF;
  ELSE
    v_address := p_user_id::text; -- push uses user_id
  END IF;

  -- Insert into queue
  INSERT INTO public.outbound_queue (organization_id, user_id, channel, event_type, priority, recipient_address, payload_subject, payload_body, payload_metadata)
  VALUES (p_org_id, p_user_id, p_channel, p_event_type, p_priority, v_address, p_subject, p_body, p_metadata)
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object('queued', true, 'queue_id', v_queue_id);
END;
$$;

-- 6. process_outbound_batch function
CREATE OR REPLACE FUNCTION public.process_outbound_batch(p_batch_size INT DEFAULT 50)
RETURNS SETOF public.outbound_queue LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.outbound_queue
    WHERE status = 'pending' AND execute_after <= NOW()
    ORDER BY priority ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outbound_queue q
  SET status = 'processing'
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;
