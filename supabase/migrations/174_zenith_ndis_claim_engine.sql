-- ============================================================================
-- @migration ZenithNDISClaimEngine
-- @status COMPLETE
-- @description Zenith-Launch — automated NDIS bulk claim engine with time-of-day code translation
-- @tables ndis_code_translation_matrix, claim_generation_runs
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── The NDIS Code Translation Matrix ─────────────────────────────────────────
-- A shift on a Tuesday at 2:00 PM   → 01_011_0107_1_1 (Weekday Daytime)
-- A shift on a Tuesday at 8:00 PM   → 01_012_0107_1_1 (Weekday Evening)
-- A shift on a Saturday at 2:00 PM  → 01_013_0107_1_1 (Saturday)
-- A shift on a Sunday at 2:00 PM    → 01_014_0107_1_1 (Sunday)
-- A shift on a Public Holiday       → 01_015_0107_1_1 (Public Holiday)
-- Active Night (midnight–6 AM)      → 01_012_0107_1_1 (Evening/Night rate)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: Resolve NDIS Support Item Code from Temporal Context ─────────────
CREATE OR REPLACE FUNCTION public.resolve_ndis_support_item_code(
  p_shift_start   TIMESTAMPTZ,
  p_shift_end     TIMESTAMPTZ,
  p_org_id        UUID,
  p_coverage_type TEXT DEFAULT 'standard_hourly'
)
RETURNS TABLE (
  support_item_number TEXT,
  rate_description    TEXT,
  hours               NUMERIC,
  rate                NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_start_local   TIMESTAMP;
  v_end_local     TIMESTAMP;
  v_day_of_week   INTEGER;
  v_start_hour    INTEGER;
  v_is_holiday    BOOLEAN := false;
  v_total_hours   NUMERIC;
  v_midnight      TIMESTAMP;
BEGIN
  -- Convert to AEST (Brisbane — no DST)
  v_start_local := p_shift_start AT TIME ZONE 'Australia/Brisbane';
  v_end_local   := p_shift_end   AT TIME ZONE 'Australia/Brisbane';
  v_day_of_week := EXTRACT(ISODOW FROM v_start_local)::INTEGER; -- 1=Mon, 7=Sun
  v_start_hour  := EXTRACT(HOUR FROM v_start_local)::INTEGER;
  v_total_hours := EXTRACT(EPOCH FROM (p_shift_end - p_shift_start)) / 3600.0;

  -- Check if the shift date falls on a public holiday
  SELECT EXISTS(
    SELECT 1 FROM public.public_holidays ph
    WHERE ph.date = v_start_local::DATE
      AND (ph.organization_id IS NULL OR ph.organization_id = p_org_id)
  ) INTO v_is_holiday;

  -- ── Public Holiday ───────────────────────────────────────────
  IF v_is_holiday THEN
    RETURN QUERY SELECT
      '01_015_0107_1_1'::TEXT,
      'Public Holiday'::TEXT,
      ROUND(v_total_hours, 2),
      COALESCE(
        (SELECT n.price_limit_national FROM ndis_support_items n
         WHERE n.support_item_number = '01_015_0107_1_1'
           AND n.effective_from <= v_start_local::DATE
         ORDER BY n.effective_from DESC LIMIT 1),
        148.47
      );
    RETURN;
  END IF;

  -- ── Sunday ───────────────────────────────────────────────────
  IF v_day_of_week = 7 THEN
    RETURN QUERY SELECT
      '01_014_0107_1_1'::TEXT,
      'Sunday'::TEXT,
      ROUND(v_total_hours, 2),
      COALESCE(
        (SELECT n.price_limit_national FROM ndis_support_items n
         WHERE n.support_item_number = '01_014_0107_1_1'
           AND n.effective_from <= v_start_local::DATE
         ORDER BY n.effective_from DESC LIMIT 1),
        121.73
      );
    RETURN;
  END IF;

  -- ── Saturday ─────────────────────────────────────────────────
  IF v_day_of_week = 6 THEN
    RETURN QUERY SELECT
      '01_013_0107_1_1'::TEXT,
      'Saturday'::TEXT,
      ROUND(v_total_hours, 2),
      COALESCE(
        (SELECT n.price_limit_national FROM ndis_support_items n
         WHERE n.support_item_number = '01_013_0107_1_1'
           AND n.effective_from <= v_start_local::DATE
         ORDER BY n.effective_from DESC LIMIT 1),
        94.99
      );
    RETURN;
  END IF;

  -- ── Weekday: Check for cross-midnight splitting ──────────────
  v_midnight := DATE_TRUNC('day', v_start_local) + INTERVAL '1 day';

  -- Shift crosses midnight AND starts in evening
  IF v_end_local > v_midnight AND v_start_hour >= 18 THEN
    DECLARE
      v_evening_hours NUMERIC;
      v_night_hours   NUMERIC;
    BEGIN
      v_evening_hours := EXTRACT(EPOCH FROM (v_midnight - v_start_local)) / 3600.0;
      v_night_hours   := EXTRACT(EPOCH FROM (v_end_local - v_midnight)) / 3600.0;

      -- Evening portion (6 PM – midnight)
      RETURN QUERY SELECT
        '01_012_0107_1_1'::TEXT,
        'Weekday Evening'::TEXT,
        ROUND(v_evening_hours, 2),
        COALESCE(
          (SELECT n.price_limit_national FROM ndis_support_items n
           WHERE n.support_item_number = '01_012_0107_1_1'
             AND n.effective_from <= v_start_local::DATE
           ORDER BY n.effective_from DESC LIMIT 1),
          74.44
        );

      -- Night portion (midnight – end, at night rate)
      RETURN QUERY SELECT
        '01_012_0107_1_1'::TEXT,
        'Active Night'::TEXT,
        ROUND(v_night_hours, 2),
        COALESCE(
          (SELECT n.price_limit_national FROM ndis_support_items n
           WHERE n.support_item_number = '01_012_0107_1_1'
             AND n.effective_from <= v_start_local::DATE
           ORDER BY n.effective_from DESC LIMIT 1),
          74.44
        );
      RETURN;
    END;
  END IF;

  -- ── Evening (6 PM – midnight) ────────────────────────────────
  IF v_start_hour >= 18 THEN
    RETURN QUERY SELECT
      '01_012_0107_1_1'::TEXT,
      'Weekday Evening'::TEXT,
      ROUND(v_total_hours, 2),
      COALESCE(
        (SELECT n.price_limit_national FROM ndis_support_items n
         WHERE n.support_item_number = '01_012_0107_1_1'
           AND n.effective_from <= v_start_local::DATE
         ORDER BY n.effective_from DESC LIMIT 1),
        74.44
      );
    RETURN;
  END IF;

  -- ── Early Morning (midnight – 6 AM) ─────────────────────────
  IF v_start_hour < 6 THEN
    RETURN QUERY SELECT
      '01_012_0107_1_1'::TEXT,
      'Active Night'::TEXT,
      ROUND(v_total_hours, 2),
      COALESCE(
        (SELECT n.price_limit_national FROM ndis_support_items n
         WHERE n.support_item_number = '01_012_0107_1_1'
           AND n.effective_from <= v_start_local::DATE
         ORDER BY n.effective_from DESC LIMIT 1),
        74.44
      );
    RETURN;
  END IF;

  -- ── Default: Weekday Daytime (6 AM – 6 PM) ──────────────────
  RETURN QUERY SELECT
    '01_011_0107_1_1'::TEXT,
    'Weekday Daytime'::TEXT,
    ROUND(v_total_hours, 2),
    COALESCE(
      (SELECT n.price_limit_national FROM ndis_support_items n
       WHERE n.support_item_number = '01_011_0107_1_1'
         AND n.effective_from <= v_start_local::DATE
       ORDER BY n.effective_from DESC LIMIT 1),
      67.56
    );
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.resolve_ndis_support_item_code IS
  'Zenith-Launch: Translates shift temporal context into the correct 15-char NDIS Support Item Code with rate lookup from ndis_support_items catalogue.';


-- ── Main RPC: Generate NDIS Claim Batch from Approved Shifts ─────────────────
CREATE OR REPLACE FUNCTION public.generate_ndis_claim_batch(
  p_organization_id UUID,
  p_period_start    DATE DEFAULT NULL,
  p_period_end      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_batch_id       UUID;
  v_batch_number   TEXT;
  v_total_amount   NUMERIC := 0;
  v_claim_count    INTEGER := 0;
  v_shift          RECORD;
  v_code_row       RECORD;
  v_ndis_number    TEXT;
  v_reg_number     TEXT;
  v_csv_rows       TEXT[] := ARRAY[]::TEXT[];
  v_csv_header     TEXT := 'RegistrationNumber,NDISNumber,SupportsDeliveredFrom,SupportsDeliveredTo,SupportItemNumber,ClaimReference,Quantity,UnitPrice,GSTCode';
  v_errors         JSONB := '[]'::JSONB;
BEGIN
  -- Get organization NDIS registration number
  SELECT COALESCE(
    (o.metadata->>'ndis_registration_number'),
    'PENDING'
  ) INTO v_reg_number
  FROM organizations o
  WHERE o.id = p_organization_id;

  -- Default period: last 7 days
  IF p_period_start IS NULL THEN
    p_period_start := CURRENT_DATE - INTERVAL '7 days';
  END IF;
  IF p_period_end IS NULL THEN
    p_period_end := CURRENT_DATE;
  END IF;

  -- Generate batch number
  SELECT generate_batch_number(p_organization_id) INTO v_batch_number;

  -- Create the batch record
  INSERT INTO proda_claim_batches (
    organization_id, batch_number, status, total_claims, total_amount
  ) VALUES (
    p_organization_id, v_batch_number, 'draft', 0, 0
  ) RETURNING id INTO v_batch_id;

  -- Loop through approved schedule_blocks that are NDIS-billable and unbilled
  FOR v_shift IN
    SELECT
      sb.id,
      sb.start_time,
      sb.end_time,
      sb.participant_id,
      sb.worker_id,
      sb.ndis_support_item_number AS preset_code,
      sb.billable_rate AS preset_rate,
      sb.billable_hours AS preset_hours,
      pp.ndis_number,
      pp.mmm_classification,
      c.name AS participant_name
    FROM schedule_blocks sb
    JOIN participant_profiles pp ON pp.id = sb.participant_id
    JOIN clients c ON c.id = pp.client_id
    WHERE sb.organization_id = p_organization_id
      AND sb.participant_id IS NOT NULL
      AND sb.status IN ('completed', 'approved')
      AND sb.billed_at IS NULL
      AND sb.invoice_id IS NULL
      AND sb.start_time::DATE >= p_period_start
      AND sb.start_time::DATE <= p_period_end
      AND sb.end_time IS NOT NULL
    ORDER BY sb.start_time
  LOOP
    -- Validate participant has NDIS number
    IF v_shift.ndis_number IS NULL OR v_shift.ndis_number = '' THEN
      v_errors := v_errors || jsonb_build_object(
        'shift_id', v_shift.id,
        'error', 'Participant missing NDIS number',
        'participant', v_shift.participant_name
      );
      CONTINUE;
    END IF;

    -- Resolve NDIS support item code(s) for this shift
    FOR v_code_row IN
      SELECT * FROM resolve_ndis_support_item_code(
        v_shift.start_time,
        v_shift.end_time,
        p_organization_id
      )
    LOOP
      -- Use preset code/rate if available, otherwise use resolved values
      DECLARE
        v_item_code TEXT := COALESCE(v_shift.preset_code, v_code_row.support_item_number);
        v_item_rate NUMERIC := COALESCE(v_shift.preset_rate, v_code_row.rate);
        v_item_hours NUMERIC := COALESCE(v_shift.preset_hours, v_code_row.hours);
        v_line_total NUMERIC := ROUND(v_item_hours * v_item_rate, 2);
        v_claim_ref TEXT;
      BEGIN
        v_claim_ref := UPPER(SUBSTRING(v_batch_number FROM 7) || '-' || LPAD(v_claim_count::TEXT, 3, '0'));

        -- Insert claim line item
        INSERT INTO claim_line_items (
          organization_id, claim_batch_id, participant_id, worker_id,
          ndis_item_number, description, quantity, unit_rate,
          total_amount, gst_amount, service_date, status
        ) VALUES (
          p_organization_id, v_batch_id, v_shift.participant_id, v_shift.worker_id,
          v_item_code,
          v_code_row.rate_description || ' — ' || v_shift.participant_name,
          v_item_hours, v_item_rate,
          v_line_total, 0, v_shift.start_time::DATE, 'approved'
        );

        -- Build CSV row
        v_csv_rows := v_csv_rows || (
          v_reg_number || ',' ||
          v_shift.ndis_number || ',' ||
          TO_CHAR(v_shift.start_time AT TIME ZONE 'Australia/Brisbane', 'DD/MM/YYYY') || ',' ||
          TO_CHAR(v_shift.end_time AT TIME ZONE 'Australia/Brisbane', 'DD/MM/YYYY') || ',' ||
          v_item_code || ',' ||
          v_claim_ref || ',' ||
          TRIM(TO_CHAR(v_item_hours, '999990.99')) || ',' ||
          TRIM(TO_CHAR(v_item_rate, '999990.99')) || ',' ||
          'P1'  -- GST-free (NDIS services)
        );

        v_total_amount := v_total_amount + v_line_total;
        v_claim_count := v_claim_count + 1;
      END;
    END LOOP;

    -- Mark shift as billed
    UPDATE schedule_blocks
    SET billed_at = NOW()
    WHERE id = v_shift.id;
  END LOOP;

  -- Update batch totals
  UPDATE proda_claim_batches
  SET total_claims = v_claim_count,
      total_amount = v_total_amount,
      status = CASE WHEN v_claim_count > 0 THEN 'draft' ELSE 'failed' END
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_number', v_batch_number,
    'total_claims', v_claim_count,
    'total_amount', v_total_amount,
    'csv_header', v_csv_header,
    'csv_rows', v_csv_rows,
    'validation_errors', v_errors,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
END;
$$;

COMMENT ON FUNCTION public.generate_ndis_claim_batch IS
  'Zenith-Launch: Scans approved, unbilled schedule_blocks, resolves NDIS support item codes, creates claim_line_items, and returns CSV-ready data for PRODA portal upload.';


-- ── Public Holidays seed data (common Australian holidays) ───────────────────
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  name             TEXT NOT NULL,
  state            TEXT DEFAULT 'National',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date
  ON public.public_holidays (date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_org
  ON public.public_holidays (organization_id);

-- RLS
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_holidays_read" ON public.public_holidays
  FOR SELECT USING (
    organization_id IS NULL  -- National holidays visible to all
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "public_holidays_admin_write" ON public.public_holidays
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Seed 2026 national public holidays
INSERT INTO public.public_holidays (date, name, state) VALUES
  ('2026-01-01', 'New Year''s Day', 'National'),
  ('2026-01-26', 'Australia Day', 'National'),
  ('2026-04-03', 'Good Friday', 'National'),
  ('2026-04-04', 'Easter Saturday', 'National'),
  ('2026-04-06', 'Easter Monday', 'National'),
  ('2026-04-25', 'ANZAC Day', 'National'),
  ('2026-06-08', 'Queen''s Birthday (QLD)', 'QLD'),
  ('2026-06-08', 'Queen''s Birthday (VIC)', 'VIC'),
  ('2026-06-08', 'Queen''s Birthday (NSW)', 'NSW'),
  ('2026-06-08', 'Queen''s Birthday (SA)', 'SA'),
  ('2026-06-08', 'Queen''s Birthday (TAS)', 'TAS'),
  ('2026-06-08', 'Queen''s Birthday (ACT)', 'ACT'),
  ('2026-09-28', 'Queen''s Birthday (WA)', 'WA'),
  ('2026-12-25', 'Christmas Day', 'National'),
  ('2026-12-28', 'Boxing Day (observed)', 'National')
ON CONFLICT DO NOTHING;

-- ── Grant execute to authenticated users ─────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.resolve_ndis_support_item_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ndis_claim_batch TO authenticated;
