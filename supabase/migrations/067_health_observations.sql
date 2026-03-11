-- ============================================================================
-- Migration 067: Health Observations (Project Nightingale)
-- Phase 2 Clinical Safety: vital signs, health telemetry, and trend tracking.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Observation Type Enum ───────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'observation_type') THEN
    CREATE TYPE public.observation_type AS ENUM (
      'blood_pressure',
      'blood_glucose',
      'heart_rate',
      'temperature',
      'weight',
      'oxygen_saturation',
      'respiration_rate',
      'seizure',
      'pain_level',
      'bowel_movement',
      'fluid_intake',
      'food_intake',
      'sleep_quality',
      'mood',
      'other'
    );
  END IF;
END $$;

-- ─── 2. Health Observations Table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_observations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  worker_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  observation_type      public.observation_type NOT NULL,
  value_numeric         double precision,
  value_text            text,
  value_systolic        integer,
  value_diastolic       integer,
  unit                  text,
  is_abnormal           boolean NOT NULL DEFAULT false,
  notes                 text,
  observed_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_observations_org
  ON public.health_observations (organization_id);
CREATE INDEX IF NOT EXISTS idx_health_observations_participant
  ON public.health_observations (participant_id);
CREATE INDEX IF NOT EXISTS idx_health_observations_type
  ON public.health_observations (participant_id, observation_type, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_observations_abnormal
  ON public.health_observations (organization_id, is_abnormal)
  WHERE is_abnormal = true;
CREATE INDEX IF NOT EXISTS idx_health_observations_worker
  ON public.health_observations (worker_id);

-- ─── 3. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.health_observations ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS Policies ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_observations' AND policyname = 'Org members can view health observations') THEN
    CREATE POLICY "Org members can view health observations"
      ON public.health_observations FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_observations' AND policyname = 'Workers can log health observations') THEN
    CREATE POLICY "Workers can log health observations"
      ON public.health_observations FOR INSERT
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_observations' AND policyname = 'Workers can update own observations') THEN
    CREATE POLICY "Workers can update own observations"
      ON public.health_observations FOR UPDATE
      USING (
        worker_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- ─── 5. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.health_observations IS
  'Health telemetry: vital signs, weight, seizures, mood, intake tracking. Used for trend detection and clinical reporting.';
