-- ============================================================================
-- @migration CerberusGate
-- @status COMPLETE
-- @description Project Cerberus-Gate: Dynamic compliance rules engine.
--   Pre-start and post-completion gates for jobs/shifts. Override PIN system
--   with full audit trail. Offline-first via Vault-Sync replication.
-- @tables compliance_rules (NEW), compliance_overrides (NEW), compliance_override_pins (NEW)
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gate_trigger_enum') THEN
    CREATE TYPE public.gate_trigger_enum AS ENUM ('PRE_START', 'POST_COMPLETION');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gate_rule_type_enum') THEN
    CREATE TYPE public.gate_rule_type_enum AS ENUM (
      'FORM_SUBMISSION', 'MEDIA_CAPTURE', 'PROGRESS_NOTE',
      'EMAR_SIGN_OFF', 'CLIENT_SIGNATURE', 'SWMS_REQUIRED',
      'SUBTASK_COMPLETION'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_target_enum') THEN
    CREATE TYPE public.entity_target_enum AS ENUM (
      'GLOBAL', 'JOB_LABEL', 'CLIENT_TAG', 'SPECIFIC_JOB', 'CARE_PLAN_TYPE'
    );
  END IF;
END $$;

-- ─── 2. Compliance Rules Table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,

  trigger_state         public.gate_trigger_enum NOT NULL,
  rule_type             public.gate_rule_type_enum NOT NULL,
  config_jsonb          JSONB NOT NULL DEFAULT '{}',

  target_entity_type    public.entity_target_enum NOT NULL DEFAULT 'GLOBAL',
  target_entity_id      UUID,
  target_label          TEXT,

  is_hard_block         BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  priority              INTEGER NOT NULL DEFAULT 0,

  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_org
  ON public.compliance_rules (organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_compliance_rules_trigger
  ON public.compliance_rules (organization_id, trigger_state, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_compliance_rules_target
  ON public.compliance_rules (target_entity_type, target_entity_id)
  WHERE is_active = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_compliance_rules_updated_at') THEN
    CREATE TRIGGER set_compliance_rules_updated_at
      BEFORE UPDATE ON public.compliance_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Compliance Overrides (Audit Log) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_overrides (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id                 UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  worker_id               UUID NOT NULL REFERENCES public.profiles(id),
  job_id                  UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  shift_id                UUID,

  override_type           TEXT NOT NULL DEFAULT 'SOFT_STOP',
  justification           TEXT NOT NULL,
  authorized_by_admin_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pin_id                  UUID,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_overrides_org
  ON public.compliance_overrides (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_job
  ON public.compliance_overrides (job_id);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_worker
  ON public.compliance_overrides (worker_id, created_at DESC);

-- ─── 4. Override PIN Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_override_pins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id            UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  generated_by      UUID NOT NULL REFERENCES public.profiles(id),
  pin_hash          TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  is_used           BOOLEAN NOT NULL DEFAULT false,
  used_at           TIMESTAMPTZ,
  used_by           UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_override_pins_job
  ON public.compliance_override_pins (job_id, is_used) WHERE is_used = false;

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_override_pins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_rules' AND policyname = 'Org members can view rules') THEN
    CREATE POLICY "Org members can view rules"
      ON public.compliance_rules FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_rules' AND policyname = 'Admins can manage rules') THEN
    CREATE POLICY "Admins can manage rules"
      ON public.compliance_rules FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = compliance_rules.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_overrides' AND policyname = 'Org members can view overrides') THEN
    CREATE POLICY "Org members can view overrides"
      ON public.compliance_overrides FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_overrides' AND policyname = 'Workers can create overrides') THEN
    CREATE POLICY "Workers can create overrides"
      ON public.compliance_overrides FOR INSERT
      WITH CHECK (worker_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_override_pins' AND policyname = 'Admins can manage pins') THEN
    CREATE POLICY "Admins can manage pins"
      ON public.compliance_override_pins FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = compliance_override_pins.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 6. Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_overrides;

-- ─── 7. RPCs ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_rules_for_job(
  p_organization_id UUID,
  p_job_id UUID,
  p_trigger_state public.gate_trigger_enum DEFAULT NULL
)
RETURNS SETOF public.compliance_rules
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_job_labels TEXT[];
  v_client_id UUID;
BEGIN
  SELECT labels, client_id
  INTO v_job_labels, v_client_id
  FROM public.jobs
  WHERE id = p_job_id;

  RETURN QUERY
  SELECT cr.*
  FROM public.compliance_rules cr
  WHERE cr.organization_id = p_organization_id
    AND cr.is_active = true
    AND (p_trigger_state IS NULL OR cr.trigger_state = p_trigger_state)
    AND (
      cr.target_entity_type = 'GLOBAL'
      OR (cr.target_entity_type = 'SPECIFIC_JOB' AND cr.target_entity_id = p_job_id)
      OR (cr.target_entity_type = 'JOB_LABEL' AND cr.target_label = ANY(v_job_labels))
      OR (cr.target_entity_type = 'CLIENT_TAG' AND cr.target_entity_id = v_client_id)
    )
  ORDER BY cr.priority DESC, cr.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_override_pin(
  p_organization_id UUID,
  p_job_id UUID,
  p_pin_hash TEXT,
  p_ttl_minutes INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin_id UUID;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
    AND status = 'active';

  IF v_role NOT IN ('owner', 'admin', 'manager', 'office_admin') THEN
    RAISE EXCEPTION 'Insufficient privileges to generate override PIN';
  END IF;

  INSERT INTO public.compliance_override_pins (
    organization_id, job_id, generated_by, pin_hash, expires_at
  ) VALUES (
    p_organization_id,
    p_job_id,
    auth.uid(),
    p_pin_hash,
    now() + (p_ttl_minutes || ' minutes')::interval
  )
  RETURNING id INTO v_pin_id;

  RETURN v_pin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_override_pin(
  p_job_id UUID,
  p_pin_hash TEXT,
  p_worker_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pin RECORD;
BEGIN
  SELECT * INTO v_pin
  FROM public.compliance_override_pins
  WHERE job_id = p_job_id
    AND pin_hash = p_pin_hash
    AND is_used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pin IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired PIN');
  END IF;

  UPDATE public.compliance_override_pins
  SET is_used = true, used_at = now(), used_by = p_worker_id
  WHERE id = v_pin.id;

  RETURN jsonb_build_object(
    'valid', true,
    'pin_id', v_pin.id,
    'admin_id', v_pin.generated_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_compliance_stats(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_rules', (SELECT COUNT(*) FROM public.compliance_rules WHERE organization_id = p_organization_id AND is_active = true),
    'pre_start_rules', (SELECT COUNT(*) FROM public.compliance_rules WHERE organization_id = p_organization_id AND is_active = true AND trigger_state = 'PRE_START'),
    'post_completion_rules', (SELECT COUNT(*) FROM public.compliance_rules WHERE organization_id = p_organization_id AND is_active = true AND trigger_state = 'POST_COMPLETION'),
    'hard_blocks', (SELECT COUNT(*) FROM public.compliance_rules WHERE organization_id = p_organization_id AND is_active = true AND is_hard_block = true),
    'overrides_7d', (SELECT COUNT(*) FROM public.compliance_overrides WHERE organization_id = p_organization_id AND created_at > now() - interval '7 days'),
    'overrides_30d', (SELECT COUNT(*) FROM public.compliance_overrides WHERE organization_id = p_organization_id AND created_at > now() - interval '30 days')
  );
END;
$$;

COMMENT ON TABLE public.compliance_rules IS
  'Project Cerberus-Gate: Dynamic compliance rules engine for pre-start and post-completion gates.';
COMMENT ON TABLE public.compliance_overrides IS
  'Project Cerberus-Gate: Audit trail for bypassed compliance rules.';
COMMENT ON TABLE public.compliance_override_pins IS
  'Project Cerberus-Gate: Time-limited admin override PINs for hard-block bypass.';
