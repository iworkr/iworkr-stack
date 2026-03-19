-- ============================================================
-- Migration 147: Project Glasshouse-Triage — Public Smart Booking Widget
-- Version 149.0 — "Zero-Touch Revenue & Algorithmic Dispatch"
-- ============================================================

-- ── 1. Booking Intent Status ENUM ───────────────────────────
DO $$ BEGIN
  CREATE TYPE booking_intent_status AS ENUM (
    'initiated',
    'triage_complete',
    'scheduling_selected',
    'payment_pending',
    'converted_to_job',
    'abandoned',
    'abandoned_capacity',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Widget Configuration Table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.public_booking_widgets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL DEFAULT 'Default Widget',
  is_active                BOOLEAN NOT NULL DEFAULT true,

  -- CORS & embedding
  allowed_domains          JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  embed_script_token       TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Branding
  branding_config          JSONB NOT NULL DEFAULT '{
    "primary_color": "#10B981",
    "mode": "dark",
    "logo_url": null,
    "company_name": null,
    "welcome_message": "Book a service online"
  }'::jsonb,

  -- Scheduling constraints
  call_out_fee_amount      DECIMAL(10,2) NOT NULL DEFAULT 99.00,
  scheduling_horizon_days  INT NOT NULL DEFAULT 14,
  minimum_buffer_minutes   INT NOT NULL DEFAULT 15,
  max_travel_radius_km     INT NOT NULL DEFAULT 50,
  slot_window_hours        INT NOT NULL DEFAULT 3,

  -- Required skills for this widget
  required_skills          TEXT[] DEFAULT '{}',

  -- Stripe
  stripe_account_id        TEXT,

  -- Rate limiting
  max_requests_per_ip_hour INT NOT NULL DEFAULT 5,

  -- Metadata
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_widgets_workspace
  ON public.public_booking_widgets(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_widgets_token
  ON public.public_booking_widgets(embed_script_token);

-- ── 3. Triage Decision Trees ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.triage_trees (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id                UUID NOT NULL REFERENCES public.public_booking_widgets(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL DEFAULT 'Default Triage',
  version                  INT NOT NULL DEFAULT 1,
  is_active                BOOLEAN NOT NULL DEFAULT true,

  -- The DAG: JSONB graph of questions, answers, and outcomes
  tree_graph               JSONB NOT NULL DEFAULT '{
    "nodes": [
      {
        "id": "q1",
        "type": "QUESTION",
        "text": "What service do you need?",
        "icon": "wrench",
        "answers": [
          { "text": "Plumbing", "next_node": "q2" },
          { "text": "Electrical", "next_node": "q3" },
          { "text": "HVAC / Air Conditioning", "next_node": "q4" },
          { "text": "General Maintenance", "next_node": "result_general" }
        ]
      },
      {
        "id": "q2",
        "type": "QUESTION",
        "text": "Is there active flooding or water damage?",
        "icon": "droplets",
        "answers": [
          { "text": "Yes — Water is flowing now", "next_node": "result_emergency_plumbing", "is_urgent": true },
          { "text": "No — Standard plumbing issue", "next_node": "result_standard_plumbing" }
        ]
      },
      {
        "id": "q3",
        "type": "QUESTION",
        "text": "Is there exposed wiring or sparking?",
        "icon": "zap",
        "answers": [
          { "text": "Yes — Sparking or burning smell", "next_node": "result_emergency_electrical", "is_urgent": true },
          { "text": "No — Standard electrical issue", "next_node": "result_standard_electrical" }
        ]
      },
      {
        "id": "q4",
        "type": "QUESTION",
        "text": "What HVAC issue are you experiencing?",
        "icon": "thermometer",
        "answers": [
          { "text": "No cooling / heating", "next_node": "result_hvac_repair" },
          { "text": "Regular service / maintenance", "next_node": "result_hvac_service" }
        ]
      },
      {
        "id": "result_emergency_plumbing",
        "type": "OUTCOME",
        "job_category": "EMERGENCY",
        "service_label": "Emergency Plumbing",
        "base_duration_mins": 60,
        "priority": "urgent",
        "required_skills": ["plumbing"],
        "base_estimate_cents": 29900
      },
      {
        "id": "result_standard_plumbing",
        "type": "OUTCOME",
        "job_category": "STANDARD",
        "service_label": "Standard Plumbing Diagnostic",
        "base_duration_mins": 60,
        "priority": "medium",
        "required_skills": ["plumbing"],
        "base_estimate_cents": 15000
      },
      {
        "id": "result_emergency_electrical",
        "type": "OUTCOME",
        "job_category": "EMERGENCY",
        "service_label": "Emergency Electrical",
        "base_duration_mins": 90,
        "priority": "urgent",
        "required_skills": ["electrical"],
        "base_estimate_cents": 34900
      },
      {
        "id": "result_standard_electrical",
        "type": "OUTCOME",
        "job_category": "STANDARD",
        "service_label": "Standard Electrical Service",
        "base_duration_mins": 60,
        "priority": "medium",
        "required_skills": ["electrical"],
        "base_estimate_cents": 15000
      },
      {
        "id": "result_hvac_repair",
        "type": "OUTCOME",
        "job_category": "STANDARD",
        "service_label": "HVAC Repair",
        "base_duration_mins": 120,
        "priority": "medium",
        "required_skills": ["hvac"],
        "base_estimate_cents": 25000
      },
      {
        "id": "result_hvac_service",
        "type": "OUTCOME",
        "job_category": "STANDARD",
        "service_label": "HVAC Service & Maintenance",
        "base_duration_mins": 90,
        "priority": "low",
        "required_skills": ["hvac"],
        "base_estimate_cents": 19900
      },
      {
        "id": "result_general",
        "type": "OUTCOME",
        "job_category": "STANDARD",
        "service_label": "General Maintenance",
        "base_duration_mins": 60,
        "priority": "low",
        "required_skills": [],
        "base_estimate_cents": 12000
      }
    ],
    "start_node": "q1"
  }'::jsonb,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triage_trees_widget
  ON public.triage_trees(widget_id);

-- ── 4. Booking Intents ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_intents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget_id                UUID REFERENCES public.public_booking_widgets(id),

  -- Session & anti-spam
  session_token            TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  ip_address               INET,

  -- Client details (pre-account creation)
  client_first_name        TEXT,
  client_last_name         TEXT,
  client_phone             TEXT,
  client_email             TEXT,
  service_address          TEXT,

  -- PostGIS coordinate
  service_location         GEOGRAPHY(POINT, 4326),

  -- Triage outcome
  triage_path              JSONB DEFAULT '[]'::jsonb,
  triage_outcome           JSONB,

  -- Photo upload
  photo_urls               TEXT[] DEFAULT '{}',

  -- Scheduling selection
  selected_technician_id   UUID,
  selected_window_start    TIMESTAMPTZ,
  selected_window_end      TIMESTAMPTZ,
  estimated_duration_mins  INT,

  -- Slot lock (expiring reservation)
  slot_locked_at           TIMESTAMPTZ,
  slot_lock_expires_at     TIMESTAMPTZ,

  -- Payment
  stripe_payment_intent_id TEXT,
  deposit_amount_cents     INT,
  payment_status           TEXT DEFAULT 'pending',

  -- Conversion references
  converted_job_id         UUID REFERENCES public.jobs(id),
  converted_client_id      UUID REFERENCES public.clients(id),
  converted_schedule_id    UUID REFERENCES public.schedule_blocks(id),

  -- Status
  status                   booking_intent_status NOT NULL DEFAULT 'initiated',

  -- Timestamps
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at             TIMESTAMPTZ,
  abandoned_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_booking_intents_workspace
  ON public.booking_intents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_intents_status
  ON public.booking_intents(status);
CREATE INDEX IF NOT EXISTS idx_booking_intents_session
  ON public.booking_intents(session_token);
CREATE INDEX IF NOT EXISTS idx_booking_intents_slot_lock
  ON public.booking_intents(slot_locked_at)
  WHERE slot_lock_expires_at IS NOT NULL;
-- Spatial index on service_location
CREATE INDEX IF NOT EXISTS idx_booking_intents_location
  ON public.booking_intents USING GIST (service_location);

-- ── 5. Slot Reservations (Expiring Locks) ───────────────────
CREATE TABLE IF NOT EXISTS public.slot_reservations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL,
  booking_intent_id        UUID NOT NULL REFERENCES public.booking_intents(id) ON DELETE CASCADE,
  technician_id            UUID NOT NULL,
  reserved_start           TIMESTAMPTZ NOT NULL,
  reserved_end             TIMESTAMPTZ NOT NULL,
  expires_at               TIMESTAMPTZ NOT NULL,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slot_reservations_tech_time
  ON public.slot_reservations(technician_id, reserved_start, reserved_end)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_slot_reservations_expiry
  ON public.slot_reservations(expires_at)
  WHERE is_active = true;

-- ── 6. Rate Limiting Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.widget_rate_limits (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address               INET NOT NULL,
  widget_id                UUID NOT NULL,
  request_count            INT NOT NULL DEFAULT 1,
  window_start             TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end               TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_widget
  ON public.widget_rate_limits(ip_address, widget_id, window_start);

-- ── 7. RLS Policies ────────────────────────────────────────

ALTER TABLE public.public_booking_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_rate_limits ENABLE ROW LEVEL SECURITY;

-- Widgets: org members can manage
CREATE POLICY "Members manage widgets" ON public.public_booking_widgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = public_booking_widgets.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Triage trees: org members can manage (via widget)
CREATE POLICY "Members manage triage trees" ON public.triage_trees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.public_booking_widgets w
      JOIN public.organization_members om ON om.organization_id = w.workspace_id
      WHERE w.id = triage_trees.widget_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Booking intents: org members can read, service role can insert (public API)
CREATE POLICY "Members read booking intents" ON public.booking_intents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = booking_intents.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Service role full access for booking intents (Edge Functions)
CREATE POLICY "Service role manages booking intents" ON public.booking_intents
  FOR ALL USING (auth.role() = 'service_role');

-- Slot reservations: service role only
CREATE POLICY "Service role manages slot reservations" ON public.slot_reservations
  FOR ALL USING (auth.role() = 'service_role');

-- Rate limits: service role only
CREATE POLICY "Service role manages rate limits" ON public.widget_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- ── 8. RPC: Expire stale slot locks ────────────────────────
CREATE OR REPLACE FUNCTION public.expire_stale_slot_locks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
BEGIN
  -- Expire slot reservations
  UPDATE public.slot_reservations
  SET is_active = false
  WHERE is_active = true AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark corresponding booking intents as expired
  UPDATE public.booking_intents bi
  SET status = 'expired',
      abandoned_at = now(),
      updated_at = now()
  WHERE bi.status IN ('scheduling_selected', 'payment_pending')
    AND bi.slot_lock_expires_at IS NOT NULL
    AND bi.slot_lock_expires_at < now();

  RETURN v_count;
END;
$$;

-- ── 9. RPC: Check slot availability (anti-double-booking) ──
CREATE OR REPLACE FUNCTION public.check_slot_available(
  p_technician_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_exclude_intent_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conflict_count INT;
BEGIN
  -- Check schedule_blocks for conflicts
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.schedule_blocks
  WHERE technician_id = p_technician_id
    AND status::text NOT IN ('cancelled')
    AND start_time < p_end
    AND end_time > p_start;

  IF v_conflict_count > 0 THEN RETURN false; END IF;

  -- Check active slot reservations
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.slot_reservations
  WHERE technician_id = p_technician_id
    AND is_active = true
    AND expires_at > now()
    AND reserved_start < p_end
    AND reserved_end > p_start
    AND (p_exclude_intent_id IS NULL OR booking_intent_id != p_exclude_intent_id);

  RETURN v_conflict_count = 0;
END;
$$;

-- ── 10. RPC: Atomic booking conversion ─────────────────────
CREATE OR REPLACE FUNCTION public.convert_booking_to_job(
  p_intent_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_intent RECORD;
  v_client_id UUID;
  v_job_id UUID;
  v_schedule_id UUID;
  v_display_id TEXT;
BEGIN
  -- Lock and fetch the intent
  SELECT * INTO v_intent
  FROM public.booking_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Booking intent not found');
  END IF;

  IF v_intent.status = 'converted_to_job' THEN
    RETURN json_build_object('error', 'Already converted', 'job_id', v_intent.converted_job_id);
  END IF;

  -- 1. Create or find client
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE organization_id = v_intent.workspace_id
    AND (email = v_intent.client_email OR phone = v_intent.client_phone)
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      organization_id, name, email, phone, address,
      address_lat, address_lng, lead_source, status
    ) VALUES (
      v_intent.workspace_id,
      COALESCE(v_intent.client_first_name, '') || ' ' || COALESCE(v_intent.client_last_name, ''),
      v_intent.client_email,
      v_intent.client_phone,
      v_intent.service_address,
      ST_Y(v_intent.service_location::geometry),
      ST_X(v_intent.service_location::geometry),
      'booking_widget',
      'active'
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- 2. Generate display_id
  SELECT 'WDG-' || LPAD((COUNT(*) + 1)::text, 4, '0') INTO v_display_id
  FROM public.jobs WHERE organization_id = v_intent.workspace_id;

  -- 3. Create job
  INSERT INTO public.jobs (
    organization_id, display_id, title, description,
    status, priority, client_id, assignee_id,
    due_date, location, location_lat, location_lng,
    estimated_duration_minutes, labels,
    revenue, metadata
  ) VALUES (
    v_intent.workspace_id,
    v_display_id,
    COALESCE((v_intent.triage_outcome->>'service_label'), 'Widget Booking'),
    'Booked via public widget. Triage: ' || COALESCE(v_intent.triage_outcome::text, '{}'),
    'scheduled'::job_status,
    COALESCE((v_intent.triage_outcome->>'priority'), 'medium')::job_priority,
    v_client_id,
    v_intent.selected_technician_id,
    v_intent.selected_window_start,
    v_intent.service_address,
    ST_Y(v_intent.service_location::geometry),
    ST_X(v_intent.service_location::geometry),
    v_intent.estimated_duration_mins,
    ARRAY[COALESCE((v_intent.triage_outcome->>'job_category'), 'STANDARD')],
    COALESCE(v_intent.deposit_amount_cents, 0) / 100.0,
    jsonb_build_object(
      'source', 'booking_widget',
      'widget_id', v_intent.widget_id,
      'intent_id', v_intent.id,
      'stripe_payment_intent', v_intent.stripe_payment_intent_id,
      'triage_path', v_intent.triage_path,
      'photo_urls', v_intent.photo_urls
    )
  )
  RETURNING id INTO v_job_id;

  -- 4. Create schedule block
  INSERT INTO public.schedule_blocks (
    organization_id, job_id, technician_id,
    title, client_name, location,
    start_time, end_time, status,
    metadata
  ) VALUES (
    v_intent.workspace_id,
    v_job_id,
    v_intent.selected_technician_id,
    COALESCE((v_intent.triage_outcome->>'service_label'), 'Widget Booking'),
    COALESCE(v_intent.client_first_name, '') || ' ' || COALESCE(v_intent.client_last_name, ''),
    v_intent.service_address,
    v_intent.selected_window_start,
    v_intent.selected_window_end,
    'scheduled'::schedule_block_status,
    jsonb_build_object('source', 'booking_widget', 'intent_id', v_intent.id)
  )
  RETURNING id INTO v_schedule_id;

  -- 5. Update booking intent
  UPDATE public.booking_intents SET
    status = 'converted_to_job',
    converted_job_id = v_job_id,
    converted_client_id = v_client_id,
    converted_schedule_id = v_schedule_id,
    converted_at = now(),
    updated_at = now()
  WHERE id = p_intent_id;

  -- 6. Deactivate slot reservation
  UPDATE public.slot_reservations
  SET is_active = false
  WHERE booking_intent_id = p_intent_id;

  RETURN json_build_object(
    'success', true,
    'job_id', v_job_id,
    'client_id', v_client_id,
    'schedule_id', v_schedule_id,
    'display_id', v_display_id
  );
END;
$$;

-- ── 11. RPC: Get widget config for public embed ────────────
CREATE OR REPLACE FUNCTION public.get_widget_config(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_widget RECORD;
  v_tree RECORD;
BEGIN
  SELECT * INTO v_widget
  FROM public.public_booking_widgets
  WHERE embed_script_token = p_token
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Widget not found or inactive');
  END IF;

  SELECT * INTO v_tree
  FROM public.triage_trees
  WHERE widget_id = v_widget.id
    AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  RETURN json_build_object(
    'widget_id', v_widget.id,
    'workspace_id', v_widget.workspace_id,
    'branding', v_widget.branding_config,
    'call_out_fee', v_widget.call_out_fee_amount,
    'scheduling_horizon_days', v_widget.scheduling_horizon_days,
    'minimum_buffer_minutes', v_widget.minimum_buffer_minutes,
    'slot_window_hours', v_widget.slot_window_hours,
    'triage_tree', CASE WHEN v_tree.id IS NOT NULL THEN v_tree.tree_graph ELSE NULL END
  );
END;
$$;

-- ── 12. RPC: Get booking stats for dashboard ────────────────
CREATE OR REPLACE FUNCTION public.get_booking_widget_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_intents', COUNT(*),
      'initiated', COUNT(*) FILTER (WHERE status = 'initiated'),
      'triage_complete', COUNT(*) FILTER (WHERE status = 'triage_complete'),
      'scheduling_selected', COUNT(*) FILTER (WHERE status = 'scheduling_selected'),
      'payment_pending', COUNT(*) FILTER (WHERE status = 'payment_pending'),
      'converted', COUNT(*) FILTER (WHERE status = 'converted_to_job'),
      'abandoned', COUNT(*) FILTER (WHERE status IN ('abandoned', 'abandoned_capacity', 'expired')),
      'conversion_rate', CASE
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'converted_to_job'))::numeric / COUNT(*)::numeric * 100, 1)
        ELSE 0
      END,
      'total_revenue_cents', COALESCE(SUM(deposit_amount_cents) FILTER (WHERE status = 'converted_to_job'), 0)
    )
    FROM public.booking_intents
    WHERE workspace_id = p_org_id
  );
END;
$$;

-- ── 13. Realtime publication ────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_intents;
