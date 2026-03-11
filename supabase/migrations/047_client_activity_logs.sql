-- ============================================================
-- Migration 047: Client Activity Logs (Project Helix §2)
-- SAFE: All statements idempotent with existence checks.
-- ============================================================

-- ── 1. Create client_activity_logs table ─────────────────
CREATE TABLE IF NOT EXISTS public.client_activity_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      text NOT NULL,
  actor_id        uuid REFERENCES auth.users,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client ON public.client_activity_logs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_activity_org ON public.client_activity_logs (organization_id, created_at DESC);

ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members can read client activity"
    ON public.client_activity_logs FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert client activity"
    ON public.client_activity_logs FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Trigger: Log when a job is created for a client ───
CREATE OR REPLACE FUNCTION public.log_client_job_created()
RETURNS trigger AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    VALUES (
      NEW.client_id,
      NEW.organization_id,
      'job_created',
      auth.uid(),
      jsonb_build_object(
        'job_id', NEW.id,
        'title', NEW.title,
        'description', COALESCE(NEW.description, '')
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs') THEN
    DROP TRIGGER IF EXISTS on_job_created_log_client ON public.jobs;
    CREATE TRIGGER on_job_created_log_client
      AFTER INSERT ON public.jobs
      FOR EACH ROW
      WHEN (NEW.client_id IS NOT NULL AND NEW.deleted_at IS NULL)
      EXECUTE FUNCTION public.log_client_job_created();
  END IF;
END $$;

-- ── 3. Trigger: Log when a job is completed for a client ─
CREATE OR REPLACE FUNCTION public.log_client_job_completed()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    VALUES (
      NEW.client_id,
      NEW.organization_id,
      'job_completed',
      auth.uid(),
      jsonb_build_object(
        'job_id', NEW.id,
        'title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs') THEN
    DROP TRIGGER IF EXISTS on_job_completed_log_client ON public.jobs;
    CREATE TRIGGER on_job_completed_log_client
      AFTER UPDATE ON public.jobs
      FOR EACH ROW
      WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.client_id IS NOT NULL)
      EXECUTE FUNCTION public.log_client_job_completed();
  END IF;
END $$;

-- ── 4. Trigger: Log when an invoice is created/paid ──────
CREATE OR REPLACE FUNCTION public.log_client_invoice_event()
RETURNS trigger AS $$
DECLARE
  v_event_type text;
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'invoice_sent';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    v_event_type := 'invoice_paid';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
  VALUES (
    NEW.client_id,
    NEW.organization_id,
    v_event_type,
    auth.uid(),
    jsonb_build_object(
      'invoice_id', NEW.id,
      'total', NEW.total,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN
    DROP TRIGGER IF EXISTS on_invoice_log_client ON public.invoices;
    CREATE TRIGGER on_invoice_log_client
      AFTER INSERT OR UPDATE ON public.invoices
      FOR EACH ROW
      WHEN (NEW.client_id IS NOT NULL)
      EXECUTE FUNCTION public.log_client_invoice_event();
  END IF;
END $$;

-- ── 5. Trigger: Log client status changes ────────────────
CREATE OR REPLACE FUNCTION public.log_client_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      NEW.organization_id,
      'status_changed',
      auth.uid(),
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
    DROP TRIGGER IF EXISTS on_client_status_change_log ON public.clients;
    CREATE TRIGGER on_client_status_change_log
      AFTER UPDATE ON public.clients
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION public.log_client_status_change();
  END IF;
END $$;

-- ── 6. Trigger: Log client notes changes ─────────────────
CREATE OR REPLACE FUNCTION public.log_client_notes_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    INSERT INTO public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    VALUES (
      NEW.id,
      NEW.organization_id,
      'note_updated',
      auth.uid(),
      jsonb_build_object(
        'preview', left(NEW.notes, 120)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
    DROP TRIGGER IF EXISTS on_client_notes_change_log ON public.clients;
    CREATE TRIGGER on_client_notes_change_log
      AFTER UPDATE ON public.clients
      FOR EACH ROW
      WHEN (OLD.notes IS DISTINCT FROM NEW.notes)
      EXECUTE FUNCTION public.log_client_notes_change();
  END IF;
END $$;

-- ── 7. Updated RPC: get_client_details with activity logs ─
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_client_details(p_client_id uuid)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_result json;
      BEGIN
        SELECT row_to_json(t)
        INTO v_result
        FROM (
          SELECT
            c.*,
            COALESCE(js.job_count, 0) AS job_count,
            COALESCE(is2.lifetime_value, 0) AS total_spend,
            js.last_job_date,
            (
              SELECT COALESCE(json_agg(row_to_json(cal) ORDER BY cal.created_at DESC), '[]'::json)
              FROM (
                SELECT
                  cal2.id,
                  cal2.event_type,
                  cal2.actor_id,
                  cal2.metadata,
                  cal2.created_at,
                  p.full_name AS actor_name
                FROM public.client_activity_logs cal2
                LEFT JOIN public.profiles p ON p.id = cal2.actor_id
                WHERE cal2.client_id = c.id
                ORDER BY cal2.created_at DESC
                LIMIT 50
              ) cal
            ) AS activity_log,
            (
              SELECT COALESCE(json_agg(row_to_json(inv) ORDER BY inv.created_at DESC), '[]'::json)
              FROM (
                SELECT i.id, i.status, i.total, i.created_at, i.due_date
                FROM public.invoices i
                WHERE i.client_id = c.id
                ORDER BY i.created_at DESC
                LIMIT 50
              ) inv
            ) AS spend_history,
            (
              SELECT COALESCE(json_agg(row_to_json(jb) ORDER BY jb.created_at DESC), '[]'::json)
              FROM (
                SELECT j.id, j.title, j.status, j.priority, j.created_at, j.scheduled_start, j.scheduled_end
                FROM public.jobs j
                WHERE j.client_id = c.id
                  AND j.deleted_at IS NULL
                ORDER BY j.created_at DESC
                LIMIT 50
              ) jb
            ) AS jobs
          FROM public.clients c
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS job_count, max(j.created_at) AS last_job_date
            FROM public.jobs j
            WHERE j.client_id = c.id AND j.deleted_at IS NULL
          ) js ON true
          LEFT JOIN LATERAL (
            SELECT COALESCE(sum(i.total), 0)::numeric AS lifetime_value
            FROM public.invoices i
            WHERE i.client_id = c.id AND i.status = 'paid'
          ) is2 ON true
          WHERE c.id = p_client_id
            AND c.deleted_at IS NULL
        ) t;

        RETURN v_result;
      END;
      $body$;
    $fn$;
  END IF;
END $$;
