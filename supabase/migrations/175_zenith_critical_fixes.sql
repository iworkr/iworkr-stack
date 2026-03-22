-- ============================================================================
-- Migration 175: Zenith-Launch — Critical Database Fixes
-- Fixes: log_job_activity enum, low-stock trigger, get_member_stats column,
--        budget function SECURITY DEFINER, duplicate RLS policy cleanup
-- ============================================================================

-- ── 1. Fix log_job_activity: 'update' → 'note' (valid activity_type) ─────
CREATE OR REPLACE FUNCTION public.log_job_activity()
RETURNS trigger AS $$
DECLARE
  v_user_name text;
BEGIN
  SELECT COALESCE(p.full_name, 'System')
  INTO v_user_name
  FROM public.profiles p
  WHERE p.id = COALESCE(auth.uid(), NEW.updated_by);

  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    VALUES (
      NEW.id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Priority change (was 'update' — invalid enum, now 'note')
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    VALUES (
      NEW.id,
      'note',
      'Priority changed from ' || COALESCE(OLD.priority, 'none') || ' to ' || COALESCE(NEW.priority, 'none'),
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('field', 'priority', 'old_value', OLD.priority, 'new_value', NEW.priority)
    );
  END IF;

  -- Assignment change
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    IF NEW.assignee_id IS NOT NULL THEN
      DECLARE
        v_assignee_name text;
      BEGIN
        SELECT COALESCE(p.full_name, 'Unknown')
        INTO v_assignee_name
        FROM public.profiles p
        WHERE p.id = NEW.assignee_id;

        INSERT INTO public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
        VALUES (
          NEW.id,
          'assignment',
          'Job assigned to ' || v_assignee_name,
          auth.uid(),
          v_user_name,
          '{}',
          jsonb_build_object('assignee_id', NEW.assignee_id, 'assignee_name', v_assignee_name)
        );
      END;
    ELSE
      INSERT INTO public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
      VALUES (
        NEW.id,
        'assignment',
        'Job assignment removed',
        auth.uid(),
        v_user_name,
        '{}',
        jsonb_build_object('assignee_id', null)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2. Fix low-stock trigger: include organization_id ─────────────────────
CREATE OR REPLACE FUNCTION public.check_low_stock_trigger()
RETURNS trigger AS $$
BEGIN
  IF NEW.quantity <= NEW.min_quantity
    AND (OLD.quantity > OLD.min_quantity OR OLD.quantity IS NULL)
  THEN
    INSERT INTO public.notifications (
      organization_id, user_id, type, title, body, metadata
    )
    SELECT
      NEW.organization_id,
      om.user_id,
      'system',
      'Low Stock Alert',
      NEW.name || ' is below reorder point (' || NEW.quantity || ' remaining)',
      jsonb_build_object(
        'inventory_id', NEW.id,
        'item_name', NEW.name,
        'quantity', NEW.quantity,
        'min_quantity', NEW.min_quantity,
        'stock_level', NEW.stock_level
      )
    FROM public.organization_members om
    WHERE om.organization_id = NEW.organization_id
      AND om.role IN ('owner', 'admin', 'manager');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. Fix get_member_stats: assigned_to → assignee_id, completed → done ──
CREATE OR REPLACE FUNCTION public.get_member_stats(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_jobs_done int;
  v_avg_rating numeric;
BEGIN
  SELECT count(*) INTO v_jobs_done
  FROM public.jobs
  WHERE organization_id = p_org_id
    AND assignee_id = p_user_id
    AND status = 'done';

  v_avg_rating := 0;

  RETURN json_build_object(
    'jobs_done', COALESCE(v_jobs_done, 0),
    'avg_rating', COALESCE(v_avg_rating, 0)
  );
END;
$$;


-- ── 4. Add SECURITY DEFINER to budget quarantine functions ────────────────
CREATE OR REPLACE FUNCTION public.quarantine_shift_budget(
  p_organization_id uuid,
  p_allocation_id uuid,
  p_shift_id uuid,
  p_amount numeric,
  p_ndis_item_number text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_available numeric;
  v_total numeric;
  v_consumed numeric;
  v_quarantined numeric;
  v_alloc_org uuid;
BEGIN
  SELECT total_budget, consumed_budget, quarantined_budget, organization_id
  INTO v_total, v_consumed, v_quarantined, v_alloc_org
  FROM public.budget_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Budget allocation not found');
  END IF;

  -- Cross-org guard
  IF v_alloc_org != p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization mismatch');
  END IF;

  v_available := v_total - v_consumed - v_quarantined;

  IF p_amount > v_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient budget',
      'available', v_available,
      'requested', p_amount,
      'overage', p_amount - v_available
    );
  END IF;

  INSERT INTO public.budget_quarantine_ledger (
    organization_id, allocation_id, shift_id, amount, status, ndis_item_number, description
  ) VALUES (
    p_organization_id, p_allocation_id, p_shift_id, p_amount, 'quarantined', p_ndis_item_number, p_description
  );

  UPDATE public.budget_allocations
  SET quarantined_budget = quarantined_budget + p_amount, updated_at = now()
  WHERE id = p_allocation_id;

  RETURN jsonb_build_object('success', true, 'quarantined', p_amount, 'remaining', v_available - p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_shift_quarantine(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_record RECORD;
  v_released_total numeric := 0;
BEGIN
  FOR v_record IN
    SELECT id, allocation_id, amount
    FROM public.budget_quarantine_ledger
    WHERE shift_id = p_shift_id AND status = 'quarantined'
    FOR UPDATE
  LOOP
    UPDATE public.budget_quarantine_ledger SET status = 'released', resolved_at = now() WHERE id = v_record.id;
    UPDATE public.budget_allocations SET quarantined_budget = quarantined_budget - v_record.amount, updated_at = now() WHERE id = v_record.allocation_id;
    v_released_total := v_released_total + v_record.amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released', v_released_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_shift_quarantine(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_record RECORD;
  v_consumed_total numeric := 0;
BEGIN
  FOR v_record IN
    SELECT id, allocation_id, amount
    FROM public.budget_quarantine_ledger
    WHERE shift_id = p_shift_id AND status = 'quarantined'
    FOR UPDATE
  LOOP
    UPDATE public.budget_quarantine_ledger SET status = 'consumed', resolved_at = now() WHERE id = v_record.id;
    UPDATE public.budget_allocations SET quarantined_budget = quarantined_budget - v_record.amount, consumed_budget = consumed_budget + v_record.amount, updated_at = now() WHERE id = v_record.allocation_id;
    v_consumed_total := v_consumed_total + v_record.amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'consumed', v_consumed_total);
END;
$$;


-- ── 5. Drop duplicate permissive RLS policies from pre-036 era ────────────
-- Migration 036 added restrictive role-based policies but didn't drop the
-- original permissive policies. Postgres OR-combines policies, so the
-- restrictive ones have zero effect. We drop the old permissive ones.

-- Jobs: Drop old permissive policy, keep the role-based ones from 036
DO $$ BEGIN
  -- Drop generic org-member policies that bypass role checks
  DROP POLICY IF EXISTS "Users can view org jobs" ON public.jobs;
  DROP POLICY IF EXISTS "Users can create org jobs" ON public.jobs;
  DROP POLICY IF EXISTS "Users can update org jobs" ON public.jobs;
  DROP POLICY IF EXISTS "org_member_select_jobs" ON public.jobs;
  DROP POLICY IF EXISTS "org_member_insert_jobs" ON public.jobs;
  DROP POLICY IF EXISTS "org_member_update_jobs" ON public.jobs;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Clients: Drop old permissive policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view org clients" ON public.clients;
  DROP POLICY IF EXISTS "Users can create org clients" ON public.clients;
  DROP POLICY IF EXISTS "Users can update org clients" ON public.clients;
  DROP POLICY IF EXISTS "org_member_select_clients" ON public.clients;
  DROP POLICY IF EXISTS "org_member_insert_clients" ON public.clients;
  DROP POLICY IF EXISTS "org_member_update_clients" ON public.clients;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Invoices: Drop old permissive policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view org invoices" ON public.invoices;
  DROP POLICY IF EXISTS "Users can create org invoices" ON public.invoices;
  DROP POLICY IF EXISTS "Users can update org invoices" ON public.invoices;
  DROP POLICY IF EXISTS "org_member_select_invoices" ON public.invoices;
  DROP POLICY IF EXISTS "org_member_insert_invoices" ON public.invoices;
  DROP POLICY IF EXISTS "org_member_update_invoices" ON public.invoices;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;


-- ── 6. Add get_ndis_rate SECURITY DEFINER ─────────────────────────────────
DO $$ BEGIN
  ALTER FUNCTION public.get_ndis_rate(text, date, integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_ndis_rate_with_loading(text, date, integer) SECURITY DEFINER;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
