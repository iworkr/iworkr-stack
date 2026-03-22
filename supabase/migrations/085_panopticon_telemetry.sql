-- ============================================================================
-- @migration PanopticonTelemetry
-- @status COMPLETE
-- @description Project Panopticon — partitioned telemetry events, crash analytics, screenshots
-- @tables telemetry_events (partitioned), storage bucket: telemetry-screenshots
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. Telemetry Events (Partitioned by month) ────────────────────────────

-- Drop any existing non-partitioned table if it conflicts
-- (The types.ts shows a legacy telemetry_events table for job telemetry;
-- we rename that first if it exists to avoid collision)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'telemetry_events'
  ) THEN
    -- Only rename if it's NOT already partitioned
    IF NOT EXISTS (
      SELECT 1 FROM pg_partitioned_table
      WHERE partrelid = 'public.telemetry_events'::regclass
    ) THEN
      ALTER TABLE public.telemetry_events RENAME TO telemetry_events_legacy_jobs;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if already renamed or doesn't exist
END $$;

-- Create the partitioned telemetry table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'telemetry_events'
  ) THEN
    CREATE TABLE public.telemetry_events (
      id                uuid NOT NULL DEFAULT gen_random_uuid(),
      event_timestamp   timestamptz NOT NULL DEFAULT now(),

      -- Severity & classification
      severity          text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'fatal')),
      status            text NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'investigating', 'resolved', 'ignored')),

      -- Identity
      organization_id   uuid,
      user_id           uuid,
      user_email        text,
      branch_id         text,
      industry_mode     text,
      user_role         text,

      -- Environment
      platform          text CHECK (platform IN ('web', 'mobile_ios', 'mobile_android', 'desktop', 'edge_function')),
      os_version        text,
      app_version       text,
      device_model      text,

      -- Telemetry
      network_type      text,
      effective_bandwidth text,
      is_offline_mode   boolean DEFAULT false,
      gps_lat           numeric(10,7),
      gps_lng           numeric(10,7),
      memory_usage_mb   numeric(8,2),
      battery_level     integer,

      -- Context
      route             text,
      last_action       text,
      error_name        text,
      error_message     text,
      stack_trace       text,

      -- Full autopsy payload (the complete JSON blob)
      payload           jsonb NOT NULL DEFAULT '{}'::jsonb,

      -- Visual evidence
      has_screenshot    boolean DEFAULT false,
      screenshot_path   text,

      -- Console buffer (last 50 logs)
      console_buffer    jsonb DEFAULT '[]'::jsonb,

      -- Resolution
      resolved_by       uuid,
      resolved_at       timestamptz,
      resolution_notes  text,

      PRIMARY KEY (id, event_timestamp)
    ) PARTITION BY RANGE (event_timestamp);
  END IF;
END $$;

-- Create partitions for current and next 3 months
DO $$ 
DECLARE
  start_date date;
  end_date date;
  partition_name text;
  i int;
BEGIN
  FOR i IN 0..3 LOOP
    start_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
    end_date := start_date + '1 month'::interval;
    partition_name := 'telemetry_events_' || to_char(start_date, 'YYYY_MM');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.telemetry_events
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
    END IF;
  END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_org
  ON public.telemetry_events (organization_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_severity
  ON public.telemetry_events (severity, status, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_user
  ON public.telemetry_events (user_id, event_timestamp DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telemetry_route
  ON public.telemetry_events (route, event_timestamp DESC)
  WHERE route IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telemetry_status
  ON public.telemetry_events (status)
  WHERE status = 'unresolved';

-- RLS Policies
DO $$ BEGIN
  -- Anyone can insert (the client sends crash reports)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telemetry_events' AND policyname = 'Anyone can report telemetry') THEN
    EXECUTE 'CREATE POLICY "Anyone can report telemetry" ON public.telemetry_events FOR INSERT WITH CHECK (true)';
  END IF;

  -- Only super admins can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telemetry_events' AND policyname = 'Super admins read telemetry') THEN
    EXECUTE 'CREATE POLICY "Super admins read telemetry" ON public.telemetry_events FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
    )';
  END IF;

  -- Only super admins can update (resolve/investigate)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telemetry_events' AND policyname = 'Super admins update telemetry') THEN
    EXECUTE 'CREATE POLICY "Super admins update telemetry" ON public.telemetry_events FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
    )';
  END IF;
END $$;

-- ─── 2. Storage Bucket for Screenshots ──────────────────────────────────────

-- Create the bucket (idempotent via ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'telemetry_snapshots',
  'telemetry_snapshots',
  false,
  5242880,  -- 5MB max per screenshot
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated users can upload crash snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Users upload crash snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Users upload crash snapshots" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = ''telemetry_snapshots'')';
  END IF;

  -- Super admins can view snapshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'Super admins view crash snapshots'
  ) THEN
    EXECUTE 'CREATE POLICY "Super admins view crash snapshots" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = ''telemetry_snapshots''
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_super_admin = true
        )
      )';
  END IF;
END $$;

-- ─── 3. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.telemetry_events IS 'Project Panopticon: Partitioned crash/error telemetry with full autopsy payloads. Monthly partitions for IOPS isolation.';
