-- ============================================================================
-- @migration AutoYield
-- @status COMPLETE
-- @description Project Auto-Yield: Zero-touch billing & payroll engine.
--   Creates pay_runs to group timesheet_pay_lines, adds timesheet_id to
--   invoice_line_items, creates yield processing RPCs with advisory locks
--   and live telemetry support.
-- @tables pay_runs (NEW), yield_processing_log (NEW)
-- @alters timesheet_pay_lines (add pay_run_id), invoice_line_items (add timesheet_id)
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 1. Pay Runs Table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pay_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'LOCKED', 'APPROVED', 'EXPORTED')),
  total_gross       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_lines       INTEGER NOT NULL DEFAULT 0,
  worker_count      INTEGER NOT NULL DEFAULT 0,
  timesheet_count   INTEGER NOT NULL DEFAULT 0,
  exported_at       TIMESTAMPTZ,
  exported_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes             TEXT,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_runs_org
  ON public.pay_runs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pay_runs_period
  ON public.pay_runs (organization_id, period_start, period_end);

-- ─── 2. Add pay_run_id to timesheet_pay_lines ───────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timesheet_pay_lines'
    AND column_name = 'pay_run_id'
  ) THEN
    ALTER TABLE public.timesheet_pay_lines
      ADD COLUMN pay_run_id UUID REFERENCES public.pay_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pay_lines_pay_run
  ON public.timesheet_pay_lines (pay_run_id) WHERE pay_run_id IS NOT NULL;

-- ─── 3. Add timesheet_id to invoice_line_items ──────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_line_items'
    AND column_name = 'timesheet_id'
  ) THEN
    ALTER TABLE public.invoice_line_items
      ADD COLUMN timesheet_id UUID REFERENCES public.timesheets(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_lines_timesheet_unique
  ON public.invoice_line_items (timesheet_id, ndis_support_item_number)
  WHERE timesheet_id IS NOT NULL;

-- ─── 4. Yield Processing Log (Telemetry) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yield_processing_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id            UUID NOT NULL,
  timesheet_id        UUID REFERENCES public.timesheets(id),
  fork                TEXT NOT NULL CHECK (fork IN ('PAYROLL', 'AR', 'BOTH')),
  status              TEXT NOT NULL DEFAULT 'PROCESSING'
                      CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  payroll_amount      NUMERIC(12,2) DEFAULT 0,
  ar_amount           NUMERIC(12,2) DEFAULT 0,
  pay_lines_count     INTEGER DEFAULT 0,
  invoice_lines_count INTEGER DEFAULT 0,
  error_message       TEXT,
  processing_ms       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yield_log_batch
  ON public.yield_processing_log (batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_yield_log_org
  ON public.yield_processing_log (organization_id, created_at DESC);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.pay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yield_processing_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_runs' AND policyname = 'Org members view pay_runs') THEN
    CREATE POLICY "Org members view pay_runs"
      ON public.pay_runs FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_runs' AND policyname = 'Admins manage pay_runs') THEN
    CREATE POLICY "Admins manage pay_runs"
      ON public.pay_runs FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = pay_runs.organization_id
           AND user_id = auth.uid() AND status = 'active')
        IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'yield_processing_log' AND policyname = 'Org members view yield_log') THEN
    CREATE POLICY "Org members view yield_log"
      ON public.yield_processing_log FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

-- ─── 6. Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.yield_processing_log;

-- ─── 7. RPCs ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_yield_ready_timesheets(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_total_hours NUMERIC;
  v_workers INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(total_hours), 0),
    COUNT(DISTINCT worker_id)
  INTO v_count, v_total_hours, v_workers
  FROM public.timesheets
  WHERE organization_id = p_org_id
    AND status = 'approved'
    AND is_locked = false;

  RETURN jsonb_build_object(
    'ready_count', v_count,
    'total_hours', ROUND(v_total_hours, 2),
    'worker_count', v_workers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_timesheet_for_yield(p_timesheet_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext(p_timesheet_id::text)) THEN
    RETURN false;
  END IF;

  UPDATE public.timesheets
  SET is_locked = true, updated_at = now()
  WHERE id = p_timesheet_id AND status = 'approved' AND is_locked = false;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pay_run(
  p_org_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pay_run_id UUID;
BEGIN
  INSERT INTO public.pay_runs (
    organization_id, period_start, period_end, created_by
  ) VALUES (
    p_org_id, p_period_start, p_period_end, p_user_id
  ) RETURNING id INTO v_pay_run_id;

  RETURN v_pay_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_pay_run(p_pay_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total NUMERIC;
  v_lines INTEGER;
  v_workers INTEGER;
  v_timesheets INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(total_line_amount), 0),
    COUNT(*),
    COUNT(DISTINCT worker_id),
    COUNT(DISTINCT timesheet_id)
  INTO v_total, v_lines, v_workers, v_timesheets
  FROM public.timesheet_pay_lines
  WHERE pay_run_id = p_pay_run_id;

  UPDATE public.pay_runs
  SET total_gross = v_total,
      total_lines = v_lines,
      worker_count = v_workers,
      timesheet_count = v_timesheets,
      updated_at = now()
  WHERE id = p_pay_run_id;

  RETURN jsonb_build_object(
    'total_gross', ROUND(v_total, 2),
    'total_lines', v_lines,
    'worker_count', v_workers,
    'timesheet_count', v_timesheets
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_yield_stats(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'pay_runs_draft', (SELECT COUNT(*) FROM public.pay_runs WHERE organization_id = p_org_id AND status = 'DRAFT'),
    'pay_runs_locked', (SELECT COUNT(*) FROM public.pay_runs WHERE organization_id = p_org_id AND status = 'LOCKED'),
    'total_payroll_30d', (SELECT COALESCE(SUM(total_gross), 0) FROM public.pay_runs WHERE organization_id = p_org_id AND created_at > now() - interval '30 days'),
    'total_invoiced_30d', (
      SELECT COALESCE(SUM(i.total), 0)
      FROM public.invoices i
      WHERE i.organization_id = p_org_id
        AND i.created_at > now() - interval '30 days'
        AND i.status != 'voided'
    ),
    'yield_processed_7d', (SELECT COUNT(*) FROM public.yield_processing_log WHERE organization_id = p_org_id AND created_at > now() - interval '7 days' AND status = 'COMPLETED'),
    'yield_failed_7d', (SELECT COUNT(*) FROM public.yield_processing_log WHERE organization_id = p_org_id AND created_at > now() - interval '7 days' AND status = 'FAILED')
  );
END;
$$;

COMMENT ON TABLE public.pay_runs IS
  'Project Auto-Yield: Groups timesheet_pay_lines into payroll batches for export.';
COMMENT ON TABLE public.yield_processing_log IS
  'Project Auto-Yield: Real-time telemetry for bifurcated yield processing.';
