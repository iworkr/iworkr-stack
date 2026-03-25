-- ============================================================================
-- @migration HermesCommunicationMatrix
-- @status COMPLETE
-- @description Project Hermes-Matrix — Toggleable Omni-Channel Dispatch Engine.
--   Centralizes all outgoing comms (SMS, Email, Push) through a routing rules
--   table with per-event-type channel toggles and customisable SMS templates.
--   Extends communication_logs with dispatch billing/audit fields.
-- @tables workspace_communication_rules
-- @lastAudit 2026-03-24
-- ============================================================================

-- ── 1. notification_event_type ENUM ─────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_event_type AS ENUM (
    'ROSTER_PUBLISHED',
    'SHIFT_UPDATED',
    'SHIFT_CANCELLED',
    'NEW_JOB_ASSIGNED',
    'OUTRIDER_EN_ROUTE',
    'JOB_COMPLETED',
    'INVOICE_OVERDUE',
    'S8_MEDICATION_MISSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. workspace_communication_rules table ──────────────────
CREATE TABLE IF NOT EXISTS public.workspace_communication_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type      notification_event_type NOT NULL,

  enable_sms      BOOLEAN NOT NULL DEFAULT false,
  enable_email    BOOLEAN NOT NULL DEFAULT true,
  enable_push     BOOLEAN NOT NULL DEFAULT true,

  sms_template    TEXT NOT NULL DEFAULT '',
  email_subject_template TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_workspace_event UNIQUE (workspace_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_comm_rules_workspace
  ON public.workspace_communication_rules(workspace_id);

-- ── 3. RLS for workspace_communication_rules ────────────────
ALTER TABLE public.workspace_communication_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_rules_select_member') THEN
    CREATE POLICY comm_rules_select_member ON public.workspace_communication_rules
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_id = workspace_communication_rules.workspace_id
            AND user_id = auth.uid()
            AND status = 'active'
        )
      );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_rules_manage_admin') THEN
    CREATE POLICY comm_rules_manage_admin ON public.workspace_communication_rules
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_id = workspace_communication_rules.workspace_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin', 'manager')
            AND status = 'active'
        )
      );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comm_rules_service_role') THEN
    CREATE POLICY comm_rules_service_role ON public.workspace_communication_rules
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 4. Extend communication_logs with dispatch billing fields ─
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS segments INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_cents DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_comms_logs_event_type
  ON public.communication_logs(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comms_logs_provider_msg
  ON public.communication_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ── 5. Default SMS templates per event type ─────────────────
-- Trigger function to auto-populate rules when a workspace is created
CREATE OR REPLACE FUNCTION public.seed_workspace_communication_rules()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_communication_rules (workspace_id, event_type, enable_sms, enable_email, enable_push, sms_template, email_subject_template)
  VALUES
    (NEW.id, 'ROSTER_PUBLISHED', false, true, true,
     'Hi {{worker_name}}, your roster for {{start_date}} to {{end_date}} has been published. You have {{shift_count}} shifts. Check the iWorkr app.',
     'Your Roster Has Been Published'),
    (NEW.id, 'SHIFT_UPDATED', false, true, true,
     'URGENT: {{worker_name}}, your shift with {{client_name}} on {{date}} has been updated. Please review the app.',
     'Shift Update Notification'),
    (NEW.id, 'SHIFT_CANCELLED', false, true, true,
     'Hi {{worker_name}}, your shift with {{client_name}} on {{date}} has been cancelled. Please check the app for details.',
     'Shift Cancellation Notice'),
    (NEW.id, 'NEW_JOB_ASSIGNED', false, true, true,
     'New Job: {{job_title}} in {{suburb}}. Check iWorkr app for details.',
     'New Job Assigned'),
    (NEW.id, 'OUTRIDER_EN_ROUTE', true, false, true,
     'Hi {{client_name}}, {{worker_name}} is on their way! Track their arrival here: {{tracking_link}}',
     'Your Technician Is On The Way'),
    (NEW.id, 'JOB_COMPLETED', false, true, false,
     'Hi {{client_name}}, your job {{job_title}} has been completed. Thank you for choosing {{org_name}}.',
     'Job Completed'),
    (NEW.id, 'INVOICE_OVERDUE', false, true, false,
     'Hi {{client_name}}, invoice {{invoice_number}} for {{amount}} is now overdue. Pay securely here: {{payment_link}}',
     'Invoice Overdue Reminder'),
    (NEW.id, 'S8_MEDICATION_MISSED', true, true, true,
     'ALERT: S8 Medication for {{client_name}} was not signed off at {{time}}. Please action immediately.',
     'S8 Medication Alert — Immediate Action Required')
  ON CONFLICT (workspace_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_comm_rules ON public.organizations;
CREATE TRIGGER trg_seed_comm_rules
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_workspace_communication_rules();

-- ── 6. Backfill existing workspaces ─────────────────────────
INSERT INTO public.workspace_communication_rules (workspace_id, event_type, enable_sms, enable_email, enable_push, sms_template, email_subject_template)
SELECT
  o.id,
  evt.event_type,
  CASE evt.event_type
    WHEN 'OUTRIDER_EN_ROUTE' THEN true
    WHEN 'S8_MEDICATION_MISSED' THEN true
    ELSE false
  END,
  CASE evt.event_type
    WHEN 'OUTRIDER_EN_ROUTE' THEN false
    ELSE true
  END,
  CASE evt.event_type
    WHEN 'INVOICE_OVERDUE' THEN false
    WHEN 'JOB_COMPLETED' THEN false
    ELSE true
  END,
  CASE evt.event_type
    WHEN 'ROSTER_PUBLISHED' THEN
      'Hi {{worker_name}}, your roster for {{start_date}} to {{end_date}} has been published. You have {{shift_count}} shifts. Check the iWorkr app.'
    WHEN 'SHIFT_UPDATED' THEN
      'URGENT: {{worker_name}}, your shift with {{client_name}} on {{date}} has been updated. Please review the app.'
    WHEN 'SHIFT_CANCELLED' THEN
      'Hi {{worker_name}}, your shift with {{client_name}} on {{date}} has been cancelled. Please check the app for details.'
    WHEN 'NEW_JOB_ASSIGNED' THEN
      'New Job: {{job_title}} in {{suburb}}. Check iWorkr app for details.'
    WHEN 'OUTRIDER_EN_ROUTE' THEN
      'Hi {{client_name}}, {{worker_name}} is on their way! Track their arrival here: {{tracking_link}}'
    WHEN 'JOB_COMPLETED' THEN
      'Hi {{client_name}}, your job {{job_title}} has been completed. Thank you for choosing {{org_name}}.'
    WHEN 'INVOICE_OVERDUE' THEN
      'Hi {{client_name}}, invoice {{invoice_number}} for {{amount}} is now overdue. Pay securely here: {{payment_link}}'
    WHEN 'S8_MEDICATION_MISSED' THEN
      'ALERT: S8 Medication for {{client_name}} was not signed off at {{time}}. Please action immediately.'
  END,
  CASE evt.event_type
    WHEN 'ROSTER_PUBLISHED' THEN 'Your Roster Has Been Published'
    WHEN 'SHIFT_UPDATED' THEN 'Shift Update Notification'
    WHEN 'SHIFT_CANCELLED' THEN 'Shift Cancellation Notice'
    WHEN 'NEW_JOB_ASSIGNED' THEN 'New Job Assigned'
    WHEN 'OUTRIDER_EN_ROUTE' THEN 'Your Technician Is On The Way'
    WHEN 'JOB_COMPLETED' THEN 'Job Completed'
    WHEN 'INVOICE_OVERDUE' THEN 'Invoice Overdue Reminder'
    WHEN 'S8_MEDICATION_MISSED' THEN 'S8 Medication Alert — Immediate Action Required'
  END
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('ROSTER_PUBLISHED'::notification_event_type),
    ('SHIFT_UPDATED'::notification_event_type),
    ('SHIFT_CANCELLED'::notification_event_type),
    ('NEW_JOB_ASSIGNED'::notification_event_type),
    ('OUTRIDER_EN_ROUTE'::notification_event_type),
    ('JOB_COMPLETED'::notification_event_type),
    ('INVOICE_OVERDUE'::notification_event_type),
    ('S8_MEDICATION_MISSED'::notification_event_type)
) AS evt(event_type)
ON CONFLICT (workspace_id, event_type) DO NOTHING;

-- ── 7. RPC: Get communication rules for a workspace ─────────
CREATE OR REPLACE FUNCTION public.get_communication_rules(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.event_type), '[]'::json)
    FROM public.workspace_communication_rules r
    WHERE r.workspace_id = p_workspace_id
  );
END;
$$;

-- ── 8. RPC: Upsert a single communication rule ─────────────
CREATE OR REPLACE FUNCTION public.upsert_communication_rule(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_enable_sms BOOLEAN DEFAULT NULL,
  p_enable_email BOOLEAN DEFAULT NULL,
  p_enable_push BOOLEAN DEFAULT NULL,
  p_sms_template TEXT DEFAULT NULL,
  p_email_subject_template TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
BEGIN
  INSERT INTO public.workspace_communication_rules (
    workspace_id, event_type, enable_sms, enable_email, enable_push,
    sms_template, email_subject_template, updated_at
  )
  VALUES (
    p_workspace_id,
    p_event_type::notification_event_type,
    COALESCE(p_enable_sms, false),
    COALESCE(p_enable_email, true),
    COALESCE(p_enable_push, true),
    COALESCE(p_sms_template, ''),
    p_email_subject_template,
    now()
  )
  ON CONFLICT (workspace_id, event_type) DO UPDATE SET
    enable_sms = COALESCE(p_enable_sms, workspace_communication_rules.enable_sms),
    enable_email = COALESCE(p_enable_email, workspace_communication_rules.enable_email),
    enable_push = COALESCE(p_enable_push, workspace_communication_rules.enable_push),
    sms_template = COALESCE(p_sms_template, workspace_communication_rules.sms_template),
    email_subject_template = COALESCE(p_email_subject_template, workspace_communication_rules.email_subject_template),
    updated_at = now()
  RETURNING * INTO v_rule;

  RETURN row_to_json(v_rule);
END;
$$;

-- ── 9. RPC: Check dispatch eligibility (used by _shared/dispatch.ts) ──
CREATE OR REPLACE FUNCTION public.check_dispatch_rule(
  p_workspace_id UUID,
  p_event_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_ws RECORD;
BEGIN
  -- Get the rule for this event type
  SELECT * INTO v_rule
  FROM public.workspace_communication_rules
  WHERE workspace_id = p_workspace_id
    AND event_type = p_event_type::notification_event_type;

  -- Check workspace master SMS switch
  SELECT * INTO v_ws
  FROM public.workspace_communication_settings
  WHERE organization_id = p_workspace_id;

  RETURN json_build_object(
    'found', (v_rule IS NOT NULL),
    'enable_sms', COALESCE(v_rule.enable_sms, false) AND COALESCE(v_ws.sms_enabled, false),
    'enable_email', COALESCE(v_rule.enable_email, true),
    'enable_push', COALESCE(v_rule.enable_push, true),
    'sms_template', COALESCE(v_rule.sms_template, ''),
    'email_subject_template', COALESCE(v_rule.email_subject_template, ''),
    'quiet_hours_enabled', COALESCE(v_ws.quiet_hours_enabled, false),
    'quiet_hours_start', COALESCE(v_ws.quiet_hours_start::text, '22:00'),
    'quiet_hours_end', COALESCE(v_ws.quiet_hours_end::text, '06:00'),
    'quiet_hours_override_urgent', COALESCE(v_ws.quiet_hours_override_urgent, true),
    'sender_id', COALESCE(v_ws.twilio_sender_id, 'iWorkr')
  );
END;
$$;

-- ── 10. RPC: Log dispatch event to communication_logs ───────
CREATE OR REPLACE FUNCTION public.log_dispatch_event(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_channel TEXT,
  p_recipient_phone TEXT DEFAULT NULL,
  p_to_address TEXT DEFAULT NULL,
  p_body_preview TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'delivered',
  p_provider_message_id TEXT DEFAULT NULL,
  p_segments INT DEFAULT 1,
  p_cost_cents DECIMAL DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.communication_logs (
    workspace_id, direction, channel, status,
    from_address, to_address, subject, body_preview,
    client_id, job_id, worker_id,
    event_type, recipient_phone, provider_message_id,
    segments, cost_cents, error_message
  ) VALUES (
    p_workspace_id,
    'outbound'::comm_direction,
    CASE p_channel
      WHEN 'sms' THEN 'sms'::comm_channel
      WHEN 'email' THEN 'email'::comm_channel
      ELSE 'sms'::comm_channel
    END,
    CASE p_status
      WHEN 'queued' THEN 'in_progress'::comm_status
      WHEN 'sent' THEN 'delivered'::comm_status
      WHEN 'delivered' THEN 'delivered'::comm_status
      WHEN 'failed' THEN 'failed'::comm_status
      WHEN 'bounced' THEN 'bounced'::comm_status
      ELSE 'delivered'::comm_status
    END,
    'iWorkr',
    COALESCE(p_to_address, p_recipient_phone),
    p_subject,
    p_body_preview,
    p_client_id,
    p_job_id,
    p_worker_id,
    p_event_type,
    p_recipient_phone,
    p_provider_message_id,
    p_segments,
    p_cost_cents,
    p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
