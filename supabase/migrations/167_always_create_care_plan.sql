-- ============================================================================
-- @migration AlwaysCreateCarePlan
-- @status COMPLETE
-- @description Always create care plan during intake + backfill existing participants
-- @tables (none — function: create_participant_ecosystem updated + backfill query)
-- @lastAudit 2026-03-22
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_participant_ecosystem(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id            UUID;
  v_client_id         UUID;
  v_participant_id    UUID;
  v_sa_id             UUID;
  v_template_id       UUID;
  v_care_plan_id      UUID;
  v_line_item         JSONB;
  v_schedule_entry    JSONB;
  v_med               JSONB;
  v_goal              JSONB;
  v_total_budget      NUMERIC(12,2) := 0;
  v_day_text          TEXT;
  v_day_num           INTEGER;
  v_raw_purpose       TEXT;
  v_mapped_category   TEXT;
BEGIN
  v_org_id := (p_payload->>'workspace_id')::UUID;

  -- ── 1. Insert Client ─────────────────────────────────────────────────────
  INSERT INTO public.clients (
    organization_id, name, email, phone, type
  ) VALUES (
    v_org_id,
    COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
    NULLIF(p_payload->>'email', ''),
    NULLIF(p_payload->>'phone', ''),
    'residential'
  ) RETURNING id INTO v_client_id;

  -- ── 2. Insert Participant Profile ────────────────────────────────────────
  INSERT INTO public.participant_profiles (
    client_id, organization_id, ndis_number, date_of_birth, primary_diagnosis,
    gender, preferred_name, address, management_type, mobility_status,
    communication_type, critical_alerts, intake_status, status,
    petty_cash_enabled, petty_cash_limit, petty_cash_notes,
    transport_budget_weekly, discretionary_fund_notes
  ) VALUES (
    v_client_id, v_org_id,
    NULLIF(REPLACE(p_payload->>'ndis_number', ' ', ''), ''),
    NULLIF(p_payload->>'date_of_birth', '')::DATE,
    NULLIF(p_payload->>'primary_diagnosis', ''),
    NULLIF(p_payload->>'gender', ''),
    NULLIF(p_payload->>'preferred_name', ''),
    NULLIF(p_payload->>'address', ''),
    NULLIF(p_payload->>'funding_type', ''),
    NULLIF(p_payload->>'mobility_status', ''),
    NULLIF(p_payload->>'communication_type', ''),
    COALESCE(
      (SELECT ARRAY_AGG(elem::TEXT) FROM jsonb_array_elements_text(p_payload->'critical_alerts') AS elem),
      '{}'::TEXT[]
    ),
    'complete', 'active',
    COALESCE((p_payload->>'petty_cash_enabled')::BOOLEAN, false),
    COALESCE((p_payload->>'petty_cash_limit')::NUMERIC, 0),
    NULLIF(p_payload->>'petty_cash_notes', ''),
    COALESCE((p_payload->>'transport_budget_weekly')::NUMERIC, 0),
    NULLIF(p_payload->>'discretionary_fund_notes', '')
  ) RETURNING id INTO v_participant_id;

  -- ── 3. Insert Service Agreement (if line items provided) ─────────────────
  IF p_payload->'sa_line_items' IS NOT NULL AND jsonb_array_length(p_payload->'sa_line_items') > 0 THEN
    SELECT COALESCE(SUM((li->>'allocated_budget')::NUMERIC), 0)
    INTO v_total_budget
    FROM jsonb_array_elements(p_payload->'sa_line_items') AS li;

    INSERT INTO public.service_agreements (
      organization_id, participant_id, title, start_date, end_date,
      total_budget, status, funding_management_type, ndis_line_items
    ) VALUES (
      v_org_id, v_participant_id,
      'Service Agreement — ' || COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
      COALESCE(NULLIF(p_payload->>'sa_start_date', ''), CURRENT_DATE::TEXT)::DATE,
      COALESCE(NULLIF(p_payload->>'sa_end_date', ''), (CURRENT_DATE + INTERVAL '12 months')::DATE::TEXT)::DATE,
      v_total_budget, 'active',
      NULLIF(p_payload->>'funding_type', ''),
      p_payload->'sa_line_items'
    ) RETURNING id INTO v_sa_id;

    FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_payload->'sa_line_items')
    LOOP
      v_raw_purpose := LOWER(TRIM(COALESCE(v_line_item->>'support_purpose', 'core')));
      v_mapped_category := CASE
        WHEN v_raw_purpose IN ('core', 'core supports') THEN 'core'
        WHEN v_raw_purpose IN ('capacity_building', 'capacity building', 'cb') THEN 'capacity_building'
        WHEN v_raw_purpose IN ('capital', 'capital supports') THEN 'capital'
        ELSE 'core'
      END;

      INSERT INTO public.budget_allocations (
        organization_id, service_agreement_id, participant_id, category, total_budget
      ) VALUES (
        v_org_id, v_sa_id, v_participant_id, v_mapped_category,
        COALESCE((v_line_item->>'allocated_budget')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  -- ── 4. Insert Roster Template + Template Shifts ──────────────────────────
  IF p_payload->'roster_entries' IS NOT NULL AND jsonb_array_length(p_payload->'roster_entries') > 0 THEN
    INSERT INTO public.roster_templates (
      organization_id, participant_id, name, cycle_length_days, is_active
    ) VALUES (
      v_org_id, v_participant_id,
      'Master Schedule — ' || COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
      7, true
    ) RETURNING id INTO v_template_id;

    FOR v_schedule_entry IN SELECT * FROM jsonb_array_elements(p_payload->'roster_entries')
    LOOP
      FOR v_day_text IN SELECT * FROM jsonb_array_elements_text(v_schedule_entry->'days')
      LOOP
        v_day_num := CASE UPPER(v_day_text)
          WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
          WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5 WHEN 'SAT' THEN 6
          WHEN 'SUN' THEN 7 ELSE NULL
        END;
        IF v_day_num IS NOT NULL THEN
          INSERT INTO public.template_shifts (
            template_id, organization_id, day_of_cycle, start_time, end_time, ndis_line_item, title
          ) VALUES (
            v_template_id, v_org_id, v_day_num,
            (v_schedule_entry->>'start_time')::TIME,
            (v_schedule_entry->>'end_time')::TIME,
            NULLIF(v_schedule_entry->>'linked_item_number', ''),
            COALESCE(v_schedule_entry->>'title', 'Support — ' || COALESCE(p_payload->>'first_name', ''))
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- ── 5. Insert Medications ────────────────────────────────────────────────
  IF p_payload->'medications' IS NOT NULL AND jsonb_array_length(p_payload->'medications') > 0 THEN
    FOR v_med IN SELECT * FROM jsonb_array_elements(p_payload->'medications')
    LOOP
      INSERT INTO public.participant_medications (
        organization_id, participant_id, medication_name, dosage, route, frequency,
        prescribing_doctor, is_prn, special_instructions
      ) VALUES (
        v_org_id, v_participant_id,
        v_med->>'medication_name', v_med->>'dosage',
        COALESCE(v_med->>'route', 'oral')::public.medication_route,
        COALESCE(v_med->>'frequency', 'once_daily')::public.medication_frequency,
        NULLIF(v_med->>'prescribing_doctor', ''),
        COALESCE((v_med->>'is_prn')::BOOLEAN, false),
        NULLIF(v_med->>'special_instructions', '')
      );
    END LOOP;
  END IF;

  -- ── 6. ALWAYS create a Care Plan ─────────────────────────────────────────
  INSERT INTO public.care_plans (
    organization_id, participant_id, title, status
  ) VALUES (
    v_org_id, v_participant_id,
    'Care Plan — ' || COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
    'active'
  ) RETURNING id INTO v_care_plan_id;

  -- Insert goals if provided
  IF p_payload->'goals' IS NOT NULL AND jsonb_array_length(p_payload->'goals') > 0 THEN
    FOR v_goal IN SELECT * FROM jsonb_array_elements(p_payload->'goals')
    LOOP
      INSERT INTO public.care_goals (
        care_plan_id, organization_id, participant_id, title, description,
        support_category, target_outcome, status
      ) VALUES (
        v_care_plan_id, v_org_id, v_participant_id,
        v_goal->>'title',
        NULLIF(v_goal->>'description', ''),
        COALESCE(v_goal->>'support_category', 'core'),
        NULLIF(v_goal->>'target_outcome', ''),
        'not_started'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant_id,
    'client_id', v_client_id,
    'service_agreement_id', v_sa_id,
    'roster_template_id', v_template_id,
    'care_plan_id', v_care_plan_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ── Backfill: Create care plans for existing participants that don't have one ──
INSERT INTO public.care_plans (organization_id, participant_id, title, status)
SELECT
  pp.organization_id,
  pp.id,
  'Care Plan — ' || c.name,
  'active'::care_plan_status
FROM public.participant_profiles pp
JOIN public.clients c ON pp.client_id = c.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.care_plans cp
  WHERE cp.participant_id = pp.id
    AND cp.organization_id = pp.organization_id
);
