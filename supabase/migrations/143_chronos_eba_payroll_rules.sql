-- ============================================================================
-- @migration ChronosEBAPayrollRules
-- @status COMPLETE
-- @description Project Chronos-EBA — custom enterprise bargaining agreement rules engine
-- @tables eba_agreements, eba_rules, eba_rule_test_cases
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. ENUMs ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.eba_agreement_status AS ENUM ('DRAFT','TESTING','ACTIVE','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eba_rule_category AS ENUM (
    'PENALTY_RATE','ALLOWANCE_FIXED','OVERTIME_TRIGGER',
    'MINIMUM_ENGAGEMENT','TIME_RECLASSIFICATION','BROKEN_SHIFT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eba_stacking_behavior AS ENUM ('HIGHEST_WINS','COMPOUND','ADDITIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Payroll Agreements ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                  VARCHAR NOT NULL,
  description           TEXT,
  base_rate_matrix      JSONB DEFAULT '{}',
  status                public.eba_agreement_status DEFAULT 'DRAFT',
  effective_from        DATE,
  effective_to          DATE,
  version               INT DEFAULT 1,
  parent_agreement_id   UUID REFERENCES public.payroll_agreements(id),
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payroll_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage payroll agreements" ON public.payroll_agreements FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX IF NOT EXISTS idx_eba_agreements_org ON public.payroll_agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_eba_agreements_status ON public.payroll_agreements(organization_id, status);

-- ── 3. Payroll Rules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id          UUID NOT NULL REFERENCES public.payroll_agreements(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                  VARCHAR NOT NULL,
  description           TEXT,
  category              public.eba_rule_category NOT NULL DEFAULT 'PENALTY_RATE',
  priority_weight       INT NOT NULL DEFAULT 50,
  stacking_behavior     public.eba_stacking_behavior DEFAULT 'HIGHEST_WINS',
  is_active             BOOLEAN DEFAULT true,
  effective_from        DATE,
  effective_to          DATE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payroll_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage payroll rules" ON public.payroll_rules FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX IF NOT EXISTS idx_eba_rules_agreement ON public.payroll_rules(agreement_id);
CREATE INDEX IF NOT EXISTS idx_eba_rules_org ON public.payroll_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_eba_rules_priority ON public.payroll_rules(agreement_id, priority_weight DESC);

-- ── 4. Rule Logic (AST Storage) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.rule_logic (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id               UUID NOT NULL UNIQUE REFERENCES public.payroll_rules(id) ON DELETE CASCADE,
  conditions_ast        JSONB NOT NULL DEFAULT '{"operator":"AND","conditions":[]}',
  actions_ast           JSONB NOT NULL DEFAULT '{"action_type":"APPLY_MULTIPLIER","value":1.0,"pay_category_label":"BASE"}',
  version               INT DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rule_logic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage rule logic" ON public.rule_logic FOR ALL
  USING (rule_id IN (
    SELECT id FROM public.payroll_rules
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active')));

CREATE INDEX IF NOT EXISTS idx_rule_logic_rule ON public.rule_logic(rule_id);

-- ── 5. Simulation Log (Sandbox Audit) ───────────────────────
CREATE TABLE IF NOT EXISTS public.eba_simulation_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agreement_id          UUID NOT NULL REFERENCES public.payroll_agreements(id) ON DELETE CASCADE,
  simulated_by          UUID REFERENCES public.profiles(id),
  input_params          JSONB NOT NULL,
  output_pay_lines      JSONB NOT NULL DEFAULT '[]',
  debug_log             JSONB DEFAULT '[]',
  total_cost            NUMERIC(12,2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.eba_simulation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view simulations" ON public.eba_simulation_log FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 6. Link worker_pay_profiles to agreements ────────────────
ALTER TABLE public.worker_pay_profiles
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES public.payroll_agreements(id);

-- ── 7. RPC: Evaluate payroll rules (deterministic) ──────────
CREATE OR REPLACE FUNCTION public.get_eba_rules_for_evaluation(
  p_agreement_id UUID,
  p_eval_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rules JSON;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.priority_weight DESC) INTO v_rules
  FROM (
    SELECT
      pr.id, pr.name, pr.category, pr.priority_weight, pr.stacking_behavior,
      rl.conditions_ast, rl.actions_ast
    FROM public.payroll_rules pr
    JOIN public.rule_logic rl ON rl.rule_id = pr.id
    WHERE pr.agreement_id = p_agreement_id
      AND pr.is_active = true
      AND (pr.effective_from IS NULL OR pr.effective_from <= p_eval_date)
      AND (pr.effective_to IS NULL OR pr.effective_to >= p_eval_date)
    ORDER BY pr.priority_weight DESC
  ) t;
  RETURN COALESCE(v_rules, '[]'::json);
END;
$$;

-- ── 8. RPC: Dashboard stats ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_eba_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INT; v_draft INT; v_testing INT; v_active INT; v_archived INT;
  v_total_rules INT; v_simulations INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.payroll_agreements WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_draft FROM public.payroll_agreements WHERE organization_id = p_org_id AND status = 'DRAFT';
  SELECT COUNT(*) INTO v_testing FROM public.payroll_agreements WHERE organization_id = p_org_id AND status = 'TESTING';
  SELECT COUNT(*) INTO v_active FROM public.payroll_agreements WHERE organization_id = p_org_id AND status = 'ACTIVE';
  SELECT COUNT(*) INTO v_archived FROM public.payroll_agreements WHERE organization_id = p_org_id AND status = 'ARCHIVED';
  SELECT COUNT(*) INTO v_total_rules FROM public.payroll_rules WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_simulations FROM public.eba_simulation_log WHERE organization_id = p_org_id;
  RETURN json_build_object(
    'total_agreements', v_total, 'draft', v_draft, 'testing', v_testing,
    'active', v_active, 'archived', v_archived,
    'total_rules', v_total_rules, 'simulations_run', v_simulations
  );
END;
$$;

-- ── 9. Realtime ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_agreements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
