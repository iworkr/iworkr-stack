-- ============================================================
-- Migration 044: Live Tracking RPCs
-- Replaces get_live_dispatch to use fleet_positions for real GPS
-- Adds update_fleet_position for web clients
-- ============================================================

-- ── 1. Replace get_live_dispatch to use fleet_positions ──
CREATE OR REPLACE FUNCTION public.get_live_dispatch(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      COALESCE(fp.id::text, om.user_id::text) AS id,
      p.full_name AS name,
      fp.lat AS location_lat,
      fp.lng AS location_lng,
      fp.heading,
      fp.speed,
      fp.battery,
      fp.accuracy,
      fp.status AS gps_status,
      fp.updated_at AS position_updated_at,
      cj.id AS current_job_id,
      cj.title AS task,
      cj.status AS job_status,
      cj.location,
      p.id AS technician_id,
      CASE
        WHEN cj.status = 'in_progress' THEN 'on_job'
        WHEN fp.status = 'driving' THEN 'en_route'
        WHEN fp.lat IS NOT NULL THEN 'idle'
        ELSE 'offline'
      END AS dispatch_status
    FROM public.organization_members om
    JOIN public.profiles p ON p.id = om.user_id
    LEFT JOIN public.fleet_positions fp
      ON fp.user_id = om.user_id
      AND fp.organization_id = p_org_id
    LEFT JOIN LATERAL (
      SELECT j.id, j.title, j.status, j.location
      FROM public.jobs j
      WHERE j.assignee_id = om.user_id
        AND j.organization_id = p_org_id
        AND j.status = 'in_progress'
        AND j.deleted_at IS NULL
      ORDER BY j.updated_at DESC
      LIMIT 1
    ) cj ON true
    WHERE om.organization_id = p_org_id
      AND om.status = 'active'
      AND (
        fp.lat IS NOT NULL
        OR cj.id IS NOT NULL
      )
    ORDER BY
      CASE
        WHEN cj.status = 'in_progress' THEN 1
        WHEN fp.status = 'driving' THEN 2
        WHEN fp.lat IS NOT NULL THEN 3
        ELSE 4
      END,
      fp.updated_at DESC NULLS LAST
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ── 2. update_fleet_position RPC for web/mobile clients ──
CREATE OR REPLACE FUNCTION public.update_fleet_position(
  p_org_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision DEFAULT NULL,
  p_speed double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_battery integer DEFAULT NULL,
  p_status text DEFAULT 'idle'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_job_id uuid;
BEGIN
  SELECT id INTO v_current_job_id
  FROM public.jobs
  WHERE assignee_id = v_user_id
    AND organization_id = p_org_id
    AND status = 'in_progress'
    AND deleted_at IS NULL
  LIMIT 1;

  INSERT INTO public.fleet_positions (
    organization_id, user_id, lat, lng, heading, speed, accuracy, battery, status, current_job_id, updated_at
  ) VALUES (
    p_org_id, v_user_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, p_battery, p_status, v_current_job_id, now()
  )
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    accuracy = EXCLUDED.accuracy,
    battery = EXCLUDED.battery,
    status = EXCLUDED.status,
    current_job_id = v_current_job_id,
    updated_at = now();

  INSERT INTO public.position_history (
    organization_id, user_id, lat, lng, heading, speed, status, recorded_at
  ) VALUES (
    p_org_id, v_user_id, p_lat, p_lng, p_heading, p_speed, p_status, now()
  );

  RETURN json_build_object('success', true);
END;
$$;
