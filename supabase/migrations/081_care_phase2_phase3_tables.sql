-- ============================================================================
-- @migration CarePhase2Phase3Tables
-- @status COMPLETE
-- @description Behaviour plans, restrictive practices, CI actions, policy governance, onboarding
-- @tables behaviour_support_plans, restrictive_practices, ci_actions, policy_documents, worker_onboarding_checklists, support_coordination_cases
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── Phase 2: Behaviour Support Plans ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.behaviour_support_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'under_review', 'expired', 'archived')),
  author_name text,
  author_role text,
  start_date date,
  review_date date,
  next_review_date date,

  -- Clinical detail
  target_behaviours jsonb DEFAULT '[]'::jsonb,
  -- Array of: { behaviour: string, function: string, frequency: string, intensity: string }
  triggers jsonb DEFAULT '[]'::jsonb,
  -- Array of: { trigger: string, category: 'environmental' | 'emotional' | 'physical' | 'social' }
  prevention_strategies jsonb DEFAULT '[]'::jsonb,
  -- Array of: { strategy: string, context: string }
  response_strategies jsonb DEFAULT '[]'::jsonb,
  -- Array of: { strategy: string, stage: 'early_warning' | 'escalation' | 'crisis' | 'post_incident' }
  reinforcement_strategies jsonb DEFAULT '[]'::jsonb,

  -- Governance
  approved_by uuid,
  approved_at timestamptz,
  consent_obtained boolean DEFAULT false,
  consent_date date,
  document_url text,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsp_org ON public.behaviour_support_plans (organization_id);
CREATE INDEX IF NOT EXISTS idx_bsp_participant ON public.behaviour_support_plans (participant_id);

ALTER TABLE public.behaviour_support_plans ENABLE ROW LEVEL SECURITY;

-- ── Behaviour Events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.behaviour_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  bsp_id uuid REFERENCES public.behaviour_support_plans(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL,
  shift_id uuid,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  behaviour_type text NOT NULL,
  intensity text CHECK (intensity IN ('low', 'moderate', 'high', 'extreme')),
  triggers_identified text[],
  antecedent text,
  behaviour_description text NOT NULL,
  consequence text,
  strategies_used text[],
  outcome text,

  -- Restrictive practice linkage
  restrictive_practice_used boolean DEFAULT false,
  restrictive_practice_id uuid,

  -- Incident linkage
  linked_incident_id uuid,

  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bevents_org ON public.behaviour_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_bevents_participant ON public.behaviour_events (participant_id);

ALTER TABLE public.behaviour_events ENABLE ROW LEVEL SECURITY;

-- ── Restrictive Practices Register ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restrictive_practices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  behaviour_event_id uuid REFERENCES public.behaviour_events(id) ON DELETE SET NULL,
  worker_id uuid NOT NULL,
  shift_id uuid,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  practice_type text NOT NULL CHECK (practice_type IN (
    'physical_restraint', 'mechanical_restraint', 'chemical_restraint',
    'seclusion', 'environmental_restraint', 'psychosocial_restraint'
  )),
  authorised_in_bsp boolean DEFAULT false,
  duration_minutes integer,
  reason text NOT NULL,
  description text NOT NULL,
  outcome text,

  -- Governance review
  review_required boolean DEFAULT true,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_outcome text,
  review_notes text,

  -- Debrief
  debrief_completed boolean DEFAULT false,
  debrief_date date,
  debrief_notes text,

  -- Linked incident
  linked_incident_id uuid,

  -- Reportable to NDIS Commission
  reportable boolean DEFAULT false,
  reported_to_commission boolean DEFAULT false,
  reported_at timestamptz,

  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rp_org ON public.restrictive_practices (organization_id);
CREATE INDEX IF NOT EXISTS idx_rp_participant ON public.restrictive_practices (participant_id);

ALTER TABLE public.restrictive_practices ENABLE ROW LEVEL SECURITY;

-- ── Phase 3: Continuous Improvement Actions ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ci_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN (
    'incident', 'complaint', 'audit', 'risk_review',
    'restrictive_practice', 'governance_decision', 'staff_feedback', 'other'
  )),
  source_id uuid,
  source_reference text,

  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  owner_id uuid,
  owner_name text,
  due_date date,
  completed_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,

  evidence jsonb DEFAULT '[]'::jsonb,
  -- Array of: { filename: string, url: string, uploaded_at: string }

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ci_org ON public.ci_actions (organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_status ON public.ci_actions (status);

ALTER TABLE public.ci_actions ENABLE ROW LEVEL SECURITY;

-- ── Phase 3: Policy & Document Governance ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.policy_register (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('clinical', 'hr', 'governance', 'safety', 'operational', 'finance', 'privacy')),
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'current' CHECK (status IN ('draft', 'current', 'under_review', 'archived', 'superseded')),

  content text,
  document_url text,
  effective_date date,
  review_date date,

  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,

  requires_acknowledgement boolean DEFAULT true,
  acknowledgement_deadline date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_org ON public.policy_register (organization_id);

ALTER TABLE public.policy_register ENABLE ROW LEVEL SECURITY;

-- ── Policy Acknowledgements ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.policy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.policy_register(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  policy_version text NOT NULL,

  UNIQUE(policy_id, user_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_ack_policy ON public.policy_acknowledgements (policy_id);

ALTER TABLE public.policy_acknowledgements ENABLE ROW LEVEL SECURITY;

-- ── Phase 3: Governance Meeting Minutes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.governance_meetings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title text NOT NULL,
  meeting_type text DEFAULT 'governance' CHECK (meeting_type IN ('governance', 'clinical', 'whs', 'quality', 'operational')),
  meeting_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),

  attendees jsonb DEFAULT '[]'::jsonb,
  -- Array of: { name: string, role: string, present: boolean }

  agenda text,
  minutes text,

  decisions jsonb DEFAULT '[]'::jsonb,
  -- Array of: { decision: string, moved_by: string, seconded_by: string }

  actions_generated jsonb DEFAULT '[]'::jsonb,
  -- Array of: { action: string, owner: string, due_date: string, ci_action_id?: string }

  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gov_meetings_org ON public.governance_meetings (organization_id);

ALTER TABLE public.governance_meetings ENABLE ROW LEVEL SECURITY;

-- ── Phase 1 Enhancement: Worker Onboarding Checklists ────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'authorised')),

  -- Checklist items tracked as JSONB
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { key: string, label: string, required: boolean, completed: boolean, completed_at?: string, evidence_url?: string }

  signed_off_by uuid,
  signed_off_at timestamptz,
  authorised_to_work boolean DEFAULT false,
  authorised_at timestamptz,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboard_org ON public.onboarding_checklists (organization_id);
CREATE INDEX IF NOT EXISTS idx_onboard_user ON public.onboarding_checklists (user_id);

ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;

-- ── Phase 2: Support Coordination Cases ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_coordination_cases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  coordinator_id uuid NOT NULL,

  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'closed', 'transferred')),
  case_type text DEFAULT 'support_coordination' CHECK (case_type IN ('support_coordination', 'specialist_support_coordination', 'psychosocial_recovery')),

  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  closure_reason text,
  closure_outcome text,

  -- Goals chain
  goals jsonb DEFAULT '[]'::jsonb,
  -- Array of: { id: string, goal: string, actions: { action: string, status: string, due_date?: string }[], outcome?: string, status: 'active'|'achieved'|'modified'|'discontinued' }

  -- Contact log
  contacts jsonb DEFAULT '[]'::jsonb,
  -- Array of: { date: string, type: 'phone'|'email'|'meeting'|'visit', with: string, summary: string, duration_minutes?: number }

  -- Referrals
  referrals jsonb DEFAULT '[]'::jsonb,
  -- Array of: { provider: string, service_type: string, date: string, status: 'pending'|'accepted'|'declined', notes?: string }

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sc_cases_org ON public.support_coordination_cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_sc_cases_participant ON public.support_coordination_cases (participant_id);

ALTER TABLE public.support_coordination_cases ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies (all tables follow org-member pattern) ──────────────────────

DO $$
BEGIN
  -- Behaviour Support Plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'behaviour_support_plans' AND policyname = 'Org members manage BSPs') THEN
    EXECUTE 'CREATE POLICY "Org members manage BSPs" ON public.behaviour_support_plans FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = behaviour_support_plans.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Behaviour Events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'behaviour_events' AND policyname = 'Org members manage behaviour events') THEN
    EXECUTE 'CREATE POLICY "Org members manage behaviour events" ON public.behaviour_events FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = behaviour_events.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Restrictive Practices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restrictive_practices' AND policyname = 'Org members manage restrictive practices') THEN
    EXECUTE 'CREATE POLICY "Org members manage restrictive practices" ON public.restrictive_practices FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = restrictive_practices.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- CI Actions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ci_actions' AND policyname = 'Org members manage CI actions') THEN
    EXECUTE 'CREATE POLICY "Org members manage CI actions" ON public.ci_actions FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = ci_actions.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Policy Register
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'policy_register' AND policyname = 'Org members manage policies') THEN
    EXECUTE 'CREATE POLICY "Org members manage policies" ON public.policy_register FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = policy_register.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Policy Acknowledgements
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'policy_acknowledgements' AND policyname = 'Org members manage acknowledgements') THEN
    EXECUTE 'CREATE POLICY "Org members manage acknowledgements" ON public.policy_acknowledgements FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = policy_acknowledgements.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Governance Meetings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_meetings' AND policyname = 'Org members manage governance meetings') THEN
    EXECUTE 'CREATE POLICY "Org members manage governance meetings" ON public.governance_meetings FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = governance_meetings.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Onboarding Checklists
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_checklists' AND policyname = 'Org members manage onboarding') THEN
    EXECUTE 'CREATE POLICY "Org members manage onboarding" ON public.onboarding_checklists FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = onboarding_checklists.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  -- Support Coordination Cases
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_coordination_cases' AND policyname = 'Org members manage SC cases') THEN
    EXECUTE 'CREATE POLICY "Org members manage SC cases" ON public.support_coordination_cases FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = support_coordination_cases.organization_id AND members.user_id = auth.uid())
    )';
  END IF;
END $$;

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.behaviour_support_plans IS 'Behaviour Support Plans (BSP) — Clinical safety plans for participants with complex behaviours. Phase 2.';
COMMENT ON TABLE public.behaviour_events IS 'Behaviour event logs linked to BSPs. Workers record occurrences during shifts. Phase 2.';
COMMENT ON TABLE public.restrictive_practices IS 'Restrictive practice register — Governance-tracked use of any restrictive intervention. Phase 2.';
COMMENT ON TABLE public.ci_actions IS 'Continuous Improvement actions sourced from incidents, audits, complaints. Phase 3.';
COMMENT ON TABLE public.policy_register IS 'Organisational policy documents with version control and staff acknowledgement. Phase 3.';
COMMENT ON TABLE public.policy_acknowledgements IS 'Staff acknowledgement records for policy documents. Phase 3.';
COMMENT ON TABLE public.governance_meetings IS 'Governance committee meeting minutes, decisions, and action tracking. Phase 3.';
COMMENT ON TABLE public.onboarding_checklists IS 'Worker onboarding checklists with sign-off workflow. Authorised-to-Work gate. Phase 1 enhancement.';
COMMENT ON TABLE public.support_coordination_cases IS 'Support Coordination case files with goals, contacts, referrals. Phase 2.';
