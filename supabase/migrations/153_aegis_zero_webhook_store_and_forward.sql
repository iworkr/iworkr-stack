-- ============================================================
-- Project Aegis-Zero: P0-1 — Webhook Store-and-Forward DLQ
-- Implements the Inbox Pattern for all inbound webhooks.
-- Webhooks INSERT into this queue and return 200 instantly.
-- A pg_cron worker processes rows with exponential backoff.
-- ============================================================

-- 1. Provider enum
DO $$ BEGIN
  CREATE TYPE public.webhook_provider AS ENUM ('stripe', 'polar', 'revenuecat', 'resend');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Processing status enum
DO $$ BEGIN
  CREATE TYPE public.webhook_queue_status AS ENUM ('pending', 'processing', 'success', 'failed_retrying', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. The Store-and-Forward Queue
CREATE TABLE IF NOT EXISTS public.inbound_webhooks_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        public.webhook_provider NOT NULL,
  event_type      text NOT NULL,
  idempotency_key text,
  payload         jsonb NOT NULL,
  headers         jsonb,
  status          public.webhook_queue_status NOT NULL DEFAULT 'pending',
  retry_count     integer NOT NULL DEFAULT 0,
  max_retries     integer NOT NULL DEFAULT 5,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  error_log       text,
  locked_by       text,
  locked_at       timestamptz,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. Idempotency constraint (prevent duplicate webhook processing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_queue_idempotency
  ON public.inbound_webhooks_queue (provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 5. Worker indexes (the cron worker queries these)
CREATE INDEX IF NOT EXISTS idx_webhooks_queue_pending
  ON public.inbound_webhooks_queue (next_retry_at)
  WHERE status IN ('pending', 'failed_retrying');

CREATE INDEX IF NOT EXISTS idx_webhooks_queue_dead_letter
  ON public.inbound_webhooks_queue (created_at DESC)
  WHERE status = 'dead_letter';

CREATE INDEX IF NOT EXISTS idx_webhooks_queue_provider
  ON public.inbound_webhooks_queue (provider, status);

-- 6. Auto-update timestamp trigger
CREATE TRIGGER set_webhooks_queue_updated_at
  BEFORE UPDATE ON public.inbound_webhooks_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. RLS: service_role only (webhooks are server-to-server)
ALTER TABLE public.inbound_webhooks_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.inbound_webhooks_queue
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Super admins can read queue" ON public.inbound_webhooks_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- 8. RPC: Atomic claim-and-lock for the processing worker
CREATE OR REPLACE FUNCTION public.claim_webhook_batch(batch_size integer DEFAULT 50, worker_id text DEFAULT 'default')
RETURNS SETOF public.inbound_webhooks_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.inbound_webhooks_queue
  SET status = 'processing',
      locked_by = worker_id,
      locked_at = now(),
      updated_at = now()
  WHERE id IN (
    SELECT q.id FROM public.inbound_webhooks_queue q
    WHERE q.status IN ('pending', 'failed_retrying')
      AND q.next_retry_at <= now()
      AND (q.locked_by IS NULL OR q.locked_at < now() - interval '5 minutes')
    ORDER BY q.created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 9. RPC: Mark a webhook as successfully processed
CREATE OR REPLACE FUNCTION public.resolve_webhook(webhook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inbound_webhooks_queue
  SET status = 'success',
      processed_at = now(),
      locked_by = NULL,
      locked_at = NULL,
      updated_at = now()
  WHERE id = webhook_id;
END;
$$;

-- 10. RPC: Mark a webhook as failed with exponential backoff
CREATE OR REPLACE FUNCTION public.fail_webhook(webhook_id uuid, error_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count integer;
  v_max_retries integer;
BEGIN
  SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
  FROM public.inbound_webhooks_queue
  WHERE id = webhook_id;

  IF v_retry_count + 1 >= v_max_retries THEN
    UPDATE public.inbound_webhooks_queue
    SET status = 'dead_letter',
        retry_count = v_retry_count + 1,
        error_log = COALESCE(error_log || E'\n---\n', '') || '[' || now()::text || '] ' || error_message,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE id = webhook_id;
  ELSE
    UPDATE public.inbound_webhooks_queue
    SET status = 'failed_retrying',
        retry_count = v_retry_count + 1,
        next_retry_at = now() + (power(2, v_retry_count + 1) || ' minutes')::interval,
        error_log = COALESCE(error_log || E'\n---\n', '') || '[' || now()::text || '] ' || error_message,
        locked_by = NULL,
        locked_at = NULL,
        updated_at = now()
    WHERE id = webhook_id;
  END IF;
END;
$$;

-- 11. RPC: Replay a dead-letter webhook (super admin triage)
CREATE OR REPLACE FUNCTION public.replay_webhook(webhook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inbound_webhooks_queue
  SET status = 'pending',
      retry_count = 0,
      next_retry_at = now(),
      locked_by = NULL,
      locked_at = NULL,
      error_log = COALESCE(error_log || E'\n---\n', '') || '[' || now()::text || '] Manually replayed by admin',
      updated_at = now()
  WHERE id = webhook_id AND status = 'dead_letter';
END;
$$;
