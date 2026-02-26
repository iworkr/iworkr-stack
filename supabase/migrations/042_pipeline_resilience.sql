-- ============================================================================
-- Migration 042: Pipeline Resilience Infrastructure
-- ============================================================================
-- Adds:
--   1. pipeline_events table — audit log for all pipeline automations
--   2. convert_accepted_quote() — enhanced with event logging + idempotency
--   3. mark_invoice_sent_with_link() RPC — sends invoice via link when POS fails
-- ============================================================================
-- NOTE: This migration supersedes the former 042_pipeline_events_log.sql
--       (now renamed to 042b_pipeline_events_log.sql). All content has been
--       merged here. All statements are idempotent.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. pipeline_events — system-level pipeline automation tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  source          text NOT NULL DEFAULT 'trigger',
  idempotency_key text,
  payload         jsonb DEFAULT '{}',
  status          text NOT NULL DEFAULT 'completed',
  error           text,
  created_at      timestamptz DEFAULT now(),

  CONSTRAINT uq_pipeline_idempotency UNIQUE (idempotency_key)
);

-- Indexes (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_pipeline_events_org ON public.pipeline_events (organization_id, event_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_entity ON public.pipeline_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_type ON public.pipeline_events (event_type);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pipeline_events'
      AND policyname = 'Members can read pipeline events'
  ) THEN
    CREATE POLICY "Members can read pipeline events"
      ON public.pipeline_events FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 2. Log pipeline events from convert_accepted_quote trigger
-- --------------------------------------------------------------------------
-- Replace the existing trigger function to add event logging
CREATE OR REPLACE FUNCTION public.convert_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _job_id              uuid;
  _invoice_id          uuid;
  _job_display_id      text;
  _invoice_display_id  text;
  _idemp_key           text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    -- Idempotency: skip if job already linked
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    -- Idempotency: check pipeline_events
    _idemp_key := 'quote_accepted:' || NEW.id::text;
    IF EXISTS (SELECT 1 FROM public.pipeline_events WHERE idempotency_key = _idemp_key) THEN
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

    UPDATE public.clients
    SET pipeline_status = 'won', pipeline_updated_at = now()
    WHERE id = NEW.client_id;

    -- Log the pipeline event for audit + idempotency
    INSERT INTO public.pipeline_events (
      organization_id, event_type, entity_type, entity_id,
      source, idempotency_key, payload
    ) VALUES (
      NEW.organization_id,
      'quote_to_job_conversion',
      'quote',
      NEW.id,
      'trigger',
      _idemp_key,
      jsonb_build_object(
        'quote_id', NEW.id,
        'job_id', _job_id,
        'invoice_id', _invoice_id,
        'total', NEW.total
      )
    );
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.clients
    SET pipeline_status = 'lost', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 3. mark_invoice_sent_with_link() — POS failure pivot
-- --------------------------------------------------------------------------
-- When Stripe Terminal payment is declined, the tech can pivot to sending
-- an invoice payment link. This RPC marks the invoice as 'sent' and
-- generates a portal URL.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_invoice_sent_with_link(
  p_invoice_id uuid,
  p_base_url   text DEFAULT 'https://iworkrapp.com'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv      record;
  _link     text;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = p_invoice_id;

  IF _inv IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Generate a payment link using invoice ID as the token
  _link := p_base_url || '/pay/' || p_invoice_id::text;

  UPDATE public.invoices
  SET status = CASE
        WHEN status = 'draft' THEN 'sent'::public.invoice_status
        ELSE status
      END,
      payment_link = _link,
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Log the pivot event
  INSERT INTO public.pipeline_events (
    organization_id, event_type, entity_type, entity_id,
    source, payload
  ) VALUES (
    _inv.organization_id,
    'pos_decline_invoice_pivot',
    'invoice',
    p_invoice_id,
    'mobile_app',
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'total', _inv.total,
      'payment_link', _link
    )
  );

  RETURN jsonb_build_object(
    'payment_link', _link,
    'invoice_id', p_invoice_id,
    'status', 'sent'
  );
END;
$$;
