-- ═══════════════════════════════════════════════════════════════════
-- Migration 110: Project Monolith-Execution — Operational Gating
-- ═══════════════════════════════════════════════════════════════════
-- Adds is_retroactive columns, shift_tasks table, shift_participants
-- linking table (SIL multi-participant), and the RLS helper function.

-- ── 1. Add is_retroactive to clinical tables ─────────────────────
ALTER TABLE public.health_observations
  ADD COLUMN IF NOT EXISTS is_retroactive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_variance_minutes integer DEFAULT 0;

ALTER TABLE public.medication_administration_records
  ADD COLUMN IF NOT EXISTS is_retroactive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_variance_minutes integer DEFAULT 0;

ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS is_retroactive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_variance_minutes integer DEFAULT 0;

-- ── 2. Shift Participants (SIL multi-participant linking) ────────
CREATE TABLE IF NOT EXISTS public.shift_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shift_id, participant_id)
);

ALTER TABLE public.shift_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shift participants"
  ON public.shift_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = shift_participants.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Managers can manage shift participants"
  ON public.shift_participants FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = shift_participants.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = shift_participants.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 3. Shift Tasks (mandatory operational checklist) ─────────────
CREATE TABLE IF NOT EXISTS public.shift_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_mandatory boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shift tasks"
  ON public.shift_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = shift_tasks.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Workers can complete shift tasks"
  ON public.shift_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = shift_tasks.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- ── 4. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shift_participants_shift
  ON public.shift_participants(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_participants_participant
  ON public.shift_participants(participant_id);

CREATE INDEX IF NOT EXISTS idx_shift_tasks_shift
  ON public.shift_tasks(shift_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_time_entries_worker_active
  ON public.time_entries(worker_id)
  WHERE status = 'active';
