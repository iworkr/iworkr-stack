-- ============================================================================
-- Migration 040: Project Grandmaster — Schedule Dispatch Enhancements
-- SAFE: All statements wrapped with table existence checks.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Schedule drop validation RPC
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_blocks')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs') THEN

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.validate_schedule_drop(
        p_org_id        uuid,
        p_technician_id uuid,
        p_start_time    timestamptz,
        p_end_time      timestamptz,
        p_exclude_block uuid DEFAULT NULL,
        p_location_lat  double precision DEFAULT NULL,
        p_location_lng  double precision DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      STABLE
      AS $body$
      DECLARE
        _date          date := p_start_time::date;
        _conflicts     jsonb := '[]'::jsonb;
        _prev_block    record;
        _travel        jsonb := 'null'::jsonb;
        _gap_minutes   integer;
        _dist_km       double precision;
        _est_minutes   integer;
        _warnings      jsonb := '[]'::jsonb;
      BEGIN
        SELECT jsonb_agg(jsonb_build_object(
          'block_id', sb.id,
          'title', sb.title,
          'start_time', sb.start_time,
          'end_time', sb.end_time
        ))
        INTO _conflicts
        FROM public.schedule_blocks sb
        WHERE sb.organization_id = p_org_id
          AND sb.technician_id = p_technician_id
          AND sb.start_time::date = _date
          AND sb.status != 'cancelled'
          AND (p_exclude_block IS NULL OR sb.id != p_exclude_block)
          AND sb.start_time < p_end_time
          AND sb.end_time > p_start_time;

        IF _conflicts IS NULL THEN _conflicts := '[]'::jsonb; END IF;

        SELECT sb.id, sb.title, sb.end_time, sb.location,
               j.location_lat AS prev_lat, j.location_lng AS prev_lng
        INTO _prev_block
        FROM public.schedule_blocks sb
        LEFT JOIN public.jobs j ON j.id = sb.job_id
        WHERE sb.organization_id = p_org_id
          AND sb.technician_id = p_technician_id
          AND sb.start_time::date = _date
          AND sb.status != 'cancelled'
          AND (p_exclude_block IS NULL OR sb.id != p_exclude_block)
          AND sb.end_time <= p_start_time
        ORDER BY sb.end_time DESC
        LIMIT 1;

        IF _prev_block IS NOT NULL THEN
          _gap_minutes := EXTRACT(EPOCH FROM (p_start_time - _prev_block.end_time)) / 60;
          _est_minutes := NULL;

          IF p_location_lat IS NOT NULL AND p_location_lng IS NOT NULL
             AND _prev_block.prev_lat IS NOT NULL AND _prev_block.prev_lng IS NOT NULL THEN
            _dist_km := 6371 * 2 * ASIN(SQRT(
              POWER(SIN(RADIANS(p_location_lat - _prev_block.prev_lat) / 2), 2) +
              COS(RADIANS(_prev_block.prev_lat)) * COS(RADIANS(p_location_lat)) *
              POWER(SIN(RADIANS(p_location_lng - _prev_block.prev_lng) / 2), 2)
            ));
            _est_minutes := CEIL((_dist_km / 40.0) * 60);
          END IF;

          IF _est_minutes IS NULL THEN
            _est_minutes := 15;
          END IF;

          _travel := jsonb_build_object(
            'previous_block', jsonb_build_object(
              'id', _prev_block.id,
              'title', _prev_block.title,
              'end_time', _prev_block.end_time
            ),
            'estimated_minutes', _est_minutes,
            'gap_minutes', _gap_minutes,
            'sufficient', (_gap_minutes >= _est_minutes)
          );

          IF _gap_minutes < _est_minutes THEN
            _warnings := _warnings || jsonb_build_array(
              format('Travel Warning: ~%smin drive from "%s" but only %smin gap',
                     _est_minutes, _prev_block.title, _gap_minutes)
            );
          END IF;
        END IF;

        IF jsonb_array_length(_conflicts) > 0 THEN
          _warnings := _warnings || jsonb_build_array(
            format('Overlaps with %s existing block(s)', jsonb_array_length(_conflicts))
          );
        END IF;

        RETURN jsonb_build_object(
          'valid', (jsonb_array_length(_conflicts) = 0),
          'conflicts', _conflicts,
          'travel', _travel,
          'warnings', _warnings
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 2. Auto-notification on job assignment
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.notify_on_job_assignment()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER AS $body$
      BEGIN
        IF NEW.assignee_id IS NOT NULL
           AND (OLD.assignee_id IS NULL OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
          INSERT INTO public.notifications (
            organization_id, user_id, type, title, body,
            related_job_id, action_link, action_type
          ) VALUES (
            NEW.organization_id,
            NEW.assignee_id,
            'job_assigned',
            'New Job Assigned',
            format('%s: %s has been added to your schedule.',
                   COALESCE(NEW.display_id, 'Job'), COALESCE(NEW.title, 'Untitled')),
            NEW.id,
            '/dashboard/jobs/' || NEW.id,
            'view'
          );
        END IF;

        RETURN NEW;
      END;
      $body$;
    $fn$;

    -- Use assignee_id column for trigger
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jobs' AND column_name='assignee_id'
    ) THEN
      DROP TRIGGER IF EXISTS trg_notify_job_assignment ON public.jobs;
      CREATE TRIGGER trg_notify_job_assignment
        AFTER UPDATE OF assignee_id ON public.jobs
        FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_assignment();
    END IF;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3. Cascading delay detection
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_blocks') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_cascading_delays(
        p_org_id        uuid,
        p_technician_id uuid,
        p_date          date DEFAULT CURRENT_DATE
      )
      RETURNS TABLE (
        block_id          uuid,
        title             text,
        scheduled_start   timestamptz,
        scheduled_end     timestamptz,
        delay_minutes     integer,
        caused_by_block   uuid
      )
      LANGUAGE sql
      STABLE
      AS $body$
        WITH active_overruns AS (
          SELECT sb.id, sb.title, sb.end_time,
                 EXTRACT(EPOCH FROM (now() - sb.end_time)) / 60 AS overrun_minutes
          FROM public.schedule_blocks sb
          WHERE sb.organization_id = p_org_id
            AND sb.technician_id = p_technician_id
            AND sb.start_time::date = p_date
            AND sb.status IN ('in_progress', 'en_route', 'on_site')
            AND sb.end_time < now()
        )
        SELECT
          downstream.id AS block_id,
          downstream.title,
          downstream.start_time AS scheduled_start,
          downstream.end_time AS scheduled_end,
          CEIL(ao.overrun_minutes)::integer AS delay_minutes,
          ao.id AS caused_by_block
        FROM active_overruns ao
        JOIN public.schedule_blocks downstream
          ON downstream.organization_id = p_org_id
         AND downstream.technician_id = p_technician_id
         AND downstream.start_time::date = p_date
         AND downstream.start_time >= ao.end_time
         AND downstream.status = 'scheduled'
        ORDER BY downstream.start_time;
      $body$;
    $fn$;
  END IF;
END $$;
