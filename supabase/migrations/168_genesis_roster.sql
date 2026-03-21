-- ============================================================================
-- Migration 168: Project Genesis-Roster
-- Creates the Care Blueprint architecture, clinical skills system,
-- and the rpc_generate_roster_shell function for auto-rostering.
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.coverage_type AS ENUM (
    'standard_hourly', '24_7_continuous', 'active_night', 'sleepover'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gender_preference AS ENUM (
    'no_preference', 'male_only', 'female_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'unfilled' and 'published' to schedule_block_status if missing
DO $$ BEGIN
  ALTER TYPE public.schedule_block_status ADD VALUE IF NOT EXISTS 'unfilled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.schedule_block_status ADD VALUE IF NOT EXISTS 'published';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Clinical Skills Lookup ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinical_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_skills_org_name
  ON public.clinical_skills(organization_id, LOWER(name));

ALTER TABLE public.clinical_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view clinical skills" ON public.clinical_skills;
CREATE POLICY "Org members can view clinical skills" ON public.clinical_skills
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage clinical skills" ON public.clinical_skills;
CREATE POLICY "Admins can manage clinical skills" ON public.clinical_skills
  FOR ALL USING (
    (SELECT role FROM organization_members
     WHERE organization_id = clinical_skills.organization_id
       AND user_id = auth.uid() AND status = 'active')
    = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  );

-- ── 3. Worker Clinical Skills Junction ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.worker_clinical_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  skill_id        UUID NOT NULL REFERENCES public.clinical_skills(id) ON DELETE CASCADE,
  acquired_date   DATE,
  expiry_date     DATE,
  verified        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_skills_user ON public.worker_clinical_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_skills_org ON public.worker_clinical_skills(organization_id);

ALTER TABLE public.worker_clinical_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view worker skills" ON public.worker_clinical_skills;
CREATE POLICY "Org members can view worker skills" ON public.worker_clinical_skills
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage worker skills" ON public.worker_clinical_skills;
CREATE POLICY "Admins can manage worker skills" ON public.worker_clinical_skills
  FOR ALL USING (
    (SELECT role FROM organization_members
     WHERE organization_id = worker_clinical_skills.organization_id
       AND user_id = auth.uid() AND status = 'active')
    = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  );

-- ── 4. Care Blueprints Table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_blueprints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id    UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  coverage_type     public.coverage_type NOT NULL DEFAULT 'standard_hourly',
  staffing_ratio    INT NOT NULL DEFAULT 1 CHECK (staffing_ratio >= 1 AND staffing_ratio <= 5),
  required_skills   UUID[] DEFAULT '{}',
  gender_preference public.gender_preference DEFAULT 'no_preference',
  banned_workers    UUID[] DEFAULT '{}',
  shift_pattern     JSONB NOT NULL DEFAULT '[
    {"label": "Morning", "start": "07:00", "end": "15:00"},
    {"label": "Evening", "start": "15:00", "end": "23:00"},
    {"label": "Night",   "start": "23:00", "end": "07:00"}
  ]'::JSONB,
  notes             TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprints_org ON public.care_blueprints(organization_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_participant ON public.care_blueprints(participant_id);

ALTER TABLE public.care_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view blueprints" ON public.care_blueprints;
CREATE POLICY "Org members can view blueprints" ON public.care_blueprints
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage blueprints" ON public.care_blueprints;
CREATE POLICY "Admins can manage blueprints" ON public.care_blueprints
  FOR ALL USING (
    (SELECT role FROM organization_members
     WHERE organization_id = care_blueprints.organization_id
       AND user_id = auth.uid() AND status = 'active')
    = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role])
  );

-- ── 5. Upgrade schedule_blocks ──────────────────────────────────────────────

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES public.care_blueprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_group_id UUID,
  ADD COLUMN IF NOT EXISTS target_ratio INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_blueprint ON public.schedule_blocks(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_shift_group ON public.schedule_blocks(shift_group_id);

-- ── 6. rpc_generate_roster_shell ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_generate_roster_shell(
  p_blueprint_id UUID,
  p_weeks INT DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bp RECORD;
  v_pattern JSONB;
  v_slot INT;
  v_day INT;
  v_start_date DATE;
  v_current_date DATE;
  v_shift_group UUID;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_start_time TEXT;
  v_end_time TEXT;
  v_label TEXT;
  v_total_shifts INT := 0;
  v_participant_name TEXT;
BEGIN
  -- Fetch the blueprint
  SELECT b.*, pp.id AS pp_id, c.name AS p_name
  INTO v_bp
  FROM public.care_blueprints b
  JOIN public.participant_profiles pp ON pp.id = b.participant_id
  JOIN public.clients c ON c.id = pp.client_id
  WHERE b.id = p_blueprint_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blueprint not found: %', p_blueprint_id;
  END IF;

  v_participant_name := v_bp.p_name;
  v_start_date := CURRENT_DATE;

  -- Loop through each day
  FOR v_day IN 0..(p_weeks * 7 - 1)
  LOOP
    v_current_date := v_start_date + v_day;

    -- Loop through each shift pattern entry
    FOR v_pattern IN SELECT * FROM jsonb_array_elements(v_bp.shift_pattern)
    LOOP
      v_start_time := v_pattern->>'start';
      v_end_time := v_pattern->>'end';
      v_label := COALESCE(v_pattern->>'label', 'Shift');

      -- Calculate timestamps
      v_shift_start := (v_current_date || ' ' || v_start_time)::TIMESTAMPTZ;

      -- Handle overnight shifts (end < start means next day)
      IF v_end_time::TIME < v_start_time::TIME THEN
        v_shift_end := ((v_current_date + 1) || ' ' || v_end_time)::TIMESTAMPTZ;
      ELSE
        v_shift_end := (v_current_date || ' ' || v_end_time)::TIMESTAMPTZ;
      END IF;

      -- Generate a group ID for this time slot (shared by ratio slots)
      v_shift_group := gen_random_uuid();

      -- Loop for the staffing ratio
      FOR v_slot IN 1..v_bp.staffing_ratio
      LOOP
        INSERT INTO public.schedule_blocks (
          organization_id, participant_id, title, start_time, end_time,
          status, blueprint_id, shift_group_id, target_ratio, technician_id
        ) VALUES (
          v_bp.organization_id,
          v_bp.participant_id,
          v_label || ' — ' || v_participant_name || ' (Slot ' || v_slot || '/' || v_bp.staffing_ratio || ')',
          v_shift_start,
          v_shift_end,
          'unfilled'::schedule_block_status,
          p_blueprint_id,
          v_shift_group,
          v_bp.staffing_ratio,
          NULL
        );

        v_total_shifts := v_total_shifts + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'blueprint_id', p_blueprint_id,
    'total_shifts_created', v_total_shifts,
    'date_range_start', v_start_date,
    'date_range_end', v_start_date + (p_weeks * 7 - 1),
    'participant_name', v_participant_name
  );
END;
$$;

-- ── 7. Seed common clinical skills for demo ─────────────────────────────────

INSERT INTO public.clinical_skills (organization_id, name, category) VALUES
  (NULL, 'Manual Handling / Hoist', 'physical'),
  (NULL, 'Epilepsy Management', 'medical'),
  (NULL, 'PEG Feeding', 'medical'),
  (NULL, 'Medication Administration', 'medical'),
  (NULL, 'Behavior Support', 'behavioral'),
  (NULL, 'CPR / First Aid', 'safety'),
  (NULL, 'Dysphagia Management', 'medical'),
  (NULL, 'Tracheostomy Care', 'medical'),
  (NULL, 'Catheter Care', 'medical'),
  (NULL, 'Diabetes Management', 'medical'),
  (NULL, 'Mental Health First Aid', 'behavioral'),
  (NULL, 'Restrictive Practices', 'behavioral'),
  (NULL, 'Community Access', 'support'),
  (NULL, 'Domestic Assistance', 'support'),
  (NULL, 'Personal Care', 'support'),
  (NULL, 'Transport', 'support')
ON CONFLICT DO NOTHING;
