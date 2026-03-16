-- ============================================================================
-- Migration 088: Project Glasshouse - Family & Participant Portal
-- Polymorphic RBAC portal, dual-note visibility, secure family document vault.
-- ============================================================================

-- ─── 1) Link external family/participant users to participants ───────────────
CREATE TABLE IF NOT EXISTS public.participant_network_members (
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (
    relationship_type IN ('primary_guardian', 'secondary_guardian', 'self', 'external_coordinator')
  ),
  permissions jsonb NOT NULL DEFAULT '{"can_cancel_shifts": true, "can_sign_documents": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_network_members_user
  ON public.participant_network_members (user_id);

ALTER TABLE public.participant_network_members ENABLE ROW LEVEL SECURITY;

-- ─── 2) Participant visibility settings ───────────────────────────────────────
ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS share_observations_with_family boolean DEFAULT false;

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS require_family_note_approval boolean DEFAULT false;

-- ─── 3) Dual-note architecture on progress notes ──────────────────────────────
ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS internal_narrative text;

ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS family_facing_narrative text;

ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS is_published_to_portal boolean DEFAULT false;

ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS family_note_approval_status text
    DEFAULT 'approved'
    CHECK (family_note_approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.progress_notes
SET internal_narrative = COALESCE(
  internal_narrative,
  NULLIF(
    trim(
      concat_ws(
        E'\n\n',
        context_of_support,
        outcomes_achieved,
        risks_identified
      )
    ),
    ''
  ),
  'Internal narrative not provided.'
)
WHERE internal_narrative IS NULL;

ALTER TABLE public.progress_notes
  ALTER COLUMN internal_narrative SET DEFAULT 'Internal narrative not provided.';

ALTER TABLE public.progress_notes
  ALTER COLUMN internal_narrative SET NOT NULL;

-- ─── 4) Family document vault + e-signatures ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.participant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'pending_signature', 'signed')),
  is_visible_to_family boolean NOT NULL DEFAULT false,
  requires_signature boolean NOT NULL DEFAULT false,
  signed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_at timestamptz,
  signature_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participant_documents_participant
  ON public.participant_documents (participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participant_documents_visible
  ON public.participant_documents (participant_id, is_visible_to_family, status);

ALTER TABLE public.participant_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_participant_documents_updated_at') THEN
    CREATE TRIGGER set_participant_documents_updated_at
      BEFORE UPDATE ON public.participant_documents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 5) Cancellation consent audit trail ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_shift_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  schedule_block_id uuid NOT NULL REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  is_short_notice boolean NOT NULL DEFAULT false,
  warning_acknowledged boolean NOT NULL DEFAULT false,
  reason text,
  request_ip inet,
  request_user_agent text
);

CREATE INDEX IF NOT EXISTS idx_portal_shift_cancellations_block
  ON public.portal_shift_cancellations (schedule_block_id, requested_at DESC);

ALTER TABLE public.portal_shift_cancellations ENABLE ROW LEVEL SECURITY;

-- ─── 6) Family-safe progress note view ────────────────────────────────────────
CREATE OR REPLACE VIEW public.family_progress_notes
WITH (security_barrier = true) AS
SELECT
  pn.id,
  pn.organization_id,
  pn.participant_id,
  pn.job_id AS shift_id,
  pn.worker_id,
  pn.family_facing_narrative AS narrative,
  pn.created_at
FROM public.progress_notes pn
WHERE pn.is_published_to_portal = true
  AND pn.family_facing_narrative IS NOT NULL
  AND pn.family_note_approval_status = 'approved';

GRANT SELECT ON public.family_progress_notes TO authenticated;

-- ─── 7) RLS policies for family network and portal data ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'participant_network_members'
      AND policyname = 'Users can view own participant links'
  ) THEN
    CREATE POLICY "Users can view own participant links"
      ON public.participant_network_members
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'participant_network_members'
      AND policyname = 'Org admins manage participant links'
  ) THEN
    CREATE POLICY "Org admins manage participant links"
      ON public.participant_network_members
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.participant_profiles pp
          JOIN public.organization_members om
            ON om.organization_id = pp.organization_id
          WHERE pp.id = participant_network_members.participant_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('owner', 'admin', 'manager', 'office_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'participant_documents'
      AND policyname = 'Family can view visible participant documents'
  ) THEN
    CREATE POLICY "Family can view visible participant documents"
      ON public.participant_documents
      FOR SELECT
      USING (
        is_visible_to_family = true
        AND EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          WHERE pnm.participant_id = participant_documents.participant_id
            AND pnm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'participant_documents'
      AND policyname = 'Org admins manage participant documents'
  ) THEN
    CREATE POLICY "Org admins manage participant documents"
      ON public.participant_documents
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_members om
          WHERE om.organization_id = participant_documents.organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('owner', 'admin', 'manager', 'office_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_shift_cancellations'
      AND policyname = 'Family can log linked shift cancellations'
  ) THEN
    CREATE POLICY "Family can log linked shift cancellations"
      ON public.portal_shift_cancellations
      FOR INSERT
      WITH CHECK (
        requested_by_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          WHERE pnm.participant_id = portal_shift_cancellations.participant_id
            AND pnm.user_id = auth.uid()
            AND COALESCE((pnm.permissions->>'can_cancel_shifts')::boolean, true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_shift_cancellations'
      AND policyname = 'Users can view own shift cancellation logs'
  ) THEN
    CREATE POLICY "Users can view own shift cancellation logs"
      ON public.portal_shift_cancellations
      FOR SELECT
      USING (requested_by_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_blocks'
      AND policyname = 'Family can view linked participant shifts'
  ) THEN
    CREATE POLICY "Family can view linked participant shifts"
      ON public.schedule_blocks
      FOR SELECT
      USING (
        participant_id IS NOT NULL
        AND status IN ('scheduled', 'en_route', 'on_site', 'in_progress', 'complete')
        AND EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          WHERE pnm.participant_id = schedule_blocks.participant_id
            AND pnm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_agreements'
      AND policyname = 'Family can view linked participant agreements'
  ) THEN
    CREATE POLICY "Family can view linked participant agreements"
      ON public.service_agreements
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          WHERE pnm.participant_id = service_agreements.participant_id
            AND pnm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'health_observations'
      AND policyname = 'Family can view shared participant observations'
  ) THEN
    CREATE POLICY "Family can view shared participant observations"
      ON public.health_observations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          JOIN public.participant_profiles pp
            ON pp.id = pnm.participant_id
          WHERE pnm.user_id = auth.uid()
            AND pnm.participant_id = health_observations.participant_id
            AND pp.share_observations_with_family = true
        )
      );
  END IF;
END $$;

-- ─── 8) Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE public.participant_network_members IS
  'Maps family/participant users to one or more participant profiles with per-link permissions.';

COMMENT ON VIEW public.family_progress_notes IS
  'Family-safe projection of progress notes exposing only approved family-facing narratives.';

COMMENT ON TABLE public.portal_shift_cancellations IS
  'Immutable audit trail for portal-initiated shift cancellation consent events.';
