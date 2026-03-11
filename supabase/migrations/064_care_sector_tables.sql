-- ============================================================================
-- Migration 064: Care Sector Tables (Project Nightingale)
-- Participant profiles, service agreements, progress notes with EVV.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Participant Profiles ─────────────────────────────────────────────────
-- Extends the clients table with care-specific clinical/support data.

CREATE TABLE IF NOT EXISTS public.participant_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   uuid NOT NULL REFERENCES public.clients ON DELETE CASCADE,
  organization_id             uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  ndis_number                 text,
  date_of_birth               date,
  primary_diagnosis           text,
  mobility_requirements       text,
  communication_preferences   text,
  triggers_and_risks          text,
  support_categories          text[] DEFAULT '{}',
  emergency_contacts          jsonb DEFAULT '[]'::jsonb,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (client_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_profiles_client
  ON public.participant_profiles (client_id);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_org
  ON public.participant_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_ndis
  ON public.participant_profiles (ndis_number)
  WHERE ndis_number IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_participant_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_participant_profiles_updated_at
      BEFORE UPDATE ON public.participant_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Service Agreements ───────────────────────────────────────────────────
-- NDIS service agreements linking participants to funded line items.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agreement_status') THEN
    CREATE TYPE public.agreement_status AS ENUM (
      'draft',
      'pending_signature',
      'active',
      'expired',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.service_agreements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  title                 text NOT NULL,
  ndis_line_items       jsonb DEFAULT '[]'::jsonb,
  total_budget          numeric(12, 2) DEFAULT 0,
  consumed_budget       numeric(12, 2) DEFAULT 0,
  start_date            date,
  end_date              date,
  signed_at             timestamptz,
  signed_by             text,
  pdf_url               text,
  status                public.agreement_status NOT NULL DEFAULT 'draft',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_agreements_org
  ON public.service_agreements (organization_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_participant
  ON public.service_agreements (participant_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_status
  ON public.service_agreements (organization_id, status);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_service_agreements_updated_at'
  ) THEN
    CREATE TRIGGER set_service_agreements_updated_at
      BEFORE UPDATE ON public.service_agreements
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Progress Notes ──────────────────────────────────────────────────────
-- Structured progress notes with EVV (Electronic Visit Verification) data.

CREATE TABLE IF NOT EXISTS public.progress_notes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  job_id                uuid REFERENCES public.jobs ON DELETE SET NULL,
  worker_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  participant_id        uuid REFERENCES public.participant_profiles ON DELETE SET NULL,
  context_of_support    text,
  outcomes_achieved     text,
  risks_identified      text,
  goals_linked          jsonb DEFAULT '[]'::jsonb,
  -- EVV: Electronic Visit Verification
  evv_start_lat         double precision,
  evv_start_lng         double precision,
  evv_start_time        timestamptz,
  evv_end_lat           double precision,
  evv_end_lng           double precision,
  evv_end_time          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_notes_org
  ON public.progress_notes (organization_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_job
  ON public.progress_notes (job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_notes_worker
  ON public.progress_notes (worker_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_participant
  ON public.progress_notes (participant_id)
  WHERE participant_id IS NOT NULL;

-- ─── 4. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_notes ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS: Participant Profiles ────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_profiles' AND policyname = 'Org members can view participant profiles') THEN
    CREATE POLICY "Org members can view participant profiles"
      ON public.participant_profiles FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_profiles' AND policyname = 'Admins can manage participant profiles') THEN
    CREATE POLICY "Admins can manage participant profiles"
      ON public.participant_profiles FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = participant_profiles.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 6. RLS: Service Agreements ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_agreements' AND policyname = 'Org members can view service agreements') THEN
    CREATE POLICY "Org members can view service agreements"
      ON public.service_agreements FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_agreements' AND policyname = 'Admins can manage service agreements') THEN
    CREATE POLICY "Admins can manage service agreements"
      ON public.service_agreements FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = service_agreements.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 7. RLS: Progress Notes ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'progress_notes' AND policyname = 'Org members can view progress notes') THEN
    CREATE POLICY "Org members can view progress notes"
      ON public.progress_notes FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'progress_notes' AND policyname = 'Workers can insert progress notes') THEN
    CREATE POLICY "Workers can insert progress notes"
      ON public.progress_notes FOR INSERT
      WITH CHECK (
        worker_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'progress_notes' AND policyname = 'Authors or admins can update progress notes') THEN
    CREATE POLICY "Authors or admins can update progress notes"
      ON public.progress_notes FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (
          worker_id = auth.uid()
          OR (SELECT role FROM public.organization_members
              WHERE organization_id = progress_notes.organization_id
                AND user_id = auth.uid()
                AND status = 'active') IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END $$;

-- ─── 8. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.participant_profiles IS
  'Care sector extension of clients table. Stores NDIS-specific clinical/support data for participants.';
COMMENT ON TABLE public.service_agreements IS
  'NDIS service agreements linking participants to funded support line items with budget tracking.';
COMMENT ON TABLE public.progress_notes IS
  'Structured shift progress notes with EVV (GPS + timestamp) evidence for care compliance.';
