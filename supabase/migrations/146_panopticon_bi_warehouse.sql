-- ============================================================
-- Migration 146: Project Panopticon-BI — Data Warehouse & BI Engine
-- Version 148.0 — "Analytical Supremacy & Frictionless Discovery"
-- ============================================================

-- ── 1. Materialized View: Job Profitability Data Mart ───────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_job_profitability AS
SELECT
  j.organization_id                              AS workspace_id,
  j.id                                           AS job_id,
  j.display_id                                   AS job_display_id,
  j.title                                        AS job_title,
  j.status::text                                 AS job_status,
  COALESCE(j.labels[1], 'Uncategorized')         AS job_category,
  j.assignee_id,
  om.branch                                      AS branch,

  -- Revenue: from invoices linked to this job
  COALESCE(inv.total_revenue, 0)                 AS total_revenue,
  COALESCE(inv.invoice_count, 0)                 AS invoice_count,

  -- Labor COGS: from timesheet pay lines for workers on this job
  COALESCE(labor.total_labor_cost, 0)            AS total_labor_cost,
  COALESCE(labor.total_labor_hours, 0)           AS total_labor_hours,

  -- Material COGS: from purchase orders linked to this job
  COALESCE(mat.total_material_cost, 0)           AS total_material_cost,
  COALESCE(mat.po_count, 0)                      AS po_count,

  -- Quote estimate
  COALESCE(q.quoted_total, 0)                    AS quoted_total,

  -- Computed margins
  COALESCE(inv.total_revenue, 0) - COALESCE(labor.total_labor_cost, 0) - COALESCE(mat.total_material_cost, 0) AS gross_margin_dollars,
  CASE
    WHEN COALESCE(inv.total_revenue, 0) > 0 THEN
      ROUND(((COALESCE(inv.total_revenue, 0) - COALESCE(labor.total_labor_cost, 0) - COALESCE(mat.total_material_cost, 0)) / COALESCE(inv.total_revenue, 0)) * 100, 2)
    ELSE 0
  END                                            AS gross_margin_pct,

  -- Estimate vs Actual
  j.estimated_hours,
  j.actual_hours,
  CASE
    WHEN COALESCE(j.estimated_hours, 0) > 0 THEN
      ROUND(((COALESCE(j.actual_hours, 0) - j.estimated_hours) / j.estimated_hours) * 100, 2)
    ELSE NULL
  END                                            AS hours_variance_pct,

  -- Temporal bucketing
  DATE_TRUNC('month', j.created_at)::date        AS created_month,
  EXTRACT(YEAR FROM j.created_at)::int           AS created_year,
  EXTRACT(QUARTER FROM j.created_at)::int        AS created_quarter,
  j.created_at

FROM public.jobs j

-- Branch from assignee
LEFT JOIN public.organization_members om
  ON om.user_id = j.assignee_id AND om.organization_id = j.organization_id

-- Revenue aggregation
LEFT JOIN LATERAL (
  SELECT
    SUM(i.total) AS total_revenue,
    COUNT(*)     AS invoice_count
  FROM public.invoices i
  WHERE i.job_id = j.id
    AND i.deleted_at IS NULL
    AND i.status::text NOT IN ('void', 'draft')
) inv ON true

-- Labor cost aggregation (from time_entries linked to this job)
LEFT JOIN LATERAL (
  SELECT
    SUM(tpl.total_line_amount) AS total_labor_cost,
    SUM(tpl.units)             AS total_labor_hours
  FROM public.timesheet_pay_lines tpl
  JOIN public.time_entries te ON te.id = tpl.time_entry_id
  LEFT JOIN public.schedule_blocks sb ON sb.id = te.shift_id
  WHERE sb.job_id = j.id
) labor ON true

-- Material cost aggregation
LEFT JOIN LATERAL (
  SELECT
    SUM(po.total) AS total_material_cost,
    COUNT(*)      AS po_count
  FROM public.purchase_orders po
  WHERE po.source_job_id = j.id
) mat ON true

-- Quote estimate
LEFT JOIN LATERAL (
  SELECT SUM(qt.total) AS quoted_total
  FROM public.quotes qt
  WHERE qt.job_id = j.id AND qt.status::text = 'accepted'
) q ON true

WHERE j.deleted_at IS NULL;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_job_profitability_id
  ON public.mv_job_profitability (job_id);

-- ── 2. Materialized View: Worker Utilization Data Mart ──────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_worker_utilization AS
SELECT
  tpl.organization_id                            AS workspace_id,
  tpl.worker_id,
  p.full_name                                    AS worker_name,
  om.branch                                      AS branch,
  om.role::text                                  AS worker_role,

  -- Hours breakdown
  SUM(tpl.units)                                 AS total_hours_paid,
  SUM(CASE WHEN tpl.pay_category IN ('ordinary', 'ORDINARY', 'base') THEN tpl.units ELSE 0 END) AS ordinary_hours,
  SUM(CASE WHEN tpl.pay_category ILIKE '%overtime%' OR tpl.pay_category ILIKE '%ot_%' THEN tpl.units ELSE 0 END) AS overtime_hours,
  SUM(CASE WHEN tpl.pay_category ILIKE '%leave%' THEN tpl.units ELSE 0 END) AS leave_hours,

  -- Cost breakdown
  SUM(tpl.total_line_amount)                     AS total_labor_cost,
  SUM(CASE WHEN tpl.pay_category ILIKE '%overtime%' OR tpl.pay_category ILIKE '%ot_%' THEN tpl.total_line_amount ELSE 0 END) AS overtime_cost,

  -- Billable hours (time entries linked to a job)
  COALESCE(billed.billable_hours, 0)             AS billable_hours,

  -- Utilization percentage
  CASE
    WHEN SUM(tpl.units) > 0 THEN
      ROUND((COALESCE(billed.billable_hours, 0) / SUM(tpl.units)) * 100, 2)
    ELSE 0
  END                                            AS utilization_pct,

  -- Temporal
  DATE_TRUNC('month', tpl.shift_date)::date      AS period_month,
  EXTRACT(YEAR FROM tpl.shift_date)::int         AS period_year,

  COUNT(DISTINCT tpl.shift_date)                 AS days_worked

FROM public.timesheet_pay_lines tpl
LEFT JOIN public.profiles p ON p.id = tpl.worker_id
LEFT JOIN public.organization_members om
  ON om.user_id = tpl.worker_id AND om.organization_id = tpl.organization_id

-- Billable hours: time entries linked to jobs
LEFT JOIN LATERAL (
  SELECT SUM(te.total_hours) AS billable_hours
  FROM public.time_entries te
  LEFT JOIN public.schedule_blocks sb ON sb.id = te.shift_id
  WHERE te.worker_id = tpl.worker_id
    AND te.organization_id = tpl.organization_id
    AND sb.job_id IS NOT NULL
    AND DATE_TRUNC('month', te.clock_in::date) = DATE_TRUNC('month', tpl.shift_date)
) billed ON true

GROUP BY
  tpl.organization_id, tpl.worker_id, p.full_name, om.branch, om.role,
  DATE_TRUNC('month', tpl.shift_date), EXTRACT(YEAR FROM tpl.shift_date),
  billed.billable_hours;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_worker_util_composite
  ON public.mv_worker_utilization (workspace_id, worker_id, period_month);

-- ── 3. Materialized View: NDIS Fund Burn Rate ───────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_ndis_fund_burn AS
SELECT
  i.organization_id                              AS workspace_id,
  i.participant_id,
  c.name                                         AS participant_name,
  i.ndis_participant_number,
  i.funding_type,

  -- Billed amounts
  SUM(i.total)                                   AS total_billed,
  COUNT(*)                                       AS claim_count,

  -- Monthly aggregation
  DATE_TRUNC('month', i.issue_date)::date        AS billing_month,
  EXTRACT(YEAR FROM i.issue_date)::int           AS billing_year,

  -- Average per claim
  ROUND(AVG(i.total), 2)                         AS avg_claim_amount

FROM public.invoices i
LEFT JOIN public.participant_profiles pp ON pp.id = i.participant_id
LEFT JOIN public.clients c ON c.id = pp.client_id

WHERE i.participant_id IS NOT NULL
  AND i.deleted_at IS NULL
  AND i.status::text NOT IN ('void', 'draft')

GROUP BY
  i.organization_id, i.participant_id, c.name,
  i.ndis_participant_number, i.funding_type,
  DATE_TRUNC('month', i.issue_date), EXTRACT(YEAR FROM i.issue_date);

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_ndis_burn_composite
  ON public.mv_ndis_fund_burn (workspace_id, participant_id, billing_month);

-- ── 4. Materialized View: Trade Estimate vs Actual ──────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_trade_estimate_vs_actual AS
SELECT
  j.organization_id                              AS workspace_id,
  j.id                                           AS job_id,
  j.display_id                                   AS job_display_id,
  j.title                                        AS job_title,
  COALESCE(j.labels[1], 'Uncategorized')         AS job_category,
  j.status::text                                 AS job_status,

  -- Quoted amounts
  COALESCE(q.quoted_labor, 0)                    AS quoted_labor,
  COALESCE(q.quoted_materials, 0)                AS quoted_materials,
  COALESCE(q.quoted_total, 0)                    AS quoted_total,

  -- Actual amounts
  COALESCE(labor.actual_labor, 0)                AS actual_labor,
  COALESCE(mat.actual_materials, 0)              AS actual_materials,
  COALESCE(labor.actual_labor, 0) + COALESCE(mat.actual_materials, 0) AS actual_total,

  -- Variances
  COALESCE(labor.actual_labor, 0) - COALESCE(q.quoted_labor, 0) AS labor_variance,
  COALESCE(mat.actual_materials, 0) - COALESCE(q.quoted_materials, 0) AS material_variance,
  (COALESCE(labor.actual_labor, 0) + COALESCE(mat.actual_materials, 0)) - COALESCE(q.quoted_total, 0) AS total_variance,

  -- Variance percentage
  CASE
    WHEN COALESCE(q.quoted_total, 0) > 0 THEN
      ROUND((((COALESCE(labor.actual_labor, 0) + COALESCE(mat.actual_materials, 0)) - q.quoted_total) / q.quoted_total) * 100, 2)
    ELSE NULL
  END                                            AS variance_pct,

  DATE_TRUNC('month', j.created_at)::date        AS created_month,
  j.created_at

FROM public.jobs j

LEFT JOIN LATERAL (
  SELECT
    SUM(qt.total) AS quoted_total,
    SUM(qt.subtotal) AS quoted_labor,
    SUM(qt.tax) AS quoted_materials
  FROM public.quotes qt
  WHERE qt.job_id = j.id AND qt.status::text = 'accepted'
) q ON true

LEFT JOIN LATERAL (
  SELECT SUM(tpl.total_line_amount) AS actual_labor
  FROM public.timesheet_pay_lines tpl
  JOIN public.time_entries te ON te.id = tpl.time_entry_id
  LEFT JOIN public.schedule_blocks sb ON sb.id = te.shift_id
  WHERE sb.job_id = j.id
) labor ON true

LEFT JOIN LATERAL (
  SELECT SUM(po.total) AS actual_materials
  FROM public.purchase_orders po
  WHERE po.source_job_id = j.id
) mat ON true

WHERE j.deleted_at IS NULL
  AND COALESCE(q.quoted_total, 0) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trade_est_vs_actual_id
  ON public.mv_trade_estimate_vs_actual (job_id);

-- ── 5. RLS Security Wrapper Views ───────────────────────────
-- Postgres does NOT support RLS on Materialized Views.
-- These standard VIEWs apply workspace filtering from the JWT.

CREATE OR REPLACE VIEW public.secure_job_profitability AS
SELECT * FROM public.mv_job_profitability
WHERE workspace_id = (auth.jwt()->'app_metadata'->>'active_workspace')::uuid;

CREATE OR REPLACE VIEW public.secure_worker_utilization AS
SELECT * FROM public.mv_worker_utilization
WHERE workspace_id = (auth.jwt()->'app_metadata'->>'active_workspace')::uuid;

CREATE OR REPLACE VIEW public.secure_ndis_fund_burn AS
SELECT * FROM public.mv_ndis_fund_burn
WHERE workspace_id = (auth.jwt()->'app_metadata'->>'active_workspace')::uuid;

CREATE OR REPLACE VIEW public.secure_trade_estimate_vs_actual AS
SELECT * FROM public.mv_trade_estimate_vs_actual
WHERE workspace_id = (auth.jwt()->'app_metadata'->>'active_workspace')::uuid;

-- Grant read access to authenticated users (views handle security)
GRANT SELECT ON public.secure_job_profitability TO authenticated;
GRANT SELECT ON public.secure_worker_utilization TO authenticated;
GRANT SELECT ON public.secure_ndis_fund_burn TO authenticated;
GRANT SELECT ON public.secure_trade_estimate_vs_actual TO authenticated;

-- ── 6. Analytics refresh tracking table ─────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_refresh_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name       TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  row_count       INT,
  status          TEXT DEFAULT 'running',
  error_message   TEXT
);

ALTER TABLE public.analytics_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages refresh log" ON public.analytics_refresh_log
  FOR ALL USING (true);

-- ── 7. RPC: Refresh materialized views with logging ─────────
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_log_id UUID;
  v_count INT;
  v_results JSONB := '[]'::jsonb;
  v_views TEXT[] := ARRAY[
    'mv_job_profitability',
    'mv_worker_utilization',
    'mv_ndis_fund_burn',
    'mv_trade_estimate_vs_actual'
  ];
  v_view TEXT;
BEGIN
  FOREACH v_view IN ARRAY v_views LOOP
    v_start := clock_timestamp();
    v_log_id := gen_random_uuid();

    INSERT INTO public.analytics_refresh_log (id, view_name, started_at, status)
    VALUES (v_log_id, v_view, v_start, 'running');

    BEGIN
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v_view);
      EXECUTE format('SELECT COUNT(*) FROM public.%I', v_view) INTO v_count;

      UPDATE public.analytics_refresh_log SET
        completed_at = clock_timestamp(),
        duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000,
        row_count = v_count,
        status = 'completed'
      WHERE id = v_log_id;

      v_results := v_results || jsonb_build_object(
        'view', v_view,
        'status', 'completed',
        'rows', v_count,
        'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000
      );
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.analytics_refresh_log SET
        completed_at = clock_timestamp(),
        status = 'error',
        error_message = SQLERRM
      WHERE id = v_log_id;

      v_results := v_results || jsonb_build_object(
        'view', v_view,
        'status', 'error',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN v_results::json;
END;
$$;

-- ── 8. RPC: Get analytics dashboard summary ─────────────────
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_org_id UUID, p_months INT DEFAULT 6)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since DATE;
  v_total_revenue NUMERIC;
  v_total_cogs NUMERIC;
  v_blended_margin NUMERIC;
  v_unbilled_wip NUMERIC;
  v_utilization NUMERIC;
  v_overtime_cost NUMERIC;
  v_job_count INT;
  v_last_refresh TIMESTAMPTZ;
BEGIN
  v_since := (CURRENT_DATE - (p_months || ' months')::interval)::date;

  -- Revenue & Margins from profitability view
  SELECT
    COALESCE(SUM(total_revenue), 0),
    COALESCE(SUM(total_labor_cost + total_material_cost), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_cogs, v_job_count
  FROM public.mv_job_profitability
  WHERE workspace_id = p_org_id
    AND created_at >= v_since;

  v_blended_margin := CASE
    WHEN v_total_revenue > 0 THEN ROUND(((v_total_revenue - v_total_cogs) / v_total_revenue) * 100, 2)
    ELSE 0
  END;

  -- Unbilled WIP: jobs with time entries but no invoices
  SELECT COALESCE(SUM(total_labor_cost), 0)
  INTO v_unbilled_wip
  FROM public.mv_job_profitability
  WHERE workspace_id = p_org_id
    AND total_revenue = 0
    AND total_labor_cost > 0
    AND created_at >= v_since;

  -- Utilization & Overtime
  SELECT
    COALESCE(AVG(utilization_pct), 0),
    COALESCE(SUM(overtime_cost), 0)
  INTO v_utilization, v_overtime_cost
  FROM public.mv_worker_utilization
  WHERE workspace_id = p_org_id
    AND period_month >= v_since;

  -- Last refresh
  SELECT completed_at INTO v_last_refresh
  FROM public.analytics_refresh_log
  WHERE status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 1;

  RETURN json_build_object(
    'total_revenue', v_total_revenue,
    'total_cogs', v_total_cogs,
    'blended_margin_pct', v_blended_margin,
    'unbilled_wip', v_unbilled_wip,
    'labor_utilization_pct', ROUND(v_utilization, 1),
    'overtime_leakage', v_overtime_cost,
    'job_count', v_job_count,
    'last_refresh', v_last_refresh,
    'period_months', p_months
  );
END;
$$;

-- ── 9. RPC: Get profitability by category (for charts) ──────
CREATE OR REPLACE FUNCTION public.get_profitability_by_category(p_org_id UUID, p_months INT DEFAULT 6)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since DATE;
BEGIN
  v_since := (CURRENT_DATE - (p_months || ' months')::interval)::date;

  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        job_category,
        COUNT(*) AS job_count,
        SUM(total_revenue) AS revenue,
        SUM(total_labor_cost + total_material_cost) AS cogs,
        SUM(gross_margin_dollars) AS margin,
        ROUND(AVG(gross_margin_pct), 2) AS avg_margin_pct
      FROM public.mv_job_profitability
      WHERE workspace_id = p_org_id AND created_at >= v_since
      GROUP BY job_category
      ORDER BY SUM(total_revenue) DESC
    ) r
  );
END;
$$;

-- ── 10. RPC: Revenue trend (monthly) ────────────────────────
CREATE OR REPLACE FUNCTION public.get_revenue_trend(p_org_id UUID, p_months INT DEFAULT 12)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since DATE;
BEGIN
  v_since := (CURRENT_DATE - (p_months || ' months')::interval)::date;

  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        created_month,
        SUM(total_revenue) AS revenue,
        SUM(total_labor_cost + total_material_cost) AS cogs,
        SUM(gross_margin_dollars) AS margin,
        COUNT(*) AS job_count
      FROM public.mv_job_profitability
      WHERE workspace_id = p_org_id AND created_at >= v_since
      GROUP BY created_month
      ORDER BY created_month
    ) r
  );
END;
$$;

-- ── 11. RPC: Worker leaderboard ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_worker_leaderboard(p_org_id UUID, p_months INT DEFAULT 3)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since DATE;
BEGIN
  v_since := (CURRENT_DATE - (p_months || ' months')::interval)::date;

  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        worker_id,
        worker_name,
        branch,
        SUM(total_hours_paid) AS total_hours,
        SUM(total_labor_cost) AS total_cost,
        SUM(billable_hours) AS billable_hours,
        ROUND(AVG(utilization_pct), 1) AS avg_utilization_pct,
        SUM(overtime_hours) AS overtime_hours,
        SUM(overtime_cost) AS overtime_cost
      FROM public.mv_worker_utilization
      WHERE workspace_id = p_org_id AND period_month >= v_since
      GROUP BY worker_id, worker_name, branch
      ORDER BY SUM(total_labor_cost) DESC
      LIMIT 20
    ) r
  );
END;
$$;

-- ── 12. RPC: Pivot data (generic aggregation engine) ────────
CREATE OR REPLACE FUNCTION public.get_pivot_data(
  p_org_id UUID,
  p_source TEXT,
  p_months INT DEFAULT 6
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_since DATE;
  v_result JSON;
BEGIN
  v_since := (CURRENT_DATE - (p_months || ' months')::interval)::date;

  IF p_source = 'job_profitability' THEN
    SELECT json_agg(row_to_json(r)) INTO v_result FROM (
      SELECT * FROM public.mv_job_profitability
      WHERE workspace_id = p_org_id AND created_at >= v_since
      ORDER BY created_at DESC
      LIMIT 5000
    ) r;
  ELSIF p_source = 'worker_utilization' THEN
    SELECT json_agg(row_to_json(r)) INTO v_result FROM (
      SELECT * FROM public.mv_worker_utilization
      WHERE workspace_id = p_org_id AND period_month >= v_since
      ORDER BY period_month DESC
      LIMIT 5000
    ) r;
  ELSIF p_source = 'ndis_fund_burn' THEN
    SELECT json_agg(row_to_json(r)) INTO v_result FROM (
      SELECT * FROM public.mv_ndis_fund_burn
      WHERE workspace_id = p_org_id AND billing_month >= v_since
      ORDER BY billing_month DESC
      LIMIT 5000
    ) r;
  ELSIF p_source = 'trade_estimate_vs_actual' THEN
    SELECT json_agg(row_to_json(r)) INTO v_result FROM (
      SELECT * FROM public.mv_trade_estimate_vs_actual
      WHERE workspace_id = p_org_id AND created_at >= v_since
      ORDER BY created_at DESC
      LIMIT 5000
    ) r;
  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
