-- ============================================================================
-- Migration 039: Project Grandmaster — Operational Pipelines
-- ============================================================================
-- Wires the full lifecycle across iWorkr's operational surface:
--   Quote → Job → Schedule → Invoice → Archive
--
-- Sections:
--   1. Expand job_status enum (en_route, on_site, completed, archived)
--   2. Expand schedule_block_status enum (on_site)
--   3. Create quote_status enum & convert quotes.status from TEXT
--   4. CRM pipeline columns on clients
--   5. Job state-transition enforcement trigger
--   6. Quote-to-Job auto-conversion (accepted → job + draft invoice)
--   7. Nightly job archival cron
--   8. Job ↔ schedule_block status sync
--   9. Auto-invoice on job completion
--  10. Realtime for quotes
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Expand job_status enum
-- --------------------------------------------------------------------------
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'en_route'  AFTER 'scheduled';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'on_site'   AFTER 'en_route';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'done';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'archived'  AFTER 'invoiced';

-- --------------------------------------------------------------------------
-- 2. Expand schedule_block_status enum
-- --------------------------------------------------------------------------
ALTER TYPE public.schedule_block_status ADD VALUE IF NOT EXISTS 'on_site' AFTER 'en_route';

-- --------------------------------------------------------------------------
-- 3. Create quote_status enum & convert quotes.status
-- --------------------------------------------------------------------------
CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
);

ALTER TABLE public.quotes
  ALTER COLUMN status TYPE public.quote_status
  USING status::public.quote_status;

ALTER TABLE public.quotes ALTER COLUMN status SET DEFAULT 'draft';

-- --------------------------------------------------------------------------
-- 4. CRM pipeline columns on clients
-- --------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pipeline_status    text         DEFAULT 'new_lead';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pipeline_updated_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source        text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_value    numeric(12,2) DEFAULT 0;

-- --------------------------------------------------------------------------
-- 5. Job state-transition enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_job_transition()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  _valid boolean := false;
  _old   text := OLD.status::text;
  _new   text := NEW.status::text;
BEGIN
  IF _old = _new THEN RETURN NEW; END IF;

  IF _new = 'cancelled' AND _old NOT IN ('completed', 'invoiced', 'archived') THEN
    RETURN NEW;
  END IF;

  CASE _old
    WHEN 'backlog'     THEN _valid := _new IN ('todo', 'scheduled', 'cancelled');
    WHEN 'todo'        THEN _valid := _new IN ('scheduled', 'backlog', 'cancelled');
    WHEN 'scheduled'   THEN _valid := _new IN ('en_route', 'in_progress', 'cancelled');
    WHEN 'en_route'    THEN _valid := _new IN ('on_site', 'in_progress', 'scheduled', 'cancelled');
    WHEN 'on_site'     THEN _valid := _new IN ('in_progress', 'cancelled');
    WHEN 'in_progress' THEN _valid := _new IN ('done', 'completed', 'cancelled');
    WHEN 'done'        THEN _valid := _new IN ('invoiced', 'completed', 'archived');
    WHEN 'completed'   THEN _valid := _new IN ('invoiced', 'archived');
    WHEN 'invoiced'    THEN _valid := _new IN ('archived');
    WHEN 'archived'    THEN _valid := false;
    WHEN 'cancelled'   THEN _valid := _new IN ('backlog', 'todo');
    ELSE _valid := false;
  END CASE;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid job transition: % -> %', _old, _new;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_job_transition
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_transition();

-- --------------------------------------------------------------------------
-- 6. Quote-to-Job auto-conversion
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _job_id              uuid;
  _invoice_id          uuid;
  _job_display_id      text;
  _invoice_display_id  text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    SELECT 'JOB-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'JOB-', ''), '')::int, 0)) + 1)::text, 3, '0')
    INTO _job_display_id
    FROM public.jobs WHERE organization_id = NEW.organization_id;

    SELECT 'INV-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
    INTO _invoice_display_id
    FROM public.invoices WHERE organization_id = NEW.organization_id;

    INSERT INTO public.jobs (
      organization_id, display_id, title, description, status,
      client_id, location, revenue, created_by
    ) VALUES (
      NEW.organization_id,
      _job_display_id,
      COALESCE(NEW.title, 'Job from Quote ' || NEW.display_id),
      'Auto-generated from accepted quote ' || NEW.display_id,
      'backlog',
      NEW.client_id,
      NEW.client_address,
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _job_id;

    INSERT INTO public.invoices (
      organization_id, display_id, client_id, job_id, quote_id,
      client_name, client_email, client_address,
      status, issue_date, due_date,
      subtotal, tax_rate, tax, total,
      created_by
    ) VALUES (
      NEW.organization_id,
      _invoice_display_id,
      NEW.client_id,
      _job_id,
      NEW.id,
      NEW.client_name,
      NEW.client_email,
      NEW.client_address,
      'draft',
      CURRENT_DATE,
      CURRENT_DATE + 14,
      COALESCE(NEW.subtotal, 0),
      COALESCE(NEW.tax_rate, 10),
      COALESCE(NEW.tax, 0),
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _invoice_id;

    INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, sort_order)
    SELECT _invoice_id, description, quantity, unit_price, sort_order
    FROM public.quote_line_items
    WHERE quote_id = NEW.id;

    NEW.job_id     := _job_id;
    NEW.invoice_id := _invoice_id;

    UPDATE public.clients
    SET pipeline_status = 'won', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.clients
    SET pipeline_status = 'lost', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_convert_accepted_quote
  BEFORE UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.convert_accepted_quote();

-- --------------------------------------------------------------------------
-- 7. Nightly job archival
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_completed_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  UPDATE public.jobs j
  SET status = 'archived', updated_at = now()
  WHERE j.status IN ('done', 'completed', 'invoiced')
    AND j.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.job_id = j.id AND i.status = 'paid'
    )
    AND j.updated_at < now() - INTERVAL '48 hours';
END;
$$;

SELECT cron.schedule(
  'grandmaster-job-archival',
  '0 2 * * *',
  'SELECT public.archive_completed_jobs()'
);

-- --------------------------------------------------------------------------
-- 8. Sync job status → schedule_block status
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_job_to_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _block_status public.schedule_block_status;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  CASE NEW.status::text
    WHEN 'en_route'    THEN _block_status := 'en_route';
    WHEN 'on_site'     THEN _block_status := 'on_site';
    WHEN 'in_progress' THEN _block_status := 'in_progress';
    WHEN 'done', 'completed', 'invoiced', 'archived'
                       THEN _block_status := 'complete';
    WHEN 'cancelled'   THEN _block_status := 'cancelled';
    ELSE RETURN NEW;
  END CASE;

  UPDATE public.schedule_blocks
  SET status = _block_status, updated_at = now()
  WHERE job_id = NEW.id
    AND status != 'complete'
    AND status != 'cancelled';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_job_to_schedule
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_to_schedule();

-- --------------------------------------------------------------------------
-- 9. Auto-invoice on job completion (when no invoice exists)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_invoice_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _has_invoice         boolean;
  _invoice_display_id  text;
BEGIN
  IF NEW.status IN ('done', 'completed')
     AND OLD.status NOT IN ('done', 'completed', 'invoiced', 'archived') THEN

    SELECT EXISTS(
      SELECT 1 FROM public.invoices WHERE job_id = NEW.id AND deleted_at IS NULL
    ) INTO _has_invoice;

    IF NOT _has_invoice AND NEW.revenue > 0 THEN
      SELECT 'INV-' || LPAD(
        (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
      INTO _invoice_display_id
      FROM public.invoices WHERE organization_id = NEW.organization_id;

      INSERT INTO public.invoices (
        organization_id, display_id, client_id, job_id,
        client_name, status, issue_date, due_date,
        subtotal, tax_rate, tax, total
      )
      SELECT
        NEW.organization_id, _invoice_display_id, NEW.client_id, NEW.id,
        c.name, 'draft', CURRENT_DATE, CURRENT_DATE + 14,
        NEW.revenue, 10, NEW.revenue * 0.1, NEW.revenue * 1.1
      FROM public.clients c WHERE c.id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_invoice_on_completion
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_invoice_on_completion();

-- --------------------------------------------------------------------------
-- 10. Enable realtime on quotes
-- --------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
