-- ============================================================================
-- @migration OutriderPulseLiveDispatch
-- @status COMPLETE
-- @description Project Outrider-Pulse — Live Dispatch Tracking Engine v186
--   Enhances tracking_sessions with ClickSend SMS, privacy obfuscation,
--   geofence approach state, PostGIS optimization, and TTL cron cleanup.
-- @tables tracking_sessions (ALTER), telemetry_pings (NEW)
-- @depends 148_glasshouse_arrival_tracking.sql
-- @lastAudit 2026-03-24
-- ============================================================================

-- ── 0. Enable PostGIS if not already ──────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- ── 1. Expand tracking_session_status ENUM ────────────────────
-- Add 'geofence_approach' for the 500m proximity zone
DO $$ BEGIN
  ALTER TYPE tracking_session_status ADD VALUE IF NOT EXISTS 'geofence_approach' AFTER 'active';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add Outrider-Pulse columns to tracking_sessions ───────
ALTER TABLE public.tracking_sessions
  ADD COLUMN IF NOT EXISTS origin_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS suppress_until_distance_m INT NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS origin_suppressed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_provider TEXT DEFAULT 'clicksend',
  ADD COLUMN IF NOT EXISTS sms_message_id TEXT,
  ADD COLUMN IF NOT EXISTS geofence_radius_m INT NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS geofence_approach_radius_m INT NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS eta_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_source TEXT DEFAULT 'speed_based',
  ADD COLUMN IF NOT EXISTS clicksend_status TEXT,
  ADD COLUMN IF NOT EXISTS clicksend_status_at TIMESTAMPTZ;

-- ── 3. Telemetry Pings — high-frequency breadcrumb table ─────
-- Separate from tracking_position_log for realtime streaming
CREATE TABLE IF NOT EXISTS public.telemetry_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  battery_pct INT,
  is_suppressed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_pings_session_time
  ON public.telemetry_pings(session_id, created_at DESC);

ALTER TABLE public.telemetry_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role manages telemetry pings"
  ON public.telemetry_pings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Public reads active session pings"
  ON public.telemetry_pings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracking_sessions ts
      WHERE ts.id = telemetry_pings.session_id
        AND ts.status IN ('active', 'geofence_approach')
    )
  );

-- Publish to realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry_pings;

-- ── 4. Enhanced RPC: Log telemetry ping with privacy logic ───
CREATE OR REPLACE FUNCTION public.log_telemetry_ping(
  p_session_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_altitude DOUBLE PRECISION DEFAULT NULL,
  p_battery_pct INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
  v_distance_to_dest DOUBLE PRECISION;
  v_distance_from_origin DOUBLE PRECISION;
  v_is_suppressed BOOLEAN := false;
  v_new_status tracking_session_status;
BEGIN
  SELECT * INTO v_session
  FROM public.tracking_sessions
  WHERE id = p_session_id AND status IN ('active', 'geofence_approach');

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found or inactive');
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.tracking_sessions SET status = 'expired', updated_at = now()
    WHERE id = p_session_id;
    RETURN json_build_object('error', 'Session expired', 'status', 'expired');
  END IF;

  v_new_status := v_session.status;

  -- Privacy obfuscation: suppress broadcast if too close to origin
  IF v_session.origin_suppressed AND v_session.origin_lat IS NOT NULL THEN
    v_distance_from_origin := ST_Distance(
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_session.origin_lng, v_session.origin_lat), 4326)::geography
    );

    IF v_distance_from_origin < v_session.suppress_until_distance_m THEN
      v_is_suppressed := true;
    ELSE
      UPDATE public.tracking_sessions SET origin_suppressed = false WHERE id = p_session_id;
    END IF;
  END IF;

  -- Calculate distance to destination
  IF v_session.destination_lat IS NOT NULL AND v_session.destination_lng IS NOT NULL THEN
    v_distance_to_dest := ST_Distance(
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_session.destination_lng, v_session.destination_lat), 4326)::geography
    );

    -- Auto-arrive if within geofence radius (150m default)
    IF v_distance_to_dest < v_session.geofence_radius_m THEN
      UPDATE public.tracking_sessions SET
        status = 'arrived',
        arrived_at = now(),
        current_lat = p_lat,
        current_lng = p_lng,
        updated_at = now()
      WHERE id = p_session_id;

      UPDATE public.jobs SET status = 'on_site' WHERE id = v_session.job_id;

      INSERT INTO public.telemetry_pings (
        session_id, lat, lng, heading, speed, accuracy, altitude, battery_pct, is_suppressed
      ) VALUES (
        p_session_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, p_altitude, p_battery_pct, false
      );

      RETURN json_build_object(
        'status', 'arrived',
        'distance_meters', v_distance_to_dest
      );
    END IF;

    -- Geofence approach: within 500m
    IF v_distance_to_dest < v_session.geofence_approach_radius_m AND v_session.status = 'active' THEN
      v_new_status := 'geofence_approach';
      UPDATE public.tracking_sessions SET status = 'geofence_approach' WHERE id = p_session_id;
    END IF;
  END IF;

  -- Insert telemetry ping
  INSERT INTO public.telemetry_pings (
    session_id, lat, lng, heading, speed, accuracy, altitude, battery_pct, is_suppressed
  ) VALUES (
    p_session_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, p_altitude, p_battery_pct, v_is_suppressed
  );

  -- Update session with current position (only if not suppressed)
  IF NOT v_is_suppressed THEN
    UPDATE public.tracking_sessions SET
      current_lat = p_lat,
      current_lng = p_lng,
      current_heading = COALESCE(p_heading, current_heading),
      current_speed = COALESCE(p_speed, current_speed),
      distance_remaining_km = CASE
        WHEN v_distance_to_dest IS NOT NULL THEN ROUND((v_distance_to_dest / 1000)::numeric, 2)
        ELSE distance_remaining_km
      END,
      eta_minutes = CASE
        WHEN COALESCE(p_speed, 0) > 2 AND v_distance_to_dest IS NOT NULL THEN
          CEIL((v_distance_to_dest / 1000) / (p_speed * 3.6) * 60)::int
        ELSE eta_minutes
      END,
      eta_source = 'speed_based',
      eta_calculated_at = now(),
      last_position_update = now(),
      position_update_count = position_update_count + 1,
      updated_at = now()
    WHERE id = p_session_id;
  END IF;

  RETURN json_build_object(
    'status', v_new_status::text,
    'suppressed', v_is_suppressed,
    'distance_meters', v_distance_to_dest,
    'distance_km', ROUND((COALESCE(v_distance_to_dest, 0) / 1000)::numeric, 2),
    'eta_minutes', CASE
      WHEN COALESCE(p_speed, 0) > 2 AND v_distance_to_dest IS NOT NULL THEN
        CEIL((v_distance_to_dest / 1000) / (p_speed * 3.6) * 60)::int
      ELSE NULL
    END
  );
END;
$$;

-- ── 5. Enhanced initiate_tracking_session with origin coords ──
CREATE OR REPLACE FUNCTION public.initiate_tracking_session(
  p_job_id UUID,
  p_worker_id UUID,
  p_origin_lat DOUBLE PRECISION DEFAULT NULL,
  p_origin_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_worker RECORD;
  v_client RECORD;
  v_vehicle RECORD;
  v_session_id UUID;
  v_token TEXT;
  v_existing UUID;
BEGIN
  SELECT id INTO v_existing
  FROM public.tracking_sessions
  WHERE job_id = p_job_id AND status IN ('active', 'geofence_approach');

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('error', 'Active session already exists', 'session_id', v_existing);
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Job not found');
  END IF;

  SELECT p.full_name, p.avatar_url, p.phone,
         om.role::text AS worker_role
  INTO v_worker
  FROM public.profiles p
  LEFT JOIN public.organization_members om ON om.user_id = p.id AND om.organization_id = v_job.organization_id
  WHERE p.id = p_worker_id;

  SELECT * INTO v_client FROM public.clients WHERE id = v_job.client_id;

  SELECT fv.make || ' ' || fv.model AS description, fv.registration_number
  INTO v_vehicle
  FROM public.fleet_vehicles fv
  WHERE fv.organization_id = v_job.organization_id
  LIMIT 1;

  v_token := 'tr_' || encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.tracking_sessions (
    workspace_id, job_id, worker_id, client_id,
    secure_token,
    destination_lat, destination_lng, destination_address,
    worker_name, worker_avatar_url, worker_role,
    worker_phone_masked,
    vehicle_description, vehicle_registration,
    origin_lat, origin_lng,
    origin_suppressed,
    status
  ) VALUES (
    v_job.organization_id, p_job_id, p_worker_id, v_job.client_id,
    v_token,
    COALESCE(v_job.site_lat::double precision, v_job.location_lat),
    COALESCE(v_job.site_lng::double precision, v_job.location_lng),
    v_job.location,
    v_worker.full_name,
    v_worker.avatar_url,
    COALESCE(v_worker.worker_role, 'technician'),
    CASE WHEN v_worker.phone IS NOT NULL THEN
      SUBSTRING(v_worker.phone FROM 1 FOR 4) || '****' || RIGHT(v_worker.phone, 2)
    ELSE NULL END,
    v_vehicle.description,
    v_vehicle.registration_number,
    p_origin_lat,
    p_origin_lng,
    CASE WHEN p_origin_lat IS NOT NULL THEN true ELSE false END,
    'active'
  )
  RETURNING id INTO v_session_id;

  UPDATE public.jobs SET status = 'en_route' WHERE id = p_job_id;

  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'token', v_token,
    'tracking_url', 'https://iworkr.app/track/' || v_token,
    'client_name', v_client.name,
    'client_phone', v_client.phone,
    'client_email', v_client.email,
    'worker_name', v_worker.full_name,
    'destination_lat', COALESCE(v_job.site_lat::double precision, v_job.location_lat),
    'destination_lng', COALESCE(v_job.site_lng::double precision, v_job.location_lng)
  );
END;
$$;

-- ── 6. TTL Cron: Expire stale sessions every 15 minutes ──────
SELECT cron.schedule(
  'expire-stale-tracking-sessions',
  '*/15 * * * *',
  $$
    UPDATE public.tracking_sessions
    SET status = 'expired', updated_at = now()
    WHERE status IN ('active', 'geofence_approach')
      AND expires_at < now();
  $$
);

-- ── 7. Enhanced get_tracking_by_token with approach state ────
CREATE OR REPLACE FUNCTION public.get_tracking_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session
  FROM public.tracking_sessions
  WHERE secure_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found', 'message', 'Tracking session not found');
  END IF;

  IF v_session.status = 'expired' OR v_session.expires_at < now() THEN
    RETURN json_build_object('error', 'expired', 'message', 'This tracking link has expired');
  END IF;

  IF v_session.status = 'cancelled' THEN
    RETURN json_build_object('error', 'cancelled', 'message', 'This session was cancelled');
  END IF;

  IF v_session.status = 'arrived' THEN
    RETURN json_build_object(
      'status', 'arrived',
      'worker_name', v_session.worker_name,
      'worker_avatar_url', v_session.worker_avatar_url,
      'arrived_at', v_session.arrived_at,
      'destination_address', v_session.destination_address
    );
  END IF;

  RETURN json_build_object(
    'status', v_session.status::text,
    'session_id', v_session.id,
    'worker_name', v_session.worker_name,
    'worker_avatar_url', v_session.worker_avatar_url,
    'worker_role', v_session.worker_role,
    'worker_phone_masked', v_session.worker_phone_masked,
    'vehicle_description', v_session.vehicle_description,
    'vehicle_registration', v_session.vehicle_registration,
    'destination_lat', v_session.destination_lat,
    'destination_lng', v_session.destination_lng,
    'destination_address', v_session.destination_address,
    'current_lat', v_session.current_lat,
    'current_lng', v_session.current_lng,
    'current_heading', v_session.current_heading,
    'current_speed', v_session.current_speed,
    'eta_minutes', v_session.eta_minutes,
    'distance_remaining_km', v_session.distance_remaining_km,
    'is_off_route', v_session.is_off_route,
    'off_route_message', v_session.off_route_message,
    'last_position_update', v_session.last_position_update,
    'created_at', v_session.created_at,
    'expires_at', v_session.expires_at,
    'geofence_approach', v_session.status::text = 'geofence_approach'
  );
END;
$$;
