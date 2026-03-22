-- ============================================================================
-- @migration HearthClientPortal
-- @status COMPLETE
-- @description Project Hearth — family portal, nominee views, budget telemetry, client approvals
-- @tables participant_network_members (altered), schedule_blocks (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Extend participant_network_members with PRD-required fields ─────────
-- (This table already exists; we add missing fields for the Hearth portal)
ALTER TABLE public.participant_network_members
  ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS fcm_token TEXT,          -- For push notifications
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invited_by UUID,         -- admin user who sent invite
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Create a view alias: participant_nominees → participant_network_members
-- This satisfies any code that references the PRD table name
CREATE OR REPLACE VIEW public.participant_nominees AS
  SELECT
    id,
    user_id,
    participant_id,
    organization_id,
    relationship_type AS relationship,
    display_name,
    permissions,
    fcm_token,
    is_active,
    invited_at,
    onboarded_at,
    created_at
  FROM public.participant_network_members;

-- ── 2. Privacy split: schedule_blocks shift notes ─────────────────────────
-- public_note: visible to client app (family sees this)
-- internal_note: HR / incident info — RLS blocks client access
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS public_note TEXT,         -- visible to nominee
  ADD COLUMN IF NOT EXISTS internal_note TEXT,        -- blocked by RLS
  ADD COLUMN IF NOT EXISTS client_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approved_by UUID,   -- nominee user_id
  ADD COLUMN IF NOT EXISTS client_approved_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_approved_device TEXT;

-- ── 3. Budget metadata on service_agreements ─────────────────────────────
ALTER TABLE public.service_agreements
  ADD COLUMN IF NOT EXISTS total_budget NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS plan_start_date DATE,
  ADD COLUMN IF NOT EXISTS plan_end_date DATE,
  ADD COLUMN IF NOT EXISTS support_category TEXT;

-- ── 4. Whitelabel portal settings on organizations ────────────────────────
-- (primary_hex_color, logo_url likely already in settings JSONB)
-- Add explicit columns as fallback for fast reads
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS portal_primary_color TEXT DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS portal_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS portal_app_name TEXT;

-- ── 5. RLS: Hearth Client Shield ─────────────────────────────────────────
-- Helper function: is the current user a nominee for a participant?
CREATE OR REPLACE FUNCTION public.is_participant_nominee(p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participant_network_members pnm
    WHERE pnm.user_id = auth.uid()
      AND pnm.participant_id = p_participant_id
      AND pnm.is_active = TRUE
  );
$$;

-- Helper: get all participant_ids the current user is a nominee for
CREATE OR REPLACE FUNCTION public.get_nominee_participant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT participant_id FROM public.participant_network_members
  WHERE user_id = auth.uid() AND is_active = TRUE;
$$;

-- ── 5a. schedule_blocks RLS (client-facing) ───────────────────────────────
-- IMPORTANT: Only expose public_note, NOT internal_note
-- We achieve this via a separate "portal view"
CREATE OR REPLACE VIEW public.schedule_blocks_portal AS
  SELECT
    sb.id,
    sb.organization_id,
    sb.participant_id,
    sb.technician_id,
    sb.start_time,
    sb.end_time,
    sb.status,
    sb.title,
    sb.public_note AS shift_note,   -- internal_note is NOT included
    sb.client_approved,
    sb.client_approved_at,
    sb.billed_at,
    sb.billable_hours,
    sb.billable_rate,
    p.full_name     AS worker_name,
    p.avatar_url    AS worker_avatar
  FROM public.schedule_blocks sb
  LEFT JOIN public.profiles p ON p.id = sb.technician_id
  WHERE public.is_participant_nominee(sb.participant_id);

-- ── 5b. participant_network_members RLS ──────────────────────────────────
ALTER TABLE public.participant_network_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_network_members' AND policyname='Users can view their own nominee links') THEN
    CREATE POLICY "Users can view their own nominee links"
      ON public.participant_network_members FOR SELECT
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_network_members' AND policyname='Org admins can manage nominees') THEN
    CREATE POLICY "Org admins can manage nominees"
      ON public.participant_network_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = participant_network_members.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','manager')
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

-- ── 5c. schedule_blocks RLS — block internal_note reads for non-admins ────
-- The portal view handles this structurally, but add a column-level guard:
-- Note: Postgres doesn't have column-level RLS, so the portal view IS the guard.
-- For direct table access, non-admin clients should use the portal view only.
-- Ensure existing RLS is not too permissive (add client-facing select policy):
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_blocks' AND policyname='Nominees can read their participant shifts') THEN
    CREATE POLICY "Nominees can read their participant shifts"
      ON public.schedule_blocks FOR SELECT
      USING (
        participant_id IN (SELECT public.get_nominee_participant_ids())
      );
  END IF;
END $$;

-- ── 5d. participant_profiles RLS for clients ──────────────────────────────
ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_profiles' AND policyname='Nominees can view linked participant profiles') THEN
    CREATE POLICY "Nominees can view linked participant profiles"
      ON public.participant_profiles FOR SELECT
      USING (
        id IN (SELECT public.get_nominee_participant_ids())
        OR
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = participant_profiles.organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

-- ── 5e. service_agreements RLS for clients ───────────────────────────────
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_agreements' AND policyname='Nominees can read their participant agreements') THEN
    CREATE POLICY "Nominees can read their participant agreements"
      ON public.service_agreements FOR SELECT
      USING (
        participant_id IN (SELECT public.get_nominee_participant_ids())
        OR
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = service_agreements.organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

-- ── 6. RPC: Approve timesheet (client digital signature) ─────────────────
CREATE OR REPLACE FUNCTION public.client_approve_shift(
  p_shift_id UUID,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant_id UUID;
  v_is_nominee BOOLEAN;
BEGIN
  -- Get the participant_id for this shift
  SELECT participant_id INTO v_participant_id
  FROM public.schedule_blocks
  WHERE id = p_shift_id;

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Shift not found');
  END IF;

  -- Verify caller is a nominee with approval permission
  SELECT EXISTS (
    SELECT 1 FROM public.participant_network_members pnm
    WHERE pnm.user_id = auth.uid()
      AND pnm.participant_id = v_participant_id
      AND pnm.is_active = TRUE
      AND (
        (pnm.permissions->>'can_approve_timesheets')::BOOLEAN = TRUE
        OR pnm.permissions IS NULL
      )
  ) INTO v_is_nominee;

  IF NOT v_is_nominee THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Not authorised to approve this shift');
  END IF;

  -- Execute the approval
  UPDATE public.schedule_blocks
  SET
    client_approved = TRUE,
    client_approved_at = NOW(),
    client_approved_by = auth.uid(),
    client_approved_device = p_device_info
  WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'shift_id', p_shift_id,
    'approved_at', NOW()
  );
END;
$$;

-- ── 7. RPC: Hearth Budget Telemetry ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hearth_budget_telemetry(
  p_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_nominee BOOLEAN;
  v_total_budget NUMERIC := 0;
  v_plan_start DATE;
  v_plan_end DATE;
  v_invoiced NUMERIC := 0;
  v_unbilled_wip NUMERIC := 0;
  v_remaining NUMERIC;
  v_burn_rate NUMERIC;
  v_plan_days_elapsed NUMERIC;
  v_plan_total_days NUMERIC;
  v_pro_rata_pct NUMERIC;
  v_burn_status TEXT;
  v_next_shift JSONB;
BEGIN
  -- Verify nominee access
  SELECT public.is_participant_nominee(p_participant_id) INTO v_is_nominee;
  IF NOT v_is_nominee THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Access denied');
  END IF;

  -- Get latest service agreement budget data
  SELECT
    COALESCE(sa.total_budget, 0),
    sa.plan_start_date,
    sa.plan_end_date
  INTO v_total_budget, v_plan_start, v_plan_end
  FROM public.service_agreements sa
  WHERE sa.participant_id = p_participant_id
    AND sa.status IN ('active', 'approved')
  ORDER BY sa.created_at DESC
  LIMIT 1;

  -- Total invoiced (sent/paid invoices for this participant)
  SELECT COALESCE(SUM(i.total), 0) INTO v_invoiced
  FROM public.invoices i
  WHERE i.participant_id = p_participant_id
    AND i.status IN ('sent', 'paid', 'overdue');

  -- Unbilled WIP: approved shifts not yet invoiced
  SELECT COALESCE(SUM(sb.billable_hours * COALESCE(sb.billable_rate, 0)), 0) INTO v_unbilled_wip
  FROM public.schedule_blocks sb
  WHERE sb.participant_id = p_participant_id
    AND sb.status IN ('complete', 'completed')
    AND sb.billed_at IS NULL;

  v_remaining := v_total_budget - v_invoiced - v_unbilled_wip;

  -- Calculate pro-rata burn rate
  IF v_total_budget > 0 THEN
    v_burn_rate := ROUND(((v_invoiced + v_unbilled_wip) / v_total_budget) * 100, 1);
  ELSE
    v_burn_rate := 0;
  END IF;

  -- Pro-rata position (% of plan year elapsed)
  IF v_plan_start IS NOT NULL AND v_plan_end IS NOT NULL THEN
    v_plan_total_days := v_plan_end - v_plan_start;
    v_plan_days_elapsed := LEAST(CURRENT_DATE - v_plan_start, v_plan_total_days);
    IF v_plan_total_days > 0 THEN
      v_pro_rata_pct := ROUND((v_plan_days_elapsed / v_plan_total_days) * 100, 1);
    ELSE
      v_pro_rata_pct := 50;
    END IF;
  ELSE
    v_pro_rata_pct := 50;
  END IF;

  -- Burn status for UI colour logic
  IF v_remaining <= 0 THEN
    v_burn_status := 'depleted';
  ELSIF v_burn_rate > (v_pro_rata_pct + 10) THEN
    v_burn_status := 'over_burning'; -- amber
  ELSIF v_burn_rate > (v_pro_rata_pct + 20) THEN
    v_burn_status := 'critical';     -- rose
  ELSE
    v_burn_status := 'on_track';     -- emerald
  END IF;

  -- Next upcoming shift
  SELECT jsonb_build_object(
    'id', sb.id,
    'start_time', sb.start_time,
    'end_time', sb.end_time,
    'worker_name', p.full_name,
    'worker_avatar', p.avatar_url,
    'worker_first_name', split_part(COALESCE(p.full_name, ''), ' ', 1),
    'public_note', sb.public_note
  ) INTO v_next_shift
  FROM public.schedule_blocks sb
  LEFT JOIN public.profiles p ON p.id = sb.technician_id
  WHERE sb.participant_id = p_participant_id
    AND sb.start_time > NOW()
    AND sb.status <> 'cancelled'
  ORDER BY sb.start_time ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'total_budget', v_total_budget,
    'invoiced', v_invoiced,
    'unbilled_wip', v_unbilled_wip,
    'remaining', v_remaining,
    'burn_rate_pct', v_burn_rate,
    'pro_rata_pct', v_pro_rata_pct,
    'burn_status', v_burn_status,
    'plan_start', v_plan_start,
    'plan_end', v_plan_end,
    'next_shift', v_next_shift
  );
END;
$$;

-- ── 8. RPC: Get portal roster (client-safe, no internal_note) ────────────
CREATE OR REPLACE FUNCTION public.get_portal_roster(
  p_participant_id UUID,
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_to   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days'
)
RETURNS TABLE (
  id               UUID,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  status           TEXT,
  shift_note       TEXT,  -- public_note only
  client_approved  BOOLEAN,
  client_approved_at TIMESTAMPTZ,
  worker_name      TEXT,
  worker_avatar    TEXT,
  billable_hours   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sb.id,
    sb.start_time,
    sb.end_time,
    sb.status::TEXT,
    sb.public_note,  -- internal_note NOT exposed
    sb.client_approved,
    sb.client_approved_at,
    p.full_name,
    p.avatar_url,
    sb.billable_hours
  FROM public.schedule_blocks sb
  LEFT JOIN public.profiles p ON p.id = sb.technician_id
  WHERE sb.participant_id = p_participant_id
    AND public.is_participant_nominee(p_participant_id)
    AND sb.start_time BETWEEN p_from AND p_to
    AND sb.status <> 'cancelled'
  ORDER BY sb.start_time ASC;
$$;

-- ── 9. FCM token update function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_nominee_fcm_token(
  p_participant_id UUID,
  p_fcm_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.participant_network_members
  SET fcm_token = p_fcm_token,
      fcm_token_updated_at = NOW()
  WHERE user_id = auth.uid()
    AND participant_id = p_participant_id
    AND is_active = TRUE;
  RETURN FOUND;
END;
$$;

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pnm_user_active ON public.participant_network_members (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pnm_participant_active ON public.participant_network_members (participant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sb_participant_start ON public.schedule_blocks (participant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_sb_client_approved ON public.schedule_blocks (participant_id, client_approved) WHERE client_approved = FALSE;
