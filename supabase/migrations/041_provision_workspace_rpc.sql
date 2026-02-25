-- ============================================================================
-- Migration 041: Workspace Provisioning RPC
-- ============================================================================
-- Atomic workspace creation: org + owner membership + Stripe stub + seed data.
-- Used by both Next.js /signup and Flutter onboarding.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. create_organization_with_owner()
-- --------------------------------------------------------------------------
-- Atomically provisions a new workspace with the calling user as OWNER.
-- Returns the new organization row as JSONB.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name  text,
  org_slug  text,
  org_trade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id  uuid;
  _org     jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (name, slug, trade, settings)
  VALUES (
    org_name,
    org_slug,
    org_trade,
    jsonb_build_object(
      'industry', COALESCE(org_trade, 'General'),
      'provisioned_at', now()::text
    )
  )
  RETURNING id INTO _org_id;

  -- Create owner membership
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (_org_id, _user_id, 'owner', 'active');

  -- Mark profile onboarding complete
  UPDATE public.profiles
  SET onboarding_completed = true
  WHERE id = _user_id;

  -- Seed industry defaults
  PERFORM public.seed_industry_defaults(_org_id, COALESCE(org_trade, 'General'));

  -- Return the new org
  SELECT to_jsonb(o) INTO _org
  FROM public.organizations o
  WHERE o.id = _org_id;

  RETURN _org;
END;
$$;

-- --------------------------------------------------------------------------
-- 2. seed_industry_defaults()
-- --------------------------------------------------------------------------
-- Injects starter SWMS templates and common job type tags based on trade.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_industry_defaults(
  p_org_id uuid,
  p_trade  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _swms_schema jsonb;
BEGIN
  -- Universal Site Safety SWMS (all trades)
  _swms_schema := jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Site Assessment',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'hazards', 'label', 'Identify site hazards', 'type', 'text', 'required', true),
          jsonb_build_object('id', 'ppe', 'label', 'PPE worn', 'type', 'checkbox_group', 'required', true,
            'options', jsonb_build_array('Hard Hat', 'Safety Glasses', 'Steel Caps', 'Hi-Vis', 'Gloves', 'Ear Protection')),
          jsonb_build_object('id', 'safe_to_proceed', 'label', 'Is it safe to proceed?', 'type', 'boolean', 'required', true)
        )
      )
    )
  );

  INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
  VALUES (p_org_id, 'Site Safety Assessment', 'Universal pre-job safety checklist', 'pre_job', _swms_schema, true, true);

  -- Trade-specific SWMS
  IF p_trade = 'HVAC' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Refrigerant Handling SWMS', 'Safe handling of refrigerant gases', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Refrigerant Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'gas_type', 'label', 'Refrigerant type', 'type', 'select', 'required', true,
            'options', jsonb_build_array('R410A', 'R32', 'R134a', 'R22', 'Other')),
          jsonb_build_object('id', 'leak_test', 'label', 'Leak detector available?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'recovery_unit', 'label', 'Recovery unit on truck?', 'type', 'boolean', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Working at Heights SWMS', 'Roof unit access protocol', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Height Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'access_method', 'label', 'Access method', 'type', 'select', 'required', true,
            'options', jsonb_build_array('Ladder', 'Scaffolding', 'EWP', 'Fixed Access')),
          jsonb_build_object('id', 'harness_check', 'label', 'Harness inspected?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'fall_zone', 'label', 'Fall zone clear?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Electrical' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Electrical Isolation SWMS', 'Lock-out/tag-out procedure', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Isolation Protocol', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'isolation_point', 'label', 'Isolation point identified?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'lockout_applied', 'label', 'Lock-out/tag-out applied?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'voltage_test', 'label', 'Dead test performed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'voltage_reading', 'label', 'Voltage reading (V)', 'type', 'number', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Asbestos Awareness SWMS', 'Pre-1990 building check', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Asbestos Check', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'building_age', 'label', 'Building constructed before 1990?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'register_checked', 'label', 'Asbestos register reviewed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'safe_to_proceed', 'label', 'Safe to proceed without specialist?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Plumbing' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Confined Space Entry SWMS', 'Sewer and tank access protocol', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Confined Space', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'gas_monitor', 'label', 'Gas monitor reading clear?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'ventilation', 'label', 'Ventilation adequate?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'spotter', 'label', 'Spotter present?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'rescue_plan', 'label', 'Rescue plan briefed?', 'type', 'boolean', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Hot Water System SWMS', 'Tempering valve and scalding prevention', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Hot Water Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'isolation_valve', 'label', 'Water supply isolated?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'temp_reading', 'label', 'Outlet temperature (°C)', 'type', 'number', 'required', true),
          jsonb_build_object('id', 'tmv_compliant', 'label', 'TMV/tempering valve compliant?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Fire' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Fire Panel Inspection SWMS', 'Fire indicator panel service procedure', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Panel Inspection', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'panel_isolated', 'label', 'Fire panel in test mode?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'monitoring_notified', 'label', 'Monitoring company notified?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'brigade_notified', 'label', 'Fire brigade notified (if required)?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Security' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'CCTV Installation SWMS', 'Camera installation safety', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Installation Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'cable_route', 'label', 'Cable route surveyed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'power_source', 'label', 'PoE or separate power confirmed?', 'type', 'select', 'required', true,
            'options', jsonb_build_array('PoE', 'Separate 12V', 'Separate 24V')),
          jsonb_build_object('id', 'network_access', 'label', 'Network access confirmed?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);
  END IF;

  -- Post-job quality checklist (universal)
  INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
  VALUES (p_org_id, 'Job Completion Quality Check', 'Post-job quality and cleanup verification', 'post_job',
    jsonb_build_object('sections', jsonb_build_array(
      jsonb_build_object('title', 'Completion Check', 'fields', jsonb_build_array(
        jsonb_build_object('id', 'work_tested', 'label', 'Work tested and operational?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'site_clean', 'label', 'Site left clean?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'client_briefed', 'label', 'Client briefed on work completed?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'notes', 'label', 'Additional notes', 'type', 'text', 'required', false)
      ))
    )), false, true);
END;
$$;
