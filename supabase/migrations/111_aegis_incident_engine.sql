-- ═══════════════════════════════════════════════════════════════════
-- Migration 111: Project Aegis — SIRS Compliance Engine
-- ═══════════════════════════════════════════════════════════════════
-- Expands incidents with SIRS fields, adds incident_participants,
-- incident_investigations (5 Whys RCA), corrective_actions (CAPA),
-- and incident_media. All with RLS.

-- ── 1. Expand incidents table with SIRS fields ──────────────────
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS sirs_priority text DEFAULT 'internal_only'
    CHECK (sirs_priority IN ('priority_1', 'priority_2', 'internal_only')),
  ADD COLUMN IF NOT EXISTS sirs_sla_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS is_emergency_services_involved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES public.care_facilities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incident_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS downgrade_justification text,
  ADD COLUMN IF NOT EXISTS downgraded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS downgraded_at timestamptz,
  ADD COLUMN IF NOT EXISTS ndis_sirs_reference_number text,
  ADD COLUMN IF NOT EXISTS sirs_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text;

-- Add 'sirs_submitted' to the incident_status enum if not present
DO $$
BEGIN
  ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'sirs_submitted' AFTER 'investigation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Incident Participants (Many-to-Many) ─────────────────────
CREATE TABLE IF NOT EXISTS public.incident_participants (
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('victim', 'aggressor', 'witness', 'involved')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, participant_id)
);

ALTER TABLE public.incident_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view incident participants"
  ON public.incident_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      JOIN public.organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = incident_participants.incident_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Workers can link participants to incidents"
  ON public.incident_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incidents i
      JOIN public.organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = incident_participants.incident_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- ── 3. Incident Investigations (RCA — 5 Whys) ──────────────────
CREATE TABLE IF NOT EXISTS public.incident_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  investigator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- The 5 Whys
  why_1 text,
  why_2 text,
  why_3 text,
  why_4 text,
  why_5 text,
  root_cause_summary text,

  -- Investigation findings
  contributing_factors text,
  environmental_factors text,
  systemic_factors text,

  -- Timeline reconstruction (JSON array of imported events)
  timeline_events jsonb DEFAULT '[]'::jsonb,

  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view investigations"
  ON public.incident_investigations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = incident_investigations.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Managers can manage investigations"
  ON public.incident_investigations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = incident_investigations.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = incident_investigations.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 4. Corrective & Preventative Actions (CAPA) ────────────────
CREATE TABLE IF NOT EXISTS public.corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.incident_investigations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  action_type text NOT NULL CHECK (action_type IN (
    'policy_review', 'staff_retraining', 'facility_maintenance',
    'participant_bsp_update', 'process_change', 'other'
  )),
  description text NOT NULL,
  due_date timestamptz NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completion_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view corrective actions"
  ON public.corrective_actions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = corrective_actions.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Managers can manage corrective actions"
  ON public.corrective_actions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = corrective_actions.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = corrective_actions.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 5. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_incidents_sirs_priority
  ON public.incidents(organization_id, sirs_priority)
  WHERE sirs_priority != 'internal_only';

CREATE INDEX IF NOT EXISTS idx_incidents_sirs_deadline
  ON public.incidents(sirs_sla_deadline)
  WHERE sirs_sla_deadline IS NOT NULL AND status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_incident_participants_incident
  ON public.incident_participants(incident_id);

CREATE INDEX IF NOT EXISTS idx_incident_investigations_incident
  ON public.incident_investigations(incident_id);

CREATE INDEX IF NOT EXISTS idx_corrective_actions_investigation
  ON public.corrective_actions(investigation_id);

CREATE INDEX IF NOT EXISTS idx_corrective_actions_status
  ON public.corrective_actions(organization_id, status)
  WHERE status != 'completed';
