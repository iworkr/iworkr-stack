-- ═══════════════════════════════════════════════════════════
-- Migration 038: Project Hermes — Dynamic Workspace Email Engine
--
-- Introduces a multi-tenant, queue-driven email system:
--   • mail_queue       – outbound email job queue (drained by cron)
--   • email_logs       – delivery audit trail per organization
--   • workspace_email_templates – per-org customizable templates
--   • sweep_upcoming_jobs()    – pg_cron function that scans jobs
--                                 and enqueues reminder emails
--
-- Dependencies: 001 (pg_cron/pg_net), 002 (enums),
--               007 (RLS helpers), 011 (jobs), 031 (cron)
-- ═══════════════════════════════════════════════════════════

-- ── 1. ENUMs ─────────────────────────────────────────────

CREATE TYPE public.email_status AS ENUM (
  'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'
);

CREATE TYPE public.mail_queue_status AS ENUM (
  'pending', 'processing', 'failed', 'failed_fatal'
);

-- ── 2. mail_queue ────────────────────────────────────────

CREATE TABLE public.mail_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  recipient_email varchar(255) NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          public.mail_queue_status DEFAULT 'pending',
  retry_count     int DEFAULT 0,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX idx_mail_queue_drain ON public.mail_queue (status, created_at);
CREATE INDEX idx_mail_queue_org   ON public.mail_queue (organization_id);

-- ── 3. email_logs ────────────────────────────────────────

CREATE TABLE public.email_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  recipient_email varchar(255) NOT NULL,
  subject         text,
  resend_id       varchar(255),
  job_id          uuid REFERENCES public.jobs ON DELETE SET NULL,
  status          public.email_status DEFAULT 'sent',
  metadata        jsonb DEFAULT '{}',
  sent_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_email_logs_org_event ON public.email_logs (organization_id, event_type);
CREATE INDEX idx_email_logs_resend    ON public.email_logs (resend_id);
CREATE INDEX idx_email_logs_job       ON public.email_logs (job_id);

-- ── 4. workspace_email_templates ─────────────────────────

CREATE TABLE public.workspace_email_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  subject_line    text NOT NULL,
  body_html       text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  CONSTRAINT uq_org_event_type UNIQUE (organization_id, event_type)
);

CREATE TRIGGER set_workspace_email_templates_updated_at
  BEFORE UPDATE ON public.workspace_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 5. Profiles: bounce flag ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_bounced boolean DEFAULT false;

-- ── 6. Sweep function — enqueue job reminders ────────────

CREATE OR REPLACE FUNCTION public.sweep_upcoming_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _now      timestamptz := now();
  _tomorrow date := (now() AT TIME ZONE 'UTC')::date + 1;
  _today    date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- 24-hour reminders: jobs due tomorrow that haven't been reminded yet
  INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
  SELECT
    j.organization_id,
    'job_reminder_24h',
    p.email,
    jsonb_build_object(
      'job_id',          j.id,
      'job_title',       j.title,
      'job_location',    j.location,
      'due_date',        j.due_date,
      'tech_name',       p.full_name,
      'organization_id', j.organization_id
    )
  FROM public.jobs j
  JOIN public.profiles p ON j.assignee_id = p.id
  WHERE j.due_date = _tomorrow
    AND j.status IN ('todo', 'scheduled')
    AND j.deleted_at IS NULL
    AND p.email_bounced IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.job_id = j.id
        AND el.event_type = 'job_reminder_24h'
    );

  -- Day-of reminders: jobs due today that haven't had a same-day reminder
  INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
  SELECT
    j.organization_id,
    'job_reminder_1h',
    p.email,
    jsonb_build_object(
      'job_id',          j.id,
      'job_title',       j.title,
      'job_location',    j.location,
      'due_date',        j.due_date,
      'tech_name',       p.full_name,
      'organization_id', j.organization_id
    )
  FROM public.jobs j
  JOIN public.profiles p ON j.assignee_id = p.id
  WHERE j.due_date = _today
    AND j.status IN ('todo', 'scheduled')
    AND j.deleted_at IS NULL
    AND p.email_bounced IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.job_id = j.id
        AND el.event_type = 'job_reminder_1h'
    );
END;
$$;

-- ── 7. Cron: job-reminder sweep (every 15 min) ──────────

SELECT cron.schedule(
  'hermes-job-reminder-sweep',
  '*/15 * * * *',
  'SELECT public.sweep_upcoming_jobs()'
);

-- ── 8. Cron: mail-queue drainer (every 2 min) ───────────

SELECT cron.schedule(
  'hermes-process-mail-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "process-mail-queue"}'::jsonb
  );
  $$
);

-- ── 9. Row Level Security ────────────────────────────────

ALTER TABLE public.mail_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_email_templates ENABLE ROW LEVEL SECURITY;

-- mail_queue: org members can read (queue is system-managed)
CREATE POLICY "org_member_read" ON public.mail_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mail_queue.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- email_logs: org members can read
CREATE POLICY "org_member_read" ON public.email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = email_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- workspace_email_templates: admins/owners full CRUD
CREATE POLICY "org_admin_select" ON public.workspace_email_templates
  FOR SELECT USING (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_insert" ON public.workspace_email_templates
  FOR INSERT WITH CHECK (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_update" ON public.workspace_email_templates
  FOR UPDATE USING (
    public.user_has_role(organization_id, 'admin')
  ) WITH CHECK (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_delete" ON public.workspace_email_templates
  FOR DELETE USING (
    public.user_has_role(organization_id, 'admin')
  );

-- ── 10. Event-driven triggers ──────────────────────────────

-- Trigger: job_assigned — fires when assignee_id changes from NULL to a user
CREATE OR REPLACE FUNCTION public.notify_job_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _client_name text;
  _org_name   text;
BEGIN
  -- Only fire when assignee changes to a non-null value
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id) THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;

    SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_assigned',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'client', jsonb_build_object('name', COALESCE(_client_name, 'Client'), 'address', COALESCE(NEW.location, '')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_assigned
  AFTER UPDATE OF assignee_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_assigned();

-- Trigger: job_cancelled — fires when status changes to 'cancelled'
CREATE OR REPLACE FUNCTION public.notify_job_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _org_name   text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.assignee_id IS NOT NULL THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_cancelled',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_cancelled
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_cancelled();

-- Trigger: job_rescheduled — fires when due_date changes and there's an assignee
CREATE OR REPLACE FUNCTION public.notify_job_rescheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _org_name   text;
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.assignee_id IS NOT NULL THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_rescheduled',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'old_date', OLD.due_date,
          'new_date', NEW.due_date,
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_rescheduled
  AFTER UPDATE OF due_date ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_rescheduled();

-- Trigger: compliance_warning_swms — fires when job moves to in_progress without SWMS
CREATE OR REPLACE FUNCTION public.notify_compliance_swms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _admin record;
  _org_name text;
  _tech_name text;
  _swms_present boolean;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    -- Check if SWMS exists in metadata
    _swms_present := (NEW.metadata->>'swms_signed')::boolean IS TRUE;

    IF NOT _swms_present THEN
      SELECT full_name INTO _tech_name FROM public.profiles WHERE id = NEW.assignee_id;
      SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

      FOR _admin IN
        SELECT p.email, p.full_name
        FROM public.organization_members om
        JOIN public.profiles p ON om.user_id = p.id
        WHERE om.organization_id = NEW.organization_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'manager')
          AND p.email_bounced IS NOT TRUE
      LOOP
        INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
        VALUES (
          NEW.organization_id,
          'compliance_warning_swms',
          _admin.email,
          jsonb_build_object(
            'job_id', NEW.id,
            'job', jsonb_build_object('id', NEW.display_id, 'title', NEW.title),
            'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Unknown')),
            'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
          )
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_compliance_swms
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_compliance_swms();
