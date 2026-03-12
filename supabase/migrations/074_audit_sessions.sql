-- ============================================================================
-- Migration 074: Audit Sessions (Project Nightingale Phase 4)
-- Time-limited magic link audit portal for NDIS Quality & Safeguards audits.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Audit Sessions Table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  generated_by          uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  title                 text NOT NULL DEFAULT 'NDIS Audit Export',
  magic_link_token      text UNIQUE,
  expires_at            timestamptz NOT NULL,
  scope_type            text NOT NULL CHECK (scope_type IN ('participant', 'organization', 'date_range')),
  scope_participant_id  uuid REFERENCES public.participant_profiles ON DELETE SET NULL,
  scope_date_from       date,
  scope_date_to         date,
  dossier_urls          text[] DEFAULT '{}',                   -- Storage paths to generated PDFs
  accessed_count        int DEFAULT 0,
  last_accessed_at      timestamptz,
  watermark_text        text,                                  -- e.g., "CONFIDENTIAL — BrightPath Care"
  is_revoked            boolean DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_token
  ON public.audit_sessions (magic_link_token)
  WHERE magic_link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_sessions_org
  ON public.audit_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_expires
  ON public.audit_sessions (expires_at)
  WHERE is_revoked = false;

-- ─── 2. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS Policies ────────────────────────────────────────────────────────

-- Only admin/owner roles can view and manage audit sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_sessions' AND policyname = 'Admins can view audit sessions') THEN
    CREATE POLICY "Admins can view audit sessions"
      ON public.audit_sessions FOR SELECT
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = audit_sessions.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_sessions' AND policyname = 'Admins can manage audit sessions') THEN
    CREATE POLICY "Admins can manage audit sessions"
      ON public.audit_sessions FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = audit_sessions.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin')
      );
  END IF;
END $$;

-- ─── 4. Helper: Increment audit access count ─────────────────────────────

CREATE OR REPLACE FUNCTION public.record_audit_access(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session
  FROM public.audit_sessions
  WHERE magic_link_token = p_token
    AND is_revoked = false
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Session not found, expired, or revoked');
  END IF;

  UPDATE public.audit_sessions
  SET accessed_count = accessed_count + 1,
      last_accessed_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'valid', true,
    'organization_id', v_session.organization_id,
    'scope_type', v_session.scope_type,
    'scope_participant_id', v_session.scope_participant_id,
    'scope_date_from', v_session.scope_date_from,
    'scope_date_to', v_session.scope_date_to,
    'watermark_text', v_session.watermark_text,
    'dossier_urls', to_jsonb(v_session.dossier_urls)
  );
END;
$$;

-- ─── 5. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.audit_sessions IS
  'Time-limited magic-link audit sessions for NDIS Quality & Safeguards Commission audits. Tracks access and provides scoped, read-only data access.';
