-- ============================================================================
-- Migration 066: Incidents & Restrictive Practices (Project Nightingale)
-- Phase 2 Clinical Safety: incident reporting, categorization, and
-- restrictive practice governance.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Incident Category Enum ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_category') THEN
    CREATE TYPE public.incident_category AS ENUM (
      'fall',
      'medication_error',
      'behavioral',
      'environmental',
      'injury',
      'near_miss',
      'property_damage',
      'abuse_allegation',
      'restrictive_practice',
      'other'
    );
  END IF;
END $$;

-- ─── 2. Incident Severity Enum ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
    CREATE TYPE public.incident_severity AS ENUM (
      'low',
      'medium',
      'high',
      'critical'
    );
  END IF;
END $$;

-- ─── 3. Incident Status Enum ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
    CREATE TYPE public.incident_status AS ENUM (
      'reported',
      'under_review',
      'investigation',
      'resolved',
      'closed'
    );
  END IF;
END $$;

-- ─── 4. Restrictive Practice Type Enum ──────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restrictive_practice_type') THEN
    CREATE TYPE public.restrictive_practice_type AS ENUM (
      'seclusion',
      'chemical_restraint',
      'mechanical_restraint',
      'physical_restraint',
      'environmental_restraint'
    );
  END IF;
END $$;

-- ─── 5. Incidents Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incidents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid REFERENCES public.participant_profiles ON DELETE SET NULL,
  worker_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  category              public.incident_category NOT NULL,
  severity              public.incident_severity NOT NULL DEFAULT 'medium',
  status                public.incident_status NOT NULL DEFAULT 'reported',
  title                 text NOT NULL,
  description           text NOT NULL,
  location              text,
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  reported_at           timestamptz NOT NULL DEFAULT now(),
  witnesses             jsonb DEFAULT '[]'::jsonb,
  immediate_actions     text,
  photos                text[] DEFAULT '{}',
  reviewed_by           uuid REFERENCES public.profiles,
  reviewed_at           timestamptz,
  resolution_notes      text,
  resolved_at           timestamptz,
  is_reportable         boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_org
  ON public.incidents (organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_participant
  ON public.incidents (participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_worker
  ON public.incidents (worker_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity
  ON public.incidents (organization_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status
  ON public.incidents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred
  ON public.incidents (organization_id, occurred_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_incidents_updated_at'
  ) THEN
    CREATE TRIGGER set_incidents_updated_at
      BEFORE UPDATE ON public.incidents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 6. Restrictive Practices Table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restrictive_practices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  incident_id           uuid NOT NULL REFERENCES public.incidents ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  practice_type         public.restrictive_practice_type NOT NULL,
  authorized_by         text,
  authorization_ref     text,
  start_time            timestamptz NOT NULL,
  end_time              timestamptz,
  duration_minutes      integer,
  reason                text NOT NULL,
  behavior_before       text,
  behavior_during       text,
  behavior_after        text,
  debrief_notes         text,
  debrief_completed_at  timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restrictive_practices_org
  ON public.restrictive_practices (organization_id);
CREATE INDEX IF NOT EXISTS idx_restrictive_practices_incident
  ON public.restrictive_practices (incident_id);
CREATE INDEX IF NOT EXISTS idx_restrictive_practices_participant
  ON public.restrictive_practices (participant_id);

-- ─── 7. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restrictive_practices ENABLE ROW LEVEL SECURITY;

-- ─── 8. RLS: Incidents ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'Org members can view incidents') THEN
    CREATE POLICY "Org members can view incidents"
      ON public.incidents FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'Workers can report incidents') THEN
    CREATE POLICY "Workers can report incidents"
      ON public.incidents FOR INSERT
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incidents' AND policyname = 'Admins can manage incidents') THEN
    CREATE POLICY "Admins can manage incidents"
      ON public.incidents FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = incidents.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 9. RLS: Restrictive Practices ──────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restrictive_practices' AND policyname = 'Org members can view restrictive practices') THEN
    CREATE POLICY "Org members can view restrictive practices"
      ON public.restrictive_practices FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restrictive_practices' AND policyname = 'Admins can manage restrictive practices') THEN
    CREATE POLICY "Admins can manage restrictive practices"
      ON public.restrictive_practices FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = restrictive_practices.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 10. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.incidents IS
  'Incident/hazard reports for care organizations. Linked to participant, worker, and shift records.';
COMMENT ON TABLE public.restrictive_practices IS
  'Restrictive practice records linked to incidents. Requires authorization and debrief tracking per NDIS QSC requirements.';
