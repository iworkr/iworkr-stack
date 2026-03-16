-- ============================================================================
-- Migration 118: Project Outrider — CarPlay & Android Auto Engine
-- 1) user_automotive_preferences — per-user car UI settings
-- 2) vehicle_transit_logs — telematics, mileage, safety override tracking
-- 3) Adds 'en_route' SMS notification trigger infrastructure
-- 4) RLS policies for all tables
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. User Automotive Preferences ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_automotive_preferences (
  user_id                   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Navigation defaults
  auto_start_navigation     BOOLEAN DEFAULT FALSE,
  preferred_maps_app        TEXT DEFAULT 'system'
                            CHECK (preferred_maps_app IN ('system', 'google_maps', 'waze', 'apple_maps')),

  -- Audio & TTS
  play_audio_briefings      BOOLEAN DEFAULT TRUE,
  tts_voice_id              TEXT,       -- OS-specific voice identifier
  tts_speed                 NUMERIC(3,2) DEFAULT 1.0,

  -- Privacy (enforced TRUE for Care sector)
  privacy_masking_enabled   BOOLEAN DEFAULT TRUE,

  -- Safe Driving Mode
  safe_driving_lock_enabled BOOLEAN DEFAULT TRUE,
  allow_passenger_override  BOOLEAN DEFAULT TRUE,

  -- Fleet Telemetry (opt-in, only for org vehicles)
  fleet_speed_monitoring    BOOLEAN DEFAULT FALSE,
  speed_threshold_kmh       INTEGER DEFAULT 15,  -- km/h over limit before flag

  -- Notification preferences
  send_eta_sms_to_client    BOOLEAN DEFAULT TRUE,
  eta_sms_template          TEXT DEFAULT 'Hi {{client_name}}, your {{worker_role}} {{worker_name}} is currently en route and should arrive in approximately {{eta_minutes}} minutes.',

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-provision when profile is created
CREATE OR REPLACE FUNCTION public.auto_provision_automotive_prefs()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_automotive_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_automotive_prefs ON public.profiles;
CREATE TRIGGER trg_auto_provision_automotive_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_provision_automotive_prefs();

-- Back-fill existing users
INSERT INTO public.user_automotive_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- ─── 2. Vehicle Transit Logs (Telematics) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicle_transit_logs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id           UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_id                  UUID,       -- References schedule_blocks or jobs
  vehicle_id                UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,

  -- Connection tracking
  connection_type           TEXT DEFAULT 'carplay'
                            CHECK (connection_type IN ('carplay', 'android_auto', 'wireless_carplay', 'wireless_aa')),
  connection_started_at     TIMESTAMPTZ NOT NULL,
  connection_ended_at       TIMESTAMPTZ,

  -- GPS data
  start_lat                 DOUBLE PRECISION,
  start_lng                 DOUBLE PRECISION,
  end_lat                   DOUBLE PRECISION,
  end_lng                   DOUBLE PRECISION,
  route_polyline            TEXT,       -- Encoded polyline for route visualization

  -- Calculated metrics
  distance_traveled_km      NUMERIC(10,2),
  duration_minutes          INTEGER,
  average_speed_kmh         NUMERIC(6,2),
  max_speed_kmh             NUMERIC(6,2),

  -- Safety tracking
  safety_overrides_triggered INTEGER DEFAULT 0,
  speed_violations           INTEGER DEFAULT 0,
  speed_violation_details    JSONB DEFAULT '[]'::JSONB,

  -- En-route SMS tracking
  eta_sms_sent              BOOLEAN DEFAULT FALSE,
  eta_sms_sent_at           TIMESTAMPTZ,
  eta_minutes_estimated     INTEGER,

  -- Handoff state
  handoff_route             TEXT,       -- GoRouter path pushed on disconnect
  handoff_completed         BOOLEAN DEFAULT FALSE,

  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_transit_user
  ON public.vehicle_transit_logs (user_id, connection_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_transit_org
  ON public.vehicle_transit_logs (organization_id, connection_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_transit_vehicle
  ON public.vehicle_transit_logs (vehicle_id)
  WHERE vehicle_id IS NOT NULL;


-- ─── 3. Automotive SOS Events (Aegis Extension) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.automotive_sos_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_id         UUID REFERENCES public.incidents(id) ON DELETE SET NULL,

  -- Location at time of SOS
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  speed_kmh           NUMERIC(6,2),

  -- Context
  shift_id            UUID,
  vehicle_id          UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  participant_in_vehicle BOOLEAN DEFAULT FALSE,

  -- Response
  status              TEXT DEFAULT 'triggered'
                      CHECK (status IN ('triggered', 'acknowledged', 'resolved', 'false_alarm')),
  acknowledged_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at     TIMESTAMPTZ,
  resolution_notes    TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_org
  ON public.automotive_sos_events (organization_id, created_at DESC);


-- ─── 4. Row-Level Security ──────────────────────────────────────────────────

ALTER TABLE public.user_automotive_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_transit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automotive_sos_events ENABLE ROW LEVEL SECURITY;

-- Automotive Preferences
CREATE POLICY "Users can manage own automotive prefs"
  ON public.user_automotive_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Transit Logs — users can read/insert own; admins read all for their org
CREATE POLICY "Users can read own transit logs"
  ON public.vehicle_transit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transit logs"
  ON public.vehicle_transit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins can read transit logs"
  ON public.vehicle_transit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = vehicle_transit_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- SOS Events — users insert; all org members read; admins update
CREATE POLICY "Users can trigger SOS"
  ON public.automotive_sos_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members can view SOS events"
  ON public.automotive_sos_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automotive_sos_events.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org admins can update SOS events"
  ON public.automotive_sos_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = automotive_sos_events.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- Service role access for Edge Functions
CREATE POLICY "Service role manages all transit logs"
  ON public.vehicle_transit_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages all SOS events"
  ON public.automotive_sos_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');


-- ─── 5. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.user_automotive_preferences IS
  'Project Outrider: Per-user CarPlay/Android Auto preferences, TTS settings, privacy masking.';
COMMENT ON TABLE public.vehicle_transit_logs IS
  'Project Outrider: Telematics log for each car connection session — GPS, distance, speed, safety overrides.';
COMMENT ON TABLE public.automotive_sos_events IS
  'Project Outrider: Emergency SOS events triggered from the car UI (Aegis extension for in-transit emergencies).';
