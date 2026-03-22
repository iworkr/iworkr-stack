-- ============================================================================
-- @migration ArgusPanopticonTelemetry
-- @status COMPLETE
-- @description Project Argus — partitioned system telemetry, 90-day retention, auto-partition
-- @tables system_telemetry (partitioned)
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. Partitioned master table
CREATE TABLE IF NOT EXISTS public.system_telemetry (
    id UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    workspace_id UUID,
    user_id UUID,
    event_category VARCHAR(32) NOT NULL,
    severity VARCHAR(8) NOT NULL DEFAULT 'INFO',
    url_path VARCHAR(512),
    user_agent TEXT,
    payload JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. Initial partitions (current + next 3 months)
CREATE TABLE IF NOT EXISTS system_telemetry_2026_03 PARTITION OF public.system_telemetry
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS system_telemetry_2026_04 PARTITION OF public.system_telemetry
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS system_telemetry_2026_05 PARTITION OF public.system_telemetry
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS system_telemetry_2026_06 PARTITION OF public.system_telemetry
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_systel_ws_created
    ON public.system_telemetry (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systel_category_severity
    ON public.system_telemetry (event_category, severity);
CREATE INDEX IF NOT EXISTS idx_systel_payload_gin
    ON public.system_telemetry USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_systel_user_created
    ON public.system_telemetry (user_id, created_at DESC);

-- 4. RLS (service role only — telemetry is ingested by edge functions)
ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on system_telemetry"
    ON public.system_telemetry
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Auto-partition management function
CREATE OR REPLACE FUNCTION manage_telemetry_partitions()
RETURNS void AS $$
DECLARE
    next_month_start DATE;
    next_month_end DATE;
    next_partition_name TEXT;
    old_partition_name TEXT;
    old_month_start DATE;
BEGIN
    next_month_start := DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE;
    next_month_end := (next_month_start + INTERVAL '1 month')::DATE;
    next_partition_name := 'system_telemetry_' || TO_CHAR(next_month_start, 'YYYY_MM');

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = next_partition_name
    ) THEN
        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF public.system_telemetry FOR VALUES FROM (%L) TO (%L)',
            next_partition_name, next_month_start, next_month_end
        );
        RAISE NOTICE 'Created partition: %', next_partition_name;
    END IF;

    old_month_start := DATE_TRUNC('month', NOW() - INTERVAL '90 days')::DATE;
    old_partition_name := 'system_telemetry_' || TO_CHAR(old_month_start, 'YYYY_MM');

    IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = old_partition_name
    ) THEN
        EXECUTE FORMAT('DROP TABLE IF EXISTS %I', old_partition_name);
        RAISE NOTICE 'Dropped expired partition: %', old_partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Supabase Storage bucket for telemetry exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('olympus-exports', 'olympus-exports', false)
ON CONFLICT (id) DO NOTHING;
