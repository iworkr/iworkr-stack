-- ============================================================================
-- Migration 079: Participant Intake Expansion (Care CRM & Intelligent Intake)
-- Extends participant_profiles with clinical baseline, risk matrix, and care
-- network fields. Adds external_agencies for plan managers & support coordinators.
-- SAFE: All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================================

-- ─── 1. External Agencies ───────────────────────────────────────────────────
-- Plan Managers, Support Coordinators, Allied Health providers, etc.

CREATE TABLE IF NOT EXISTS public.external_agencies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  type                  text NOT NULL CHECK (type IN ('plan_manager', 'support_coordinator', 'allied_health', 'medical', 'other')),
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  abn                   text,
  address               text,
  notes                 text,
  is_active             boolean DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_agencies_org
  ON public.external_agencies (organization_id);
CREATE INDEX IF NOT EXISTS idx_external_agencies_type
  ON public.external_agencies (organization_id, type);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_external_agencies_updated_at') THEN
    CREATE TRIGGER set_external_agencies_updated_at
      BEFORE UPDATE ON public.external_agencies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

ALTER TABLE public.external_agencies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_agencies' AND policyname = 'Org members can view external agencies') THEN
    CREATE POLICY "Org members can view external agencies"
      ON public.external_agencies FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_agencies' AND policyname = 'Admins can manage external agencies') THEN
    CREATE POLICY "Admins can manage external agencies"
      ON public.external_agencies FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = external_agencies.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 2. Extend participant_profiles with PRD fields ──────────────────────────

-- Management type (NDIS funding management)
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS management_type text
    CHECK (management_type IN ('ndia_managed', 'plan_managed', 'self_managed'));

-- Clinical baseline fields
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS mobility_status text
    CHECK (mobility_status IN ('independent', 'mobility_aid', 'wheelchair', 'hoist_required'));

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS communication_type text
    CHECK (communication_type IN ('verbal', 'non_verbal', 'uses_aac_device', 'limited_verbal'));

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS critical_alerts text[] DEFAULT '{}';

-- Care network references
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS plan_manager_id uuid REFERENCES public.external_agencies(id) ON DELETE SET NULL;

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS support_coordinator_id uuid REFERENCES public.external_agencies(id) ON DELETE SET NULL;

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS primary_nominee jsonb;

-- Gender field
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS gender text;

-- Preferred name
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS preferred_name text;

-- Residential coordinates (for shift routing)
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS address_lat numeric(10,7);

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS address_lng numeric(10,7);

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS address text;

-- Intake status tracking
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS intake_status text DEFAULT 'draft'
    CHECK (intake_status IN ('draft', 'step_1', 'step_2', 'step_3', 'step_4', 'complete'));

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'pending_agreement', 'on_hold', 'discharged', 'archived'));

-- ─── 3. Extend service_agreements with quarantine + category allocations ─────

ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS quarantined_budget numeric(12,2) DEFAULT 0;

ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS category_allocations jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS funding_management_type text
    CHECK (funding_management_type IN ('ndia_managed', 'plan_managed', 'self_managed'));

ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS document_url text;

-- ─── 4. Indexes for new fields ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_participant_status
  ON public.participant_profiles (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_participant_intake
  ON public.participant_profiles (organization_id, intake_status)
  WHERE intake_status != 'complete';

CREATE INDEX IF NOT EXISTS idx_participant_geo
  ON public.participant_profiles (organization_id, address_lat, address_lng)
  WHERE address_lat IS NOT NULL AND address_lng IS NOT NULL;

-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.external_agencies IS
  'External service providers: plan managers, support coordinators, allied health providers linked to participants.';
