-- ============================================================================
-- @migration PlanManagerInvoices
-- @status COMPLETE
-- @description Plan manager inbound invoice parsing and OCR for NDIS
-- @tables plan_manager_invoices
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. Plan Manager Invoices Table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_manager_invoices (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  source_email                  text,
  source_abn                    text,
  provider_name                 text,
  invoice_number                text,
  invoice_date                  date,
  total_amount                  numeric(12,2),
  participant_id                uuid REFERENCES public.participant_profiles ON DELETE SET NULL,
  matched_participant_confidence numeric(5,2),                 -- 0-100
  extracted_line_items          jsonb DEFAULT '[]'::jsonb,      -- [{ndis_item, description, amount, confidence}]
  pdf_url                       text,                          -- Supabase Storage path
  ocr_raw_output                jsonb,                         -- Full vision model response for audit trail
  status                        text NOT NULL CHECK (status IN (
    'received', 'processing', 'review_required', 'approved', 'rejected', 'claimed'
  )),
  reviewed_by                   uuid REFERENCES public.profiles ON DELETE SET NULL,
  reviewed_at                   timestamptz,
  rejection_reason              text,
  notes                         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_invoices_org
  ON public.plan_manager_invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_pm_invoices_status
  ON public.plan_manager_invoices (status);
CREATE INDEX IF NOT EXISTS idx_pm_invoices_participant
  ON public.plan_manager_invoices (participant_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_plan_manager_invoices_updated_at') THEN
    CREATE TRIGGER set_plan_manager_invoices_updated_at
      BEFORE UPDATE ON public.plan_manager_invoices
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.plan_manager_invoices ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS Policies ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_manager_invoices' AND policyname = 'Org members can view plan manager invoices') THEN
    CREATE POLICY "Org members can view plan manager invoices"
      ON public.plan_manager_invoices FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plan_manager_invoices' AND policyname = 'Admins can manage plan manager invoices') THEN
    CREATE POLICY "Admins can manage plan manager invoices"
      ON public.plan_manager_invoices FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = plan_manager_invoices.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 4. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.plan_manager_invoices IS
  'Inbound invoices from third-party providers, processed via OCR for Plan Managers. Tracks extraction confidence and approval workflow.';
