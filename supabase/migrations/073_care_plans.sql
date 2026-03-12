-- ============================================================================
-- Migration 073: Care Plans, Goals & Goal-Progress Links
-- (Project Nightingale Phase 4)
-- Structured care planning with auditable goal-to-shift linkage.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Care Plan Status Enum ─────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'care_plan_status') THEN
    CREATE TYPE public.care_plan_status AS ENUM (
      'draft', 'active', 'under_review', 'archived'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
    CREATE TYPE public.goal_status AS ENUM (
      'not_started', 'in_progress', 'achieved', 'on_hold', 'abandoned'
    );
  END IF;
END $$;

-- ─── 2. Care Plans Table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  title                 text NOT NULL,
  status                public.care_plan_status NOT NULL DEFAULT 'draft',
  start_date            date,
  review_date           date,                                  -- when plan was last reviewed
  next_review_date      date,                                  -- mandatory review cycle
  domains               jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {"daily_living": "...", "social": "..."}
  assessor_name         text,
  assessor_role         text,
  notes                 text,
  approved_by           uuid REFERENCES public.profiles ON DELETE SET NULL,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_plans_participant
  ON public.care_plans (participant_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_org
  ON public.care_plans (organization_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_review
  ON public.care_plans (next_review_date)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_care_plans_status
  ON public.care_plans (organization_id, status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_care_plans_updated_at') THEN
    CREATE TRIGGER set_care_plans_updated_at
      BEFORE UPDATE ON public.care_plans
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Care Goals Table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_goals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id          uuid NOT NULL REFERENCES public.care_plans ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  ndis_goal_reference   text,                                  -- link to official NDIS plan goal text
  support_category      text,                                  -- 'core', 'capacity_building', 'capital'
  title                 text NOT NULL,
  description           text,
  target_outcome        text,
  status                public.goal_status NOT NULL DEFAULT 'not_started',
  priority              int DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  milestones            jsonb DEFAULT '[]'::jsonb,             -- [{"title": "...", "target_date": "...", "achieved": false}]
  evidence_notes        text,                                  -- what evidence demonstrates progress
  started_at            timestamptz,
  achieved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_goals_plan
  ON public.care_goals (care_plan_id);
CREATE INDEX IF NOT EXISTS idx_care_goals_participant
  ON public.care_goals (participant_id);
CREATE INDEX IF NOT EXISTS idx_care_goals_status
  ON public.care_goals (status)
  WHERE status = 'in_progress';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_care_goals_updated_at') THEN
    CREATE TRIGGER set_care_goals_updated_at
      BEFORE UPDATE ON public.care_goals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 4. Goal-Progress Links (many-to-many via progress_notes) ─────────

CREATE TABLE IF NOT EXISTS public.goal_progress_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id               uuid NOT NULL REFERENCES public.care_goals ON DELETE CASCADE,
  progress_note_id      uuid NOT NULL REFERENCES public.progress_notes ON DELETE CASCADE,
  contribution_summary  text,                                  -- what the worker did toward this goal
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, progress_note_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_goal
  ON public.goal_progress_links (goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_note
  ON public.goal_progress_links (progress_note_id);

-- ─── 5. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_links ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS Policies ────────────────────────────────────────────────────────

-- Care Plans: org members can read, admin/manager can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_plans' AND policyname = 'Org members can view care plans') THEN
    CREATE POLICY "Org members can view care plans"
      ON public.care_plans FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_plans' AND policyname = 'Admins can manage care plans') THEN
    CREATE POLICY "Admins can manage care plans"
      ON public.care_plans FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = care_plans.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- Care Goals: same permissions as plans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_goals' AND policyname = 'Org members can view care goals') THEN
    CREATE POLICY "Org members can view care goals"
      ON public.care_goals FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_goals' AND policyname = 'Admins can manage care goals') THEN
    CREATE POLICY "Admins can manage care goals"
      ON public.care_goals FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = care_goals.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- Goal-Progress Links: workers can create links (during shift report), all members can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goal_progress_links' AND policyname = 'Org members can view goal progress links') THEN
    CREATE POLICY "Org members can view goal progress links"
      ON public.goal_progress_links FOR SELECT
      USING (
        goal_id IN (
          SELECT id FROM public.care_goals
          WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goal_progress_links' AND policyname = 'Workers can create goal progress links') THEN
    CREATE POLICY "Workers can create goal progress links"
      ON public.goal_progress_links FOR INSERT
      WITH CHECK (
        progress_note_id IN (
          SELECT id FROM public.progress_notes
          WHERE worker_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── 7. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.care_plans IS
  'Structured care plans for participants. Tracks support domains, review dates, and assessor details.';
COMMENT ON TABLE public.care_goals IS
  'Individual goals within a care plan. Links to NDIS plan goals for auditable funding justification.';
COMMENT ON TABLE public.goal_progress_links IS
  'Many-to-many link between goals and progress notes. Creates auditable thread from NDIS funding to daily shift work.';
