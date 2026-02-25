-- ============================================================================
-- Migration 042: Pipeline Events Log
-- ============================================================================
-- Tracks webhook/automation executions for idempotency and audit.
-- Prevents duplicate processing when webhooks retry on timeout.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type       text NOT NULL,
  entity_type      text NOT NULL,
  entity_id        uuid NOT NULL,
  idempotency_key  text NOT NULL,
  status           text NOT NULL DEFAULT 'completed',
  payload          jsonb DEFAULT '{}',
  error            text,
  created_at       timestamptz DEFAULT now(),

  CONSTRAINT uq_pipeline_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_pipeline_events_org ON public.pipeline_events (organization_id);
CREATE INDEX idx_pipeline_events_entity ON public.pipeline_events (entity_type, entity_id);
CREATE INDEX idx_pipeline_events_type ON public.pipeline_events (event_type);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pipeline events"
  ON public.pipeline_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- Enhance convert_accepted_quote with event logging
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
  _idem_key            text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    -- Idempotency guard: skip if already converted
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    -- Double-check via pipeline_events log
    _idem_key := 'quote_accept_' || NEW.id::text;
    IF EXISTS (SELECT 1 FROM public.pipeline_events WHERE idempotency_key = _idem_key) THEN
      RETURN NEW;
    END IF;

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

    -- Log the event for idempotency tracking
    INSERT INTO public.pipeline_events (organization_id, event_type, entity_type, entity_id, idempotency_key, payload)
    VALUES (
      NEW.organization_id,
      'quote_accepted_conversion',
      'quote',
      NEW.id,
      _idem_key,
      jsonb_build_object('job_id', _job_id, 'invoice_id', _invoice_id, 'quote_display_id', NEW.display_id)
    );

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
