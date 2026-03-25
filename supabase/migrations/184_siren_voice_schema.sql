-- ============================================================================
-- @migration SirenVoiceSchema
-- @status COMPLETE
-- @description Project Siren-Voice — AI Receptionist, enhanced CTI, live transcription,
--              post-call summarization, and autonomous voice agent with database mutations
-- @tables ai_call_actions (new), workspace_phone_numbers (altered), voip_call_records (altered)
-- @lastAudit 2026-03-24
-- ============================================================================

-- ── 1. Extend comm_status ENUM with AI_HANDLED ──────────────────────────
DO $$ BEGIN
  ALTER TYPE comm_status ADD VALUE IF NOT EXISTS 'ai_handled';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Extend phone_routing_strategy ENUM ───────────────────────────────
DO $$ BEGIN
  ALTER TYPE phone_routing_strategy ADD VALUE IF NOT EXISTS 'human_then_ai';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE phone_routing_strategy ADD VALUE IF NOT EXISTS 'ai_first';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE phone_routing_strategy ADD VALUE IF NOT EXISTS 'ai_only';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Extend workspace_phone_numbers ───────────────────────────────────
ALTER TABLE public.workspace_phone_numbers
  ADD COLUMN IF NOT EXISTS forwarding_number TEXT,
  ADD COLUMN IF NOT EXISTS ai_prompt_context TEXT,
  ADD COLUMN IF NOT EXISTS ai_voice_id TEXT DEFAULT 'alloy',
  ADD COLUMN IF NOT EXISTS ai_timeout_seconds INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"timezone":"Australia/Sydney","mon":{"open":"08:00","close":"17:00"},"tue":{"open":"08:00","close":"17:00"},"wed":{"open":"08:00","close":"17:00"},"thu":{"open":"08:00","close":"17:00"},"fri":{"open":"08:00","close":"17:00"}}'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_number TEXT;

-- ── 4. Extend voip_call_records with AI + transcription fields ──────────
ALTER TABLE public.voip_call_records
  ADD COLUMN IF NOT EXISTS transcript_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_handled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_agent_session_id TEXT,
  ADD COLUMN IF NOT EXISTS ai_actions_taken JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS caller_intent TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── 5. AI Call Actions Audit Table ──────────────────────────────────────
-- Immutable audit trail for every mutation the AI voice agent executes
CREATE TABLE IF NOT EXISTS public.ai_call_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_record_id  UUID REFERENCES public.voip_call_records(id) ON DELETE SET NULL,
  log_id          UUID REFERENCES public.communication_logs(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,

  action_type     TEXT NOT NULL,
  action_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_result   JSONB DEFAULT '{}'::jsonb,
  success         BOOLEAN DEFAULT false,

  caller_phone    TEXT,
  caller_intent   TEXT,
  ai_confidence   DECIMAL(3,2),
  ai_model_used   TEXT DEFAULT 'gpt-4o-realtime',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_actions_workspace
  ON public.ai_call_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_actions_call_record
  ON public.ai_call_actions(call_record_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_actions_type
  ON public.ai_call_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_call_actions_created
  ON public.ai_call_actions(workspace_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_call_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ai call actions" ON public.ai_call_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = ai_call_actions.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Service role manages ai call actions" ON public.ai_call_actions
  FOR ALL USING (auth.role() = 'service_role');

-- ── 6. RPC: AI Reschedule Job ───────────────────────────────────────────
-- Constrained mutation — the AI can only reschedule, not delete or alter pricing
CREATE OR REPLACE FUNCTION public.ai_reschedule_job(
  p_workspace_id UUID,
  p_job_id UUID,
  p_new_datetime TEXT,
  p_call_record_id UUID DEFAULT NULL,
  p_caller_phone TEXT DEFAULT NULL,
  p_ai_confidence DECIMAL DEFAULT 0.9
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_block RECORD;
  v_new_start TIMESTAMPTZ;
  v_duration_ms BIGINT;
  v_new_end TIMESTAMPTZ;
  v_action_id UUID;
BEGIN
  -- Validate job exists and belongs to workspace
  SELECT id, title, client_id, status, organization_id
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND organization_id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Prevent rescheduling completed/cancelled jobs
  IF v_job.status IN ('completed', 'done', 'cancelled', 'archived') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reschedule a ' || v_job.status || ' job');
  END IF;

  -- Parse the new datetime
  BEGIN
    v_new_start := p_new_datetime::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Invalid datetime format');
  END;

  -- Prevent scheduling in the past
  IF v_new_start < now() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot schedule in the past');
  END IF;

  -- Find the existing schedule block
  SELECT id, start_time, end_time
  INTO v_block
  FROM public.schedule_blocks
  WHERE job_id = p_job_id
    AND organization_id = p_workspace_id
    AND status != 'cancelled'
  ORDER BY start_time ASC
  LIMIT 1;

  IF FOUND THEN
    v_duration_ms := EXTRACT(EPOCH FROM (v_block.end_time - v_block.start_time)) * 1000;
    IF v_duration_ms <= 0 THEN v_duration_ms := 3600000; END IF;
    v_new_end := v_new_start + (v_duration_ms || ' milliseconds')::interval;

    UPDATE public.schedule_blocks
    SET start_time = v_new_start,
        end_time = v_new_end,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'ai_rescheduled', true,
          'previous_start', v_block.start_time,
          'rescheduled_at', now(),
          'rescheduled_by', 'siren_voice_agent'
        ),
        updated_at = now()
    WHERE id = v_block.id;
  END IF;

  -- Update the job's scheduled_start if column exists
  UPDATE public.jobs
  SET scheduled_start = v_new_start,
      updated_at = now()
  WHERE id = p_job_id;

  -- Audit trail
  INSERT INTO public.ai_call_actions (
    workspace_id, call_record_id, client_id,
    action_type, action_payload, action_result, success,
    caller_phone, caller_intent, ai_confidence
  ) VALUES (
    p_workspace_id, p_call_record_id, v_job.client_id,
    'reschedule_job',
    jsonb_build_object('job_id', p_job_id, 'new_datetime', p_new_datetime, 'job_title', v_job.title),
    jsonb_build_object('new_start', v_new_start, 'new_end', v_new_end, 'block_updated', FOUND),
    true,
    p_caller_phone, 'reschedule',
    p_ai_confidence
  ) RETURNING id INTO v_action_id;

  RETURN json_build_object(
    'success', true,
    'action_id', v_action_id,
    'job_title', v_job.title,
    'new_start', v_new_start,
    'new_end', v_new_end
  );
END;
$$;

-- ── 7. RPC: AI Save Message ─────────────────────────────────────────────
-- When the AI can't resolve the issue, it saves a message for follow-up
CREATE OR REPLACE FUNCTION public.ai_save_message(
  p_workspace_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_caller_phone TEXT DEFAULT NULL,
  p_urgency TEXT DEFAULT 'normal',
  p_summary TEXT DEFAULT '',
  p_full_context TEXT DEFAULT '',
  p_call_record_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notification_id UUID;
  v_action_id UUID;
BEGIN
  -- Create a notification for the workspace
  INSERT INTO public.notifications (
    user_id,
    organization_id,
    title,
    body,
    type,
    priority,
    metadata
  )
  SELECT
    om.user_id,
    p_workspace_id,
    CASE p_urgency
      WHEN 'critical' THEN '🚨 URGENT: AI Receptionist Message'
      WHEN 'high' THEN '⚡ Priority: AI Receptionist Message'
      ELSE '📞 AI Receptionist Message'
    END,
    p_summary,
    'system',
    CASE p_urgency
      WHEN 'critical' THEN 'urgent'
      WHEN 'high' THEN 'high'
      ELSE 'normal'
    END,
    jsonb_build_object(
      'source', 'siren_voice',
      'caller_phone', p_caller_phone,
      'client_id', p_client_id,
      'urgency', p_urgency,
      'full_context', p_full_context,
      'call_record_id', p_call_record_id
    )
  FROM public.organization_members om
  WHERE om.organization_id = p_workspace_id
    AND om.status = 'active'
    AND om.role IN ('owner', 'admin', 'manager')
  RETURNING id INTO v_notification_id;

  -- Audit trail
  INSERT INTO public.ai_call_actions (
    workspace_id, call_record_id, client_id,
    action_type, action_payload, action_result, success,
    caller_phone, caller_intent, ai_confidence
  ) VALUES (
    p_workspace_id, p_call_record_id, p_client_id,
    'save_message',
    jsonb_build_object('summary', p_summary, 'urgency', p_urgency, 'full_context', p_full_context),
    jsonb_build_object('notification_id', v_notification_id),
    true,
    p_caller_phone, 'leave_message',
    0.95
  ) RETURNING id INTO v_action_id;

  RETURN json_build_object(
    'success', true,
    'action_id', v_action_id,
    'notification_id', v_notification_id,
    'message', 'Message saved and dispatched to managers'
  );
END;
$$;

-- ── 8. RPC: AI Create Lead ──────────────────────────────────────────────
-- When an unknown caller provides their details to the AI
CREATE OR REPLACE FUNCTION public.ai_create_lead(
  p_workspace_id UUID,
  p_caller_phone TEXT,
  p_caller_name TEXT DEFAULT 'Unknown',
  p_caller_email TEXT DEFAULT NULL,
  p_intent TEXT DEFAULT '',
  p_notes TEXT DEFAULT '',
  p_call_record_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_job_id UUID;
  v_action_id UUID;
BEGIN
  -- Check if client already exists by phone
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE organization_id = p_workspace_id
    AND (phone = p_caller_phone
      OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') =
         REPLACE(REPLACE(REPLACE(p_caller_phone, ' ', ''), '-', ''), '+', ''))
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.clients (
      organization_id, name, phone, email, status, type, notes, tags, metadata
    ) VALUES (
      p_workspace_id,
      p_caller_name,
      p_caller_phone,
      p_caller_email,
      'lead',
      'residential',
      COALESCE(p_notes, 'Lead created by AI Receptionist on ' || to_char(now(), 'YYYY-MM-DD')),
      ARRAY['ai-lead', 'phone-lead'],
      jsonb_build_object(
        'source', 'siren_voice_agent',
        'caller_intent', p_intent,
        'call_record_id', p_call_record_id
      )
    ) RETURNING id INTO v_client_id;

    -- Create initial job
    INSERT INTO public.jobs (
      organization_id, client_id, title, status, priority, description, metadata
    ) VALUES (
      p_workspace_id,
      v_client_id,
      'Inquiry: ' || COALESCE(NULLIF(p_intent, ''), p_caller_name),
      'pending',
      'normal',
      'Lead captured by AI Receptionist.' || E'\nCaller: ' || p_caller_name || E'\nPhone: ' || p_caller_phone || E'\nIntent: ' || COALESCE(p_intent, 'General inquiry'),
      jsonb_build_object('source', 'siren_voice', 'ai_created', true)
    ) RETURNING id INTO v_job_id;
  END IF;

  -- Audit trail
  INSERT INTO public.ai_call_actions (
    workspace_id, call_record_id, client_id,
    action_type, action_payload, action_result, success,
    caller_phone, caller_intent, ai_confidence
  ) VALUES (
    p_workspace_id, p_call_record_id, v_client_id,
    'create_lead',
    jsonb_build_object('name', p_caller_name, 'phone', p_caller_phone, 'email', p_caller_email, 'intent', p_intent),
    jsonb_build_object('client_id', v_client_id, 'job_id', v_job_id, 'was_existing', (v_job_id IS NULL)),
    true,
    p_caller_phone, 'new_inquiry',
    0.85
  ) RETURNING id INTO v_action_id;

  RETURN json_build_object(
    'success', true,
    'action_id', v_action_id,
    'client_id', v_client_id,
    'job_id', v_job_id,
    'is_new_client', (v_job_id IS NOT NULL),
    'client_name', p_caller_name
  );
END;
$$;

-- ── 9. RPC: Get Caller Context for AI Agent ─────────────────────────────
-- Returns enriched context for the AI system prompt
CREATE OR REPLACE FUNCTION public.get_ai_caller_context(
  p_workspace_id UUID,
  p_phone_number TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client RECORD;
  v_jobs JSON;
  v_balance DECIMAL;
  v_upcoming_job RECORD;
  v_recent_calls JSON;
  v_business_name TEXT;
BEGIN
  -- Get business name
  SELECT wpn.business_name INTO v_business_name
  FROM public.workspace_phone_numbers wpn
  WHERE wpn.workspace_id = p_workspace_id
  LIMIT 1;

  IF v_business_name IS NULL THEN
    SELECT o.name INTO v_business_name
    FROM public.organizations o
    WHERE o.id = p_workspace_id;
  END IF;

  -- Find client
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
      'business_name', v_business_name
    );
  END IF;

  -- Active jobs with schedule info
  SELECT COALESCE(json_agg(json_build_object(
    'id', j.id,
    'display_id', j.display_id,
    'title', j.title,
    'status', j.status,
    'scheduled_start', j.scheduled_start,
    'description', LEFT(j.description, 200)
  ) ORDER BY j.scheduled_start ASC NULLS LAST), '[]'::json) INTO v_jobs
  FROM public.jobs j
  WHERE j.client_id = v_client.id
    AND j.status NOT IN ('archived', 'cancelled', 'completed', 'done')
  LIMIT 5;

  -- Next upcoming job
  SELECT j.id, j.display_id, j.title, j.scheduled_start,
         sb.start_time, sb.end_time
  INTO v_upcoming_job
  FROM public.jobs j
  LEFT JOIN public.schedule_blocks sb ON sb.job_id = j.id AND sb.status != 'cancelled'
  WHERE j.client_id = v_client.id
    AND j.status NOT IN ('archived', 'cancelled', 'completed', 'done')
    AND (j.scheduled_start > now() OR sb.start_time > now())
  ORDER BY COALESCE(sb.start_time, j.scheduled_start) ASC
  LIMIT 1;

  -- Outstanding balance
  SELECT COALESCE(SUM(total), 0) INTO v_balance
  FROM public.invoices
  WHERE client_id = v_client.id
    AND status IN ('draft', 'sent');

  -- Recent call history
  SELECT COALESCE(json_agg(json_build_object(
    'channel', cl.channel,
    'direction', cl.direction,
    'status', cl.status,
    'created_at', cl.created_at,
    'duration', cl.duration_seconds
  ) ORDER BY cl.created_at DESC), '[]'::json) INTO v_recent_calls
  FROM public.communication_logs cl
  WHERE cl.client_id = v_client.id
    AND cl.channel = 'voice_call'
  LIMIT 3;

  RETURN json_build_object(
    'found', true,
    'business_name', v_business_name,
    'client_id', v_client.id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'client_phone', v_client.phone,
    'outstanding_balance', v_balance,
    'active_jobs', v_jobs,
    'upcoming_job', CASE WHEN v_upcoming_job.id IS NOT NULL THEN
      json_build_object(
        'id', v_upcoming_job.id,
        'display_id', v_upcoming_job.display_id,
        'title', v_upcoming_job.title,
        'scheduled_start', COALESCE(v_upcoming_job.start_time, v_upcoming_job.scheduled_start)
      )
    ELSE NULL END,
    'recent_calls', v_recent_calls
  );
END;
$$;

-- ── 10. RPC: Post-Call Summary ──────────────────────────────────────────
-- Saves AI-generated transcript and summary to voip_call_records
CREATE OR REPLACE FUNCTION public.save_call_transcript(
  p_call_sid TEXT,
  p_transcript_jsonb JSONB DEFAULT NULL,
  p_ai_summary TEXT DEFAULT NULL,
  p_ai_handled BOOLEAN DEFAULT false,
  p_ai_actions JSONB DEFAULT '[]'::jsonb,
  p_sentiment_score DECIMAL DEFAULT NULL,
  p_caller_intent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_voip_id UUID;
  v_log_id UUID;
BEGIN
  SELECT id, log_id INTO v_voip_id, v_log_id
  FROM public.voip_call_records
  WHERE twilio_call_sid = p_call_sid;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Call record not found');
  END IF;

  UPDATE public.voip_call_records SET
    transcript_jsonb = COALESCE(p_transcript_jsonb, transcript_jsonb),
    ai_transcript = COALESCE(
      (p_transcript_jsonb->>'full_text'),
      ai_transcript
    ),
    ai_summary = COALESCE(p_ai_summary, ai_summary),
    ai_handled = p_ai_handled,
    ai_actions_taken = p_ai_actions,
    sentiment_score = COALESCE(p_sentiment_score, sentiment_score),
    caller_intent = COALESCE(p_caller_intent, caller_intent),
    transcript_status = 'completed',
    updated_at = now()
  WHERE id = v_voip_id;

  -- Update parent log status if AI handled
  IF p_ai_handled THEN
    UPDATE public.communication_logs
    SET status = 'ai_handled',
        updated_at = now()
    WHERE id = v_log_id;
  END IF;

  -- Inject into client CRM timeline if ai_summary exists
  IF p_ai_summary IS NOT NULL AND v_log_id IS NOT NULL THEN
    UPDATE public.communication_logs
    SET body_preview = LEFT(p_ai_summary, 255),
        updated_at = now()
    WHERE id = v_log_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'voip_id', v_voip_id,
    'log_id', v_log_id
  );
END;
$$;

-- ── 11. Realtime publication ────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_actions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 12. Indexes for screen-pop performance ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_phone_lookup
  ON public.clients(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_voip_records_updated
  ON public.voip_call_records(updated_at DESC);
