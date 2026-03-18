-- ============================================================================
-- Migration 130: Genesis-Client — Atomic Participant Ecosystem RPC
-- Creates a monolithic RPC that atomically inserts:
--   1. clients record
--   2. participant_profiles record
--   3. service_agreements record
--   4. budget_allocations records (per SA line item)
--   5. roster_templates + template_shifts records (recurring schedule)
-- If any step fails, the entire transaction rolls back.
-- SAFE: Uses CREATE OR REPLACE FUNCTION.
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
  v_line_item         JSONB;
  v_schedule_entry    JSONB;
  v_total_budget      NUMERIC(12,2) := 0;
  v_day_text          TEXT;
  v_day_num           INTEGER;
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
    client_id,
    organization_id,
    ndis_number,
    date_of_birth,
    primary_diagnosis,
    gender,
    preferred_name,
    address,
    management_type,
    mobility_status,
    communication_type,
    critical_alerts,
    intake_status,
    status
  ) VALUES (
    v_client_id,
    v_org_id,
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
    'complete',
    'active'
  ) RETURNING id INTO v_participant_id;

  -- ── 3. Insert Service Agreement (if line items provided) ─────────────────
  IF p_payload->'sa_line_items' IS NOT NULL AND jsonb_array_length(p_payload->'sa_line_items') > 0 THEN
    -- Calculate total budget from line items
    SELECT COALESCE(SUM((li->>'allocated_budget')::NUMERIC), 0)
    INTO v_total_budget
    FROM jsonb_array_elements(p_payload->'sa_line_items') AS li;

    INSERT INTO public.service_agreements (
      organization_id,
      participant_id,
      title,
      start_date,
      end_date,
      total_budget,
      status,
      funding_management_type,
      ndis_line_items
    ) VALUES (
      v_org_id,
      v_participant_id,
      'Service Agreement — ' || COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
      COALESCE(NULLIF(p_payload->>'sa_start_date', ''), CURRENT_DATE::TEXT)::DATE,
      COALESCE(NULLIF(p_payload->>'sa_end_date', ''), (CURRENT_DATE + INTERVAL '12 months')::DATE::TEXT)::DATE,
      v_total_budget,
      'active',
      NULLIF(p_payload->>'funding_type', ''),
      p_payload->'sa_line_items'
    ) RETURNING id INTO v_sa_id;

    -- ── 4. Insert Budget Allocations per line item ───────────────────────────
    FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_payload->'sa_line_items')
    LOOP
      INSERT INTO public.budget_allocations (
        organization_id,
        service_agreement_id,
        participant_id,
        category,
        total_budget
      ) VALUES (
        v_org_id,
        v_sa_id,
        v_participant_id,
        COALESCE(v_line_item->>'support_purpose', 'core'),
        COALESCE((v_line_item->>'allocated_budget')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  -- ── 5. Insert Roster Template + Template Shifts (if schedule provided) ────
  IF p_payload->'roster_entries' IS NOT NULL AND jsonb_array_length(p_payload->'roster_entries') > 0 THEN
    INSERT INTO public.roster_templates (
      organization_id,
      participant_id,
      name,
      cycle_length_days,
      is_active
    ) VALUES (
      v_org_id,
      v_participant_id,
      'Master Schedule — ' || COALESCE(p_payload->>'first_name', '') || ' ' || COALESCE(p_payload->>'last_name', ''),
      7,
      true
    ) RETURNING id INTO v_template_id;

    -- Insert each schedule entry as template_shifts
    FOR v_schedule_entry IN SELECT * FROM jsonb_array_elements(p_payload->'roster_entries')
    LOOP
      -- Map day abbreviation to day_of_cycle (1=Mon..7=Sun)
      FOR v_day_text IN SELECT * FROM jsonb_array_elements_text(v_schedule_entry->'days')
      LOOP
        v_day_num := CASE UPPER(v_day_text)
          WHEN 'MON' THEN 1
          WHEN 'TUE' THEN 2
          WHEN 'WED' THEN 3
          WHEN 'THU' THEN 4
          WHEN 'FRI' THEN 5
          WHEN 'SAT' THEN 6
          WHEN 'SUN' THEN 7
          ELSE NULL
        END;

        IF v_day_num IS NOT NULL THEN
          INSERT INTO public.template_shifts (
            template_id,
            organization_id,
            day_of_cycle,
            start_time,
            end_time,
            ndis_line_item,
            title
          ) VALUES (
            v_template_id,
            v_org_id,
            v_day_num,
            (v_schedule_entry->>'start_time')::TIME,
            (v_schedule_entry->>'end_time')::TIME,
            NULLIF(v_schedule_entry->>'linked_item_number', ''),
            COALESCE(
              v_schedule_entry->>'title',
              'Support — ' || COALESCE(p_payload->>'first_name', '')
            )
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant_id,
    'client_id', v_client_id,
    'service_agreement_id', v_sa_id,
    'roster_template_id', v_template_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_participant_ecosystem(JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_participant_ecosystem IS
  'Atomically creates a full participant ecosystem: client, profile, service agreement, budget allocations, and recurring roster template in a single transaction.';
