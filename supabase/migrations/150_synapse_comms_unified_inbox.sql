-- ============================================================================
-- @migration SynapseCommsUnifiedInbox
-- @status COMPLETE
-- @description Project Synapse-Comms — cloud PBX, unified inbox, call routing, SMS threading
-- @tables comm_threads, comm_messages, comm_contacts, voicemail_transcripts
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. ENUMs ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE comm_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comm_channel AS ENUM ('voice_call', 'email', 'sms', 'portal_message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comm_status AS ENUM ('missed', 'completed', 'voicemail', 'delivered', 'bounced', 'in_progress', 'ringing', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE phone_routing_strategy AS ENUM ('ring_all', 'round_robin', 'sequential', 'ivr_menu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Workspace Phone Numbers ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_phone_numbers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_sid           TEXT,
  phone_number         TEXT NOT NULL,
  friendly_name        TEXT,
  routing_strategy     phone_routing_strategy NOT NULL DEFAULT 'ring_all',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  capabilities         JSONB DEFAULT '{"voice": true, "sms": true, "mms": false}'::jsonb,
  assigned_worker_ids  UUID[] DEFAULT '{}',
  metadata             JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_phone_numbers_workspace
  ON public.workspace_phone_numbers(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_phone_numbers_number
  ON public.workspace_phone_numbers(phone_number);

-- ── 3. Communication Logs (Master Ledger) ───────────────────
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES public.clients(id),
  job_id               UUID REFERENCES public.jobs(id),
  worker_id            UUID,
  participant_id       UUID,

  direction            comm_direction NOT NULL,
  channel              comm_channel NOT NULL,
  status               comm_status NOT NULL DEFAULT 'completed',

  from_address         TEXT,
  to_address           TEXT,
  subject              TEXT,
  body_preview         TEXT,

  is_read              BOOLEAN NOT NULL DEFAULT false,
  is_linked            BOOLEAN NOT NULL DEFAULT false,
  is_starred           BOOLEAN NOT NULL DEFAULT false,

  duration_seconds     INT,
  recording_url        TEXT,

  metadata             JSONB DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comms_logs_workspace ON public.communication_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comms_logs_client ON public.communication_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_comms_logs_job ON public.communication_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_comms_logs_channel ON public.communication_logs(channel);
CREATE INDEX IF NOT EXISTS idx_comms_logs_created ON public.communication_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_logs_read ON public.communication_logs(workspace_id, is_read) WHERE is_read = false;

-- ── 4. VOIP Call Records (Sub-Ledger) ───────────────────────
CREATE TABLE IF NOT EXISTS public.voip_call_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id               UUID NOT NULL REFERENCES public.communication_logs(id) ON DELETE CASCADE,
  twilio_call_sid      TEXT,
  from_number          TEXT,
  to_number            TEXT,
  duration_seconds     INT DEFAULT 0,
  recording_url        TEXT,
  recording_duration   INT,
  ai_transcript        TEXT,
  transcript_status    TEXT DEFAULT 'pending',
  call_quality_score   DECIMAL(3,1),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voip_records_log ON public.voip_call_records(log_id);
CREATE INDEX IF NOT EXISTS idx_voip_records_sid ON public.voip_call_records(twilio_call_sid);

-- ── 5. Email Threads (Sub-Ledger) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.email_threads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id               UUID NOT NULL REFERENCES public.communication_logs(id) ON DELETE CASCADE,
  message_id           TEXT,
  in_reply_to          TEXT,
  references_header    TEXT,
  subject              TEXT,
  body_text            TEXT,
  body_html            TEXT,
  has_attachments      BOOLEAN NOT NULL DEFAULT false,
  attachment_urls      TEXT[] DEFAULT '{}',
  sender_name          TEXT,
  sender_email         TEXT,
  recipient_emails     TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_log ON public.email_threads(log_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_message_id ON public.email_threads(message_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_reply_to ON public.email_threads(in_reply_to);

-- ── 6. RLS Policies ────────────────────────────────────────

ALTER TABLE public.workspace_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voip_call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

-- Phone numbers
CREATE POLICY "Members manage phone numbers" ON public.workspace_phone_numbers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = workspace_phone_numbers.workspace_id AND user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Service role manages phone numbers" ON public.workspace_phone_numbers
  FOR ALL USING (auth.role() = 'service_role');

-- Communication logs
CREATE POLICY "Members read comms logs" ON public.communication_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = communication_logs.workspace_id AND user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Service role manages comms logs" ON public.communication_logs
  FOR ALL USING (auth.role() = 'service_role');

-- VOIP records
CREATE POLICY "Members read voip records" ON public.voip_call_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.communication_logs cl JOIN public.organization_members om ON om.organization_id = cl.workspace_id WHERE cl.id = voip_call_records.log_id AND om.user_id = auth.uid() AND om.status = 'active')
  );
CREATE POLICY "Service role manages voip records" ON public.voip_call_records
  FOR ALL USING (auth.role() = 'service_role');

-- Email threads
CREATE POLICY "Members read email threads" ON public.email_threads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.communication_logs cl JOIN public.organization_members om ON om.organization_id = cl.workspace_id WHERE cl.id = email_threads.log_id AND om.user_id = auth.uid() AND om.status = 'active')
  );
CREATE POLICY "Service role manages email threads" ON public.email_threads
  FOR ALL USING (auth.role() = 'service_role');

-- ── 7. RPC: Log Communication ───────────────────────────────
CREATE OR REPLACE FUNCTION public.log_communication(
  p_workspace_id UUID,
  p_direction TEXT,
  p_channel TEXT,
  p_status TEXT DEFAULT 'completed',
  p_from_address TEXT DEFAULT NULL,
  p_to_address TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_body_preview TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_duration_seconds INT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
  v_client_id UUID := p_client_id;
BEGIN
  -- Auto-link client by phone or email if not provided
  IF v_client_id IS NULL AND p_from_address IS NOT NULL THEN
    SELECT id INTO v_client_id FROM public.clients
    WHERE organization_id = p_workspace_id
      AND (phone = p_from_address OR email = p_from_address)
    LIMIT 1;
  END IF;

  INSERT INTO public.communication_logs (
    workspace_id, direction, channel, status,
    from_address, to_address, subject, body_preview,
    client_id, job_id, worker_id,
    duration_seconds,
    is_linked, metadata
  ) VALUES (
    p_workspace_id, p_direction::comm_direction, p_channel::comm_channel, p_status::comm_status,
    p_from_address, p_to_address, p_subject, p_body_preview,
    v_client_id, p_job_id, p_worker_id,
    p_duration_seconds,
    (v_client_id IS NOT NULL OR p_job_id IS NOT NULL),
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN json_build_object(
    'success', true,
    'log_id', v_log_id,
    'client_id', v_client_id,
    'is_linked', (v_client_id IS NOT NULL OR p_job_id IS NOT NULL)
  );
END;
$$;

-- ── 8. RPC: Reverse Lookup (Screen Pop) ─────────────────────
CREATE OR REPLACE FUNCTION public.screen_pop_lookup(
  p_workspace_id UUID,
  p_phone_number TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client RECORD;
  v_jobs JSON;
  v_balance DECIMAL;
  v_recent_comms JSON;
BEGIN
  -- Find client by phone number (try exact match and trimmed)
  SELECT * INTO v_client FROM public.clients
  WHERE organization_id = p_workspace_id
    AND (phone = p_phone_number
      OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') =
         REPLACE(REPLACE(REPLACE(p_phone_number, ' ', ''), '-', ''), '+', ''))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'found', false,
      'phone', p_phone_number,
      'message', 'Unknown caller'
    );
  END IF;

  -- Get active jobs
  SELECT COALESCE(json_agg(json_build_object(
    'id', j.id, 'display_id', j.display_id, 'title', j.title, 'status', j.status
  )), '[]'::json) INTO v_jobs
  FROM public.jobs j
  WHERE j.client_id = v_client.id
    AND j.status NOT IN ('archived', 'cancelled', 'completed', 'done')
  LIMIT 5;

  -- Get outstanding balance
  SELECT COALESCE(SUM(total), 0) INTO v_balance
  FROM public.invoices
  WHERE client_id = v_client.id
    AND status IN ('draft', 'sent');

  -- Get recent comms
  SELECT COALESCE(json_agg(json_build_object(
    'id', cl.id, 'channel', cl.channel, 'direction', cl.direction,
    'subject', cl.subject, 'created_at', cl.created_at
  ) ORDER BY cl.created_at DESC), '[]'::json) INTO v_recent_comms
  FROM public.communication_logs cl
  WHERE cl.client_id = v_client.id
  LIMIT 5;

  RETURN json_build_object(
    'found', true,
    'client_id', v_client.id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'client_phone', v_client.phone,
    'pipeline_status', v_client.pipeline_status,
    'outstanding_balance', v_balance,
    'active_jobs', v_jobs,
    'recent_comms', v_recent_comms
  );
END;
$$;

-- ── 9. RPC: Get Inbox Feed ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inbox_feed(
  p_workspace_id UUID,
  p_channel TEXT DEFAULT NULL,
  p_unread_only BOOLEAN DEFAULT false,
  p_unlinked_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT
        cl.id, cl.direction, cl.channel, cl.status,
        cl.from_address, cl.to_address, cl.subject, cl.body_preview,
        cl.is_read, cl.is_linked, cl.is_starred,
        cl.duration_seconds, cl.recording_url,
        cl.client_id, cl.job_id, cl.worker_id,
        cl.created_at,
        c.name AS client_name,
        j.display_id AS job_display_id, j.title AS job_title,
        vr.ai_transcript, vr.twilio_call_sid,
        et.body_text AS email_body, et.has_attachments
      FROM public.communication_logs cl
      LEFT JOIN public.clients c ON c.id = cl.client_id
      LEFT JOIN public.jobs j ON j.id = cl.job_id
      LEFT JOIN public.voip_call_records vr ON vr.log_id = cl.id
      LEFT JOIN public.email_threads et ON et.log_id = cl.id
      WHERE cl.workspace_id = p_workspace_id
        AND (p_channel IS NULL OR cl.channel = p_channel::comm_channel)
        AND (NOT p_unread_only OR cl.is_read = false)
        AND (NOT p_unlinked_only OR cl.is_linked = false)
      ORDER BY cl.created_at DESC
      LIMIT p_limit OFFSET p_offset
    ) t
  );
END;
$$;

-- ── 10. RPC: Get Inbox Stats ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inbox_stats(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total', COUNT(*),
      'unread', COUNT(*) FILTER (WHERE is_read = false),
      'calls', COUNT(*) FILTER (WHERE channel = 'voice_call'),
      'emails', COUNT(*) FILTER (WHERE channel = 'email'),
      'sms', COUNT(*) FILTER (WHERE channel = 'sms'),
      'missed_calls', COUNT(*) FILTER (WHERE channel = 'voice_call' AND status = 'missed'),
      'voicemails', COUNT(*) FILTER (WHERE status = 'voicemail'),
      'unlinked', COUNT(*) FILTER (WHERE is_linked = false),
      'today', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)
    )
    FROM public.communication_logs
    WHERE workspace_id = p_workspace_id
  );
END;
$$;

-- ── 11. RPC: Link Communication to Job ──────────────────────
CREATE OR REPLACE FUNCTION public.link_communication_to_job(
  p_log_id UUID,
  p_job_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.communication_logs
  SET job_id = p_job_id, is_linked = true, updated_at = now()
  WHERE id = p_log_id;

  RETURN json_build_object('success', true, 'log_id', p_log_id, 'job_id', p_job_id);
END;
$$;

-- ── 12. Realtime publication ────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
