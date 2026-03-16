-- ═══════════════════════════════════════════════════════════════════
-- Migration 109: Project Persona — Participant Hub Expansion
-- ═══════════════════════════════════════════════════════════════════
-- Adds missing profile columns, emergency contacts table,
-- participant communication logs (handover chat), and RLS.

-- ── 1. Expand participant_profiles with missing PRD columns ──────
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS key_safe_code text,
  ADD COLUMN IF NOT EXISTS access_instructions text;

-- ── 2. Emergency Contacts (One-to-Many, replaces jsonb column) ───
CREATE TABLE IF NOT EXISTS public.participant_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  phone_number text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view emergency contacts"
  ON public.participant_emergency_contacts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_emergency_contacts.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Managers can manage emergency contacts"
  ON public.participant_emergency_contacts FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_emergency_contacts.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_emergency_contacts.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 3. Participant Communication Logs (Handover Chat) ────────────
CREATE TABLE IF NOT EXISTS public.participant_communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message text NOT NULL,
  is_pinned boolean DEFAULT false,
  pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pinned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view comm logs"
  ON public.participant_communication_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_communication_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can insert comm logs"
  ON public.participant_communication_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_communication_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Authors and managers can update comm logs"
  ON public.participant_communication_logs FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = participant_communication_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 4. Break-Glass Emergency Access Audit Log ────────────────────
CREATE TABLE IF NOT EXISTS public.break_glass_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  reason text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.break_glass_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can insert break glass"
  ON public.break_glass_access_log FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Managers can view break glass logs"
  ON public.break_glass_access_log FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = break_glass_access_log.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 5. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_participant
  ON public.participant_emergency_contacts(participant_id);

CREATE INDEX IF NOT EXISTS idx_comm_logs_participant_created
  ON public.participant_communication_logs(participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_break_glass_worker
  ON public.break_glass_access_log(worker_id, granted_at DESC);
