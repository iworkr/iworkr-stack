-- ============================================================================
-- @migration NightingalePaceNDIAAPI
-- @status COMPLETE
-- @description Project Nightingale-PACE — direct NDIA/PRODA API integration for claiming
-- @tables proda_device_registrations, pace_endorsements, pace_service_bookings, pace_claim_submissions
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. PRODA Device Status ENUM ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.proda_device_status AS ENUM ('INACTIVE','ACTIVE','EXPIRED','ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pace_endorsement_status AS ENUM ('UNLINKED','PENDING_ENDORSEMENT','ENDORSED','REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pace_claim_status AS ENUM (
    'DRAFT','READY','SUBMITTED_TO_PACE','ACCEPTED','REJECTED',
    'QUEUED_FOR_PACE','PAID','REMITTED','ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. PRODA B2B Device Registry ────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_proda_devices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proda_org_id          VARCHAR NOT NULL,
  device_name           VARCHAR NOT NULL DEFAULT 'iWorkr PACE Device',
  device_id             VARCHAR,
  -- Private key stored in vault.secrets; reference its id here
  private_key_vault_id  TEXT,
  -- OAuth token cache
  access_token          TEXT,
  token_expires_at      TIMESTAMPTZ,
  refresh_token         TEXT,
  -- State
  status                public.proda_device_status DEFAULT 'INACTIVE',
  last_auth_at          TIMESTAMPTZ,
  last_error            TEXT,
  -- Audit
  registered_by         UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_proda_device_org UNIQUE (organization_id)
);

ALTER TABLE public.auth_proda_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage proda devices" ON public.auth_proda_devices FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 3. Participant PACE Linkages ────────────────────────────
CREATE TABLE IF NOT EXISTS public.participant_pace_linkages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_profile_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  ndis_number           VARCHAR NOT NULL,
  -- Endorsement
  pace_status           public.pace_endorsement_status DEFAULT 'UNLINKED',
  endorsed_categories   JSONB DEFAULT '[]',
  endorsement_checked_at TIMESTAMPTZ,
  -- Budget cache
  live_balance_cache    JSONB DEFAULT '{}',
  balance_checked_at    TIMESTAMPTZ,
  -- Plan details
  plan_start_date       DATE,
  plan_end_date         DATE,
  plan_id               VARCHAR,
  -- Audit
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_pace_linkage UNIQUE (organization_id, participant_profile_id)
);

ALTER TABLE public.participant_pace_linkages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage pace linkages" ON public.participant_pace_linkages FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX IF NOT EXISTS idx_pace_link_org ON public.participant_pace_linkages(organization_id);
CREATE INDEX IF NOT EXISTS idx_pace_link_ndis ON public.participant_pace_linkages(ndis_number);
CREATE INDEX IF NOT EXISTS idx_pace_link_participant ON public.participant_pace_linkages(participant_profile_id);

-- ── 4. PACE Claims Ledger ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pace_claims (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id            UUID REFERENCES public.invoices(id),
  participant_profile_id UUID REFERENCES public.participant_profiles(id),
  ndis_number           VARCHAR NOT NULL,
  -- Claim details
  claim_reference       VARCHAR,
  support_item_code     VARCHAR NOT NULL,
  support_item_name     TEXT,
  claim_type            VARCHAR DEFAULT 'SERVICE_DELIVERY',
  -- Financial
  quantity              NUMERIC(10,2) NOT NULL,
  unit_price            NUMERIC(10,2) NOT NULL,
  total_amount          NUMERIC(12,2) NOT NULL,
  gst_code              VARCHAR DEFAULT 'P1',
  -- Dates
  service_start_date    DATE NOT NULL,
  service_end_date      DATE NOT NULL,
  date_paid             DATE,
  -- PACE API
  pace_claim_id         VARCHAR,
  pace_status           public.pace_claim_status DEFAULT 'DRAFT',
  pace_response         JSONB DEFAULT '{}',
  pace_error_code       VARCHAR,
  pace_error_message    TEXT,
  submitted_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  -- PRA (Payment Remittance)
  pra_reference         VARCHAR,
  pra_amount            NUMERIC(12,2),
  pra_received_at       TIMESTAMPTZ,
  -- Queue for resilience
  retry_count           INT DEFAULT 0,
  next_retry_at         TIMESTAMPTZ,
  queued_payload        JSONB,
  -- Audit
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pace_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage pace claims" ON public.pace_claims FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX IF NOT EXISTS idx_pace_claims_org ON public.pace_claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_pace_claims_status ON public.pace_claims(organization_id, pace_status);
CREATE INDEX IF NOT EXISTS idx_pace_claims_invoice ON public.pace_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pace_claims_ndis ON public.pace_claims(ndis_number);

-- ── 5. Add PACE columns to invoices ─────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pace_claim_id VARCHAR,
  ADD COLUMN IF NOT EXISTS pace_status TEXT,
  ADD COLUMN IF NOT EXISTS pace_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pace_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pace_error_code VARCHAR,
  ADD COLUMN IF NOT EXISTS pace_pra_reference VARCHAR;

-- ── 6. Unbilled WIP tracking for race condition prevention ──
CREATE TABLE IF NOT EXISTS public.pace_wip_reservations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_profile_id UUID NOT NULL REFERENCES public.participant_profiles(id),
  ndis_number           VARCHAR NOT NULL,
  support_category      VARCHAR NOT NULL,
  reserved_amount       NUMERIC(12,2) NOT NULL,
  shift_reference       TEXT,
  status                VARCHAR DEFAULT 'ACTIVE',
  expires_at            TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pace_wip_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage wip reservations" ON public.pace_wip_reservations FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX IF NOT EXISTS idx_wip_participant ON public.pace_wip_reservations(participant_profile_id, status);

-- ── 7. RPC: Check budget with WIP deduction (race-safe) ─────
CREATE OR REPLACE FUNCTION public.check_pace_budget_with_wip(
  p_org_id UUID,
  p_participant_id UUID,
  p_support_category VARCHAR,
  p_estimated_cost NUMERIC,
  p_shift_reference TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_linkage RECORD;
  v_cached_balance NUMERIC;
  v_unbilled_wip NUMERIC;
  v_available NUMERIC;
  v_sufficient BOOLEAN;
BEGIN
  -- Lock the participant's linkage row to prevent race conditions
  SELECT * INTO v_linkage
  FROM public.participant_pace_linkages
  WHERE organization_id = p_org_id
    AND participant_profile_id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'error', 'No PACE linkage found for this participant',
      'sufficient', false
    );
  END IF;

  -- Check endorsement
  IF v_linkage.pace_status != 'ENDORSED' THEN
    RETURN json_build_object(
      'error', 'Participant has not endorsed this provider. Status: ' || v_linkage.pace_status::TEXT,
      'sufficient', false,
      'pace_status', v_linkage.pace_status::TEXT
    );
  END IF;

  -- Get cached PACE balance for the category
  v_cached_balance := COALESCE(
    (v_linkage.live_balance_cache->>p_support_category)::NUMERIC,
    0
  );

  -- Calculate unbilled WIP (active reservations for this participant + category)
  SELECT COALESCE(SUM(reserved_amount), 0) INTO v_unbilled_wip
  FROM public.pace_wip_reservations
  WHERE organization_id = p_org_id
    AND participant_profile_id = p_participant_id
    AND support_category = p_support_category
    AND status = 'ACTIVE';

  v_available := v_cached_balance - v_unbilled_wip;
  v_sufficient := v_available >= p_estimated_cost;

  -- If sufficient, create a WIP reservation atomically
  IF v_sufficient AND p_shift_reference IS NOT NULL THEN
    INSERT INTO public.pace_wip_reservations (
      organization_id, participant_profile_id, ndis_number,
      support_category, reserved_amount, shift_reference
    ) VALUES (
      p_org_id, p_participant_id, v_linkage.ndis_number,
      p_support_category, p_estimated_cost, p_shift_reference
    );
  END IF;

  RETURN json_build_object(
    'sufficient', v_sufficient,
    'estimated_cost', p_estimated_cost,
    'pace_balance', v_cached_balance,
    'unbilled_wip', v_unbilled_wip,
    'available_after_wip', v_available,
    'ndis_number', v_linkage.ndis_number,
    'support_category', p_support_category,
    'pace_status', v_linkage.pace_status::TEXT,
    'balance_checked_at', v_linkage.balance_checked_at
  );
END;
$$;

-- ── 8. RPC: PACE Dashboard Stats ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pace_dashboard_stats(
  p_org_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_claims INT;
  v_submitted INT;
  v_accepted INT;
  v_rejected INT;
  v_queued INT;
  v_total_claimed NUMERIC;
  v_total_paid NUMERIC;
  v_total_rejected_value NUMERIC;
  v_endorsed_count INT;
  v_unlinked_count INT;
  v_pending_count INT;
BEGIN
  SELECT COUNT(*) INTO v_total_claims FROM public.pace_claims WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_submitted FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status = 'SUBMITTED_TO_PACE';
  SELECT COUNT(*) INTO v_accepted FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status IN ('ACCEPTED','PAID','REMITTED');
  SELECT COUNT(*) INTO v_rejected FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status = 'REJECTED';
  SELECT COUNT(*) INTO v_queued FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status = 'QUEUED_FOR_PACE';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_claimed FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status NOT IN ('DRAFT','ERROR');
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_paid FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status IN ('PAID','REMITTED');
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_rejected_value FROM public.pace_claims WHERE organization_id = p_org_id AND pace_status = 'REJECTED';

  SELECT COUNT(*) INTO v_endorsed_count FROM public.participant_pace_linkages WHERE organization_id = p_org_id AND pace_status = 'ENDORSED';
  SELECT COUNT(*) INTO v_unlinked_count FROM public.participant_pace_linkages WHERE organization_id = p_org_id AND pace_status = 'UNLINKED';
  SELECT COUNT(*) INTO v_pending_count FROM public.participant_pace_linkages WHERE organization_id = p_org_id AND pace_status = 'PENDING_ENDORSEMENT';

  RETURN json_build_object(
    'total_claims', v_total_claims,
    'submitted', v_submitted,
    'accepted', v_accepted,
    'rejected', v_rejected,
    'queued', v_queued,
    'total_claimed', v_total_claimed,
    'total_paid', v_total_paid,
    'total_rejected_value', v_total_rejected_value,
    'endorsed_participants', v_endorsed_count,
    'unlinked_participants', v_unlinked_count,
    'pending_endorsement', v_pending_count
  );
END;
$$;

-- ── 9. Realtime ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pace_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_pace_linkages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
