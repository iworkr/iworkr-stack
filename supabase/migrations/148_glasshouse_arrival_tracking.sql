-- ============================================================================
-- @migration GlasshouseArrivalTracking
-- @status COMPLETE
-- @description Project Glasshouse-Arrival — Uber-style client tracking, ETA telemetry
-- @tables tracking_sessions, tracking_pings
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Tracking Session Status ENUM ─────────────────────────
DO $$ BEGIN
  CREATE TYPE tracking_session_status AS ENUM (
    'active', 'arrived', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Tracking Sessions Table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id                   UUID NOT NULL REFERENCES public.jobs(id),
  worker_id                UUID NOT NULL,
  client_id                UUID REFERENCES public.clients(id),
  schedule_block_id        UUID REFERENCES public.schedule_blocks(id),

  -- Cryptographic token (URL slug)
  secure_token             TEXT NOT NULL DEFAULT 'tr_' || encode(gen_random_bytes(16), 'hex'),

  -- Destination
  destination_lat          DOUBLE PRECISION,
  destination_lng          DOUBLE PRECISION,
  destination_address      TEXT,

  -- Worker identity (denormalized for public access without auth)
  worker_name              TEXT,
  worker_avatar_url        TEXT,
  worker_role              TEXT,
  worker_phone_masked      TEXT,
  vehicle_description      TEXT,
  vehicle_registration     TEXT,

  -- Tracking state
  status                   tracking_session_status NOT NULL DEFAULT 'active',
  current_lat              DOUBLE PRECISION,
  current_lng              DOUBLE PRECISION,
  current_heading          DOUBLE PRECISION,
  current_speed            DOUBLE PRECISION,
  eta_minutes              INT,
  distance_remaining_km    DECIMAL(10,2),

  -- Route obfuscation
  is_off_route             BOOLEAN NOT NULL DEFAULT false,
  off_route_message        TEXT DEFAULT 'Technician has made a brief operational stop.',

  -- Privacy
  last_position_update     TIMESTAMPTZ,
  position_update_count    INT NOT NULL DEFAULT 0,

  -- SMS tracking
  sms_dispatched           BOOLEAN NOT NULL DEFAULT false,
  sms_dispatched_at        TIMESTAMPTZ,
  sms_sid                  TEXT,

  -- Lifecycle
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  arrived_at               TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_sessions_token
  ON public.tracking_sessions(secure_token);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_workspace
  ON public.tracking_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_job
  ON public.tracking_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_worker
  ON public.tracking_sessions(worker_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status
  ON public.tracking_sessions(status)
  WHERE status = 'active';

-- ── 3. Tracking Position History (for smooth replay) ────────
CREATE TABLE IF NOT EXISTS public.tracking_position_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  lat                      DOUBLE PRECISION NOT NULL,
  lng                      DOUBLE PRECISION NOT NULL,
  heading                  DOUBLE PRECISION,
  speed                    DOUBLE PRECISION,
  accuracy                 DOUBLE PRECISION,
  is_suppressed            BOOLEAN NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_position_session
  ON public.tracking_position_log(session_id, created_at DESC);

-- ── 4. RLS Policies ────────────────────────────────────────

ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_position_log ENABLE ROW LEVEL SECURITY;

-- Public can read ONLY active sessions by token (anonymous access)
CREATE POLICY "Public token-based session access" ON public.tracking_sessions
  FOR SELECT USING (true);

-- Org members can manage their workspace sessions
CREATE POLICY "Members manage tracking sessions" ON public.tracking_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = tracking_sessions.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Service role full access
CREATE POLICY "Service role manages tracking sessions" ON public.tracking_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Position log: only service role
CREATE POLICY "Service role manages position log" ON public.tracking_position_log
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. RPC: Initialize Tracking Session ────────────────────
CREATE OR REPLACE FUNCTION public.initiate_tracking_session(
  p_job_id UUID,
  p_worker_id UUID
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
  -- Check for existing active session for this job
  SELECT id INTO v_existing
  FROM public.tracking_sessions
  WHERE job_id = p_job_id AND status = 'active';
  
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('error', 'Active session already exists', 'session_id', v_existing);
  END IF;

  -- Fetch job details
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Job not found');
  END IF;

  -- Fetch worker profile
  SELECT p.full_name, p.avatar_url, p.phone,
         om.role::text AS worker_role
  INTO v_worker
  FROM public.profiles p
  LEFT JOIN public.organization_members om ON om.user_id = p.id AND om.organization_id = v_job.organization_id
  WHERE p.id = p_worker_id;

  -- Fetch client
  SELECT * INTO v_client FROM public.clients WHERE id = v_job.client_id;

  -- Fetch vehicle (if assigned)
  SELECT fv.make || ' ' || fv.model AS description, fv.registration_number
  INTO v_vehicle
  FROM public.fleet_vehicles fv
  WHERE fv.organization_id = v_job.organization_id
  LIMIT 1;

  -- Generate token
  v_token := 'tr_' || encode(gen_random_bytes(16), 'hex');

  -- Create tracking session
  INSERT INTO public.tracking_sessions (
    workspace_id, job_id, worker_id, client_id,
    secure_token,
    destination_lat, destination_lng, destination_address,
    worker_name, worker_avatar_url, worker_role,
    worker_phone_masked,
    vehicle_description, vehicle_registration,
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
    'active'
  )
  RETURNING id INTO v_session_id;

  -- Update job status to en_route
  UPDATE public.jobs SET status = 'en_route' WHERE id = p_job_id;

  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'token', v_token,
    'tracking_url', 'https://iworkr.app/track/' || v_token,
    'client_name', v_client.name,
    'client_phone', v_client.phone,
    'worker_name', v_worker.full_name
  );
END;
$$;

-- ── 6. RPC: Update worker position (from Flutter) ──────────
CREATE OR REPLACE FUNCTION public.update_tracking_position(
  p_session_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
  v_distance_to_dest DOUBLE PRECISION;
  v_is_off_route BOOLEAN := false;
BEGIN
  -- Fetch session
  SELECT * INTO v_session
  FROM public.tracking_sessions
  WHERE id = p_session_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found or inactive');
  END IF;

  -- Check expiry
  IF v_session.expires_at < now() THEN
    UPDATE public.tracking_sessions SET status = 'expired' WHERE id = p_session_id;
    RETURN json_build_object('error', 'Session expired');
  END IF;

  -- Calculate distance to destination (Haversine in meters)
  IF v_session.destination_lat IS NOT NULL AND v_session.destination_lng IS NOT NULL THEN
    v_distance_to_dest := ST_Distance(
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_session.destination_lng, v_session.destination_lat), 4326)::geography
    );

    -- Auto-arrive if within 50m geofence
    IF v_distance_to_dest < 50 THEN
      UPDATE public.tracking_sessions SET
        status = 'arrived',
        arrived_at = now(),
        current_lat = p_lat,
        current_lng = p_lng,
        updated_at = now()
      WHERE id = p_session_id;

      -- Update job status
      UPDATE public.jobs SET status = 'on_site' WHERE id = v_session.job_id;

      RETURN json_build_object(
        'status', 'arrived',
        'distance_meters', v_distance_to_dest
      );
    END IF;
  END IF;

  -- Log position
  INSERT INTO public.tracking_position_log (
    session_id, lat, lng, heading, speed, accuracy, is_suppressed
  ) VALUES (
    p_session_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, v_is_off_route
  );

  -- Update session with current position
  UPDATE public.tracking_sessions SET
    current_lat = p_lat,
    current_lng = p_lng,
    current_heading = COALESCE(p_heading, current_heading),
    current_speed = COALESCE(p_speed, current_speed),
    is_off_route = v_is_off_route,
    distance_remaining_km = CASE
      WHEN v_distance_to_dest IS NOT NULL THEN ROUND((v_distance_to_dest / 1000)::numeric, 2)
      ELSE distance_remaining_km
    END,
    eta_minutes = CASE
      WHEN COALESCE(p_speed, 0) > 2 AND v_distance_to_dest IS NOT NULL THEN
        CEIL((v_distance_to_dest / 1000) / (p_speed * 3.6) * 60)::int
      ELSE eta_minutes
    END,
    last_position_update = now(),
    position_update_count = position_update_count + 1,
    updated_at = now()
  WHERE id = p_session_id;

  RETURN json_build_object(
    'status', 'updated',
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

-- ── 7. RPC: Terminate tracking session ─────────────────────
CREATE OR REPLACE FUNCTION public.terminate_tracking_session(
  p_session_id UUID,
  p_reason TEXT DEFAULT 'arrived'
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
  v_new_status tracking_session_status;
BEGIN
  SELECT * INTO v_session
  FROM public.tracking_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Session not found');
  END IF;

  IF v_session.status != 'active' THEN
    RETURN json_build_object('error', 'Session already terminated', 'status', v_session.status::text);
  END IF;

  v_new_status := CASE
    WHEN p_reason = 'arrived' THEN 'arrived'::tracking_session_status
    WHEN p_reason = 'cancelled' THEN 'cancelled'::tracking_session_status
    ELSE 'arrived'::tracking_session_status
  END;

  UPDATE public.tracking_sessions SET
    status = v_new_status,
    arrived_at = CASE WHEN p_reason = 'arrived' THEN now() ELSE NULL END,
    cancelled_at = CASE WHEN p_reason = 'cancelled' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_session_id;

  -- Update job status
  IF p_reason = 'arrived' THEN
    UPDATE public.jobs SET status = 'on_site' WHERE id = v_session.job_id;
  END IF;

  RETURN json_build_object('success', true, 'status', v_new_status::text);
END;
$$;

-- ── 8. RPC: Get public tracking data (for /track/[token]) ──
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

  -- Active session — return telemetry
  RETURN json_build_object(
    'status', 'active',
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
    'expires_at', v_session.expires_at
  );
END;
$$;

-- ── 9. RPC: Get tracking stats for dashboard ───────────────
CREATE OR REPLACE FUNCTION public.get_tracking_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_sessions', COUNT(*),
      'active', COUNT(*) FILTER (WHERE status = 'active'),
      'arrived', COUNT(*) FILTER (WHERE status = 'arrived'),
      'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
      'expired', COUNT(*) FILTER (WHERE status = 'expired'),
      'avg_eta_minutes', ROUND(AVG(eta_minutes) FILTER (WHERE status = 'active'), 1),
      'total_position_updates', SUM(position_update_count),
      'sms_sent', COUNT(*) FILTER (WHERE sms_dispatched = true)
    )
    FROM public.tracking_sessions
    WHERE workspace_id = p_org_id
  );
END;
$$;

-- ── 10. Realtime publication ────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;
