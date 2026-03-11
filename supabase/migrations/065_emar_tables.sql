-- ============================================================================
-- Migration 065: eMAR — Electronic Medication Administration Record
-- Phase 2 Clinical Safety: medication profiles + administration records.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Medication Route Enum ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medication_route') THEN
    CREATE TYPE public.medication_route AS ENUM (
      'oral',
      'sublingual',
      'topical',
      'inhaled',
      'subcutaneous',
      'intramuscular',
      'rectal',
      'ophthalmic',
      'otic',
      'nasal',
      'transdermal',
      'other'
    );
  END IF;
END $$;

-- ─── 2. Medication Frequency Enum ───────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medication_frequency') THEN
    CREATE TYPE public.medication_frequency AS ENUM (
      'once_daily',
      'twice_daily',
      'three_times_daily',
      'four_times_daily',
      'every_morning',
      'every_night',
      'weekly',
      'fortnightly',
      'monthly',
      'prn',
      'other'
    );
  END IF;
END $$;

-- ─── 3. MAR Outcome Enum ───────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mar_outcome') THEN
    CREATE TYPE public.mar_outcome AS ENUM (
      'given',
      'refused',
      'absent',
      'withheld',
      'self_administered',
      'prn_given',
      'not_available',
      'other'
    );
  END IF;
END $$;

-- ─── 4. Participant Medications Table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.participant_medications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  medication_name       text NOT NULL,
  generic_name          text,
  dosage                text NOT NULL,
  route                 public.medication_route NOT NULL DEFAULT 'oral',
  frequency             public.medication_frequency NOT NULL DEFAULT 'once_daily',
  time_slots            text[] DEFAULT '{}',
  prescribing_doctor    text,
  pharmacy              text,
  start_date            date,
  end_date              date,
  is_prn                boolean NOT NULL DEFAULT false,
  prn_reason            text,
  special_instructions  text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participant_medications_org
  ON public.participant_medications (organization_id);
CREATE INDEX IF NOT EXISTS idx_participant_medications_participant
  ON public.participant_medications (participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_medications_active
  ON public.participant_medications (participant_id, is_active)
  WHERE is_active = true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_participant_medications_updated_at'
  ) THEN
    CREATE TRIGGER set_participant_medications_updated_at
      BEFORE UPDATE ON public.participant_medications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 5. Medication Administration Records (MAR) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.medication_administration_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  medication_id         uuid NOT NULL REFERENCES public.participant_medications ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  worker_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  outcome               public.mar_outcome NOT NULL,
  administered_at       timestamptz NOT NULL DEFAULT now(),
  notes                 text,
  prn_effectiveness     text,
  prn_followup_at       timestamptz,
  prn_followup_done     boolean DEFAULT false,
  witness_id            uuid REFERENCES public.profiles,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mar_org
  ON public.medication_administration_records (organization_id);
CREATE INDEX IF NOT EXISTS idx_mar_medication
  ON public.medication_administration_records (medication_id);
CREATE INDEX IF NOT EXISTS idx_mar_participant
  ON public.medication_administration_records (participant_id);
CREATE INDEX IF NOT EXISTS idx_mar_worker
  ON public.medication_administration_records (worker_id);
CREATE INDEX IF NOT EXISTS idx_mar_shift
  ON public.medication_administration_records (shift_id)
  WHERE shift_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mar_prn_followup
  ON public.medication_administration_records (prn_followup_at)
  WHERE prn_followup_at IS NOT NULL AND prn_followup_done = false;

-- ─── 6. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.participant_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_administration_records ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS: Participant Medications ─────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_medications' AND policyname = 'Org members can view participant medications') THEN
    CREATE POLICY "Org members can view participant medications"
      ON public.participant_medications FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participant_medications' AND policyname = 'Admins can manage participant medications') THEN
    CREATE POLICY "Admins can manage participant medications"
      ON public.participant_medications FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = participant_medications.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 8. RLS: MAR ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medication_administration_records' AND policyname = 'Org members can view MAR') THEN
    CREATE POLICY "Org members can view MAR"
      ON public.medication_administration_records FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medication_administration_records' AND policyname = 'Workers can insert MAR entries') THEN
    CREATE POLICY "Workers can insert MAR entries"
      ON public.medication_administration_records FOR INSERT
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medication_administration_records' AND policyname = 'Workers can update own MAR entries') THEN
    CREATE POLICY "Workers can update own MAR entries"
      ON public.medication_administration_records FOR UPDATE
      USING (
        worker_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- ─── 9. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.participant_medications IS
  'Participant medication profiles: prescription details, dosage, frequency, and PRN flags.';
COMMENT ON TABLE public.medication_administration_records IS
  'eMAR entries: timestamped record of each medication administration event with outcome tracking and PRN effectiveness follow-ups.';
