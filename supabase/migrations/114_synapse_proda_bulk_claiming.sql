-- ============================================================================
-- @migration SynapsePRODABulkClaiming
-- @status COMPLETE
-- @description Project Synapse — PRODA return file reconciliation, MMM-aware claim generation
-- @tables proda_return_entries, proda_aggregation_runs
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. PRODA Return File Entries
-- When the Finance Manager downloads the "Return File" from PRODA after
-- submitting a batch, we ingest every row to reconcile claim line items.
CREATE TABLE IF NOT EXISTS public.proda_return_entries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id        uuid REFERENCES public.proda_claim_batches(id) ON DELETE SET NULL,
    
    -- PRODA Return Fields (exact columns from PRODA CSV return)
    claim_reference     text NOT NULL,  -- Our ClaimReference from the submitted CSV
    ndis_number         text,
    support_item_number text,
    service_date        date,
    quantity            numeric(10,2),
    unit_price          numeric(10,2),
    total_price         numeric(12,2),
    
    -- Outcome
    outcome             text NOT NULL DEFAULT 'pending'
        CHECK (outcome IN ('paid', 'rejected', 'adjusted', 'pending')),
    paid_amount         numeric(12,2) DEFAULT 0,
    rejection_code      text,       -- e.g. 'E001', 'E002'
    rejection_reason    text,       -- Human-readable reason from PRODA
    adjustment_amount   numeric(12,2),
    
    -- Linkage
    claim_line_item_id  uuid REFERENCES public.claim_line_items(id) ON DELETE SET NULL,
    
    -- Metadata
    proda_transaction_id text,      -- Unique ID from PRODA response
    raw_row             jsonb,      -- Entire raw CSV row preserved for audit
    
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proda_return_entries_batch 
    ON public.proda_return_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_proda_return_entries_org 
    ON public.proda_return_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_proda_return_entries_outcome 
    ON public.proda_return_entries(outcome);
CREATE INDEX IF NOT EXISTS idx_proda_return_entries_claim_ref 
    ON public.proda_return_entries(claim_reference);

ALTER TABLE public.proda_return_entries ENABLE ROW LEVEL SECURITY;

-- Only admins/managers can view return entries
CREATE POLICY "Org members can view return entries"
    ON public.proda_return_entries FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = proda_return_entries.organization_id
        )
    );

-- Only admins can insert return entries (via server actions)
CREATE POLICY "Admins can insert return entries"
    ON public.proda_return_entries FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = proda_return_entries.organization_id
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );

-- 2. Add aggregation tracking columns to claim_line_items
-- These help trace claim lines back to their source time entries
ALTER TABLE public.claim_line_items
    ADD COLUMN IF NOT EXISTS time_entry_id      uuid REFERENCES public.time_entries(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS mmm_classification integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS aggregated_at      timestamptz,
    ADD COLUMN IF NOT EXISTS paid_at            timestamptz,
    ADD COLUMN IF NOT EXISTS paid_amount        numeric(12,2);

CREATE INDEX IF NOT EXISTS idx_claim_line_items_time_entry 
    ON public.claim_line_items(time_entry_id) WHERE time_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_line_items_status_org 
    ON public.claim_line_items(organization_id, status);

-- 3. Add MMM classification to participant profiles for geographic loading
ALTER TABLE public.participant_profiles
    ADD COLUMN IF NOT EXISTS mmm_classification integer DEFAULT 1
        CHECK (mmm_classification BETWEEN 1 AND 7);

COMMENT ON COLUMN public.participant_profiles.mmm_classification 
    IS 'Modified Monash Model classification (1=Metro, 7=Very Remote) for NDIS geographic price loading';

-- 4. Add remittance tracking to proda_claim_batches  
ALTER TABLE public.proda_claim_batches
    ADD COLUMN IF NOT EXISTS return_file_uploaded_at  timestamptz,
    ADD COLUMN IF NOT EXISTS return_file_url          text,
    ADD COLUMN IF NOT EXISTS rejected_amount          numeric(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS adjusted_amount          numeric(14,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS aggregation_period_start date,
    ADD COLUMN IF NOT EXISTS aggregation_period_end   date;

-- 5. Helper function: get effective NDIS rate with MMM geographic loading
CREATE OR REPLACE FUNCTION public.get_ndis_rate_with_loading(
    p_support_item_number text,
    p_service_date        date DEFAULT CURRENT_DATE,
    p_mmm_classification  integer DEFAULT 1
)
RETURNS TABLE(
    base_rate        numeric,
    modifier_pct     numeric,
    effective_rate   numeric,
    item_name        text,
    unit             text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nc.base_rate_national,
        COALESCE(nrm.modifier_percentage, 0)::numeric,
        ROUND(
            nc.base_rate_national * (1 + COALESCE(nrm.modifier_percentage, 0) / 100),
            2
        ),
        nc.support_item_name,
        nc.unit
    FROM public.ndis_catalogue nc
    LEFT JOIN public.ndis_region_modifiers nrm
        ON nrm.mmm_classification = p_mmm_classification
        AND nrm.effective_from <= p_service_date
        AND (nrm.effective_to IS NULL OR nrm.effective_to >= p_service_date)
    WHERE nc.support_item_number = p_support_item_number
      AND nc.effective_from <= p_service_date
      AND (nc.effective_to IS NULL OR nc.effective_to >= p_service_date)
    ORDER BY nc.effective_from DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_ndis_rate_with_loading IS 
    'Returns the effective NDIS rate for a support item, applying MMM geographic loading modifier';

-- 6. Aggregation tracking table for scheduled Sunday sweeps
CREATE TABLE IF NOT EXISTS public.proda_aggregation_runs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    period_start        date NOT NULL,
    period_end          date NOT NULL,
    
    -- Metrics
    timesheets_swept    integer DEFAULT 0,
    time_entries_processed integer DEFAULT 0,
    claim_lines_created integer DEFAULT 0,
    total_claim_amount  numeric(14,2) DEFAULT 0,
    
    -- Result
    status              text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    error_log           jsonb DEFAULT '[]'::jsonb,
    
    triggered_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    batch_id            uuid REFERENCES public.proda_claim_batches(id) ON DELETE SET NULL,
    
    created_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_proda_aggregation_runs_org 
    ON public.proda_aggregation_runs(organization_id);

ALTER TABLE public.proda_aggregation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view aggregation runs"
    ON public.proda_aggregation_runs FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = proda_aggregation_runs.organization_id
        )
    );

CREATE POLICY "Admins can insert aggregation runs"
    ON public.proda_aggregation_runs FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = proda_aggregation_runs.organization_id
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Admins can update aggregation runs"
    ON public.proda_aggregation_runs FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = proda_aggregation_runs.organization_id
            AND om.role IN ('owner', 'admin', 'manager')
        )
    );
