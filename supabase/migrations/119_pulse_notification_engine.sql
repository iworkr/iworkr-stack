-- ============================================================================
-- Migration 119: Pulse — Notification Engine
-- Adds nudge-based clock-in/clock-out notifications, multi-device FCM
-- token registry, granular notification preferences, push throttling/dedup,
-- chat mention parsing, and org-wide announcement broadcasting.
-- SAFE: All statements idempotent (IF NOT EXISTS, DO blocks, CREATE OR REPLACE).
-- ============================================================================


-- ============================================================================
-- 1. Extend notification_type enum with new values
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'nudge_clock_in'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'nudge_clock_in';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'nudge_clock_out'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'nudge_clock_out';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'announcement'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'announcement';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'shift_assigned'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'shift_assigned';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'shift_rescheduled'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'shift_rescheduled';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'chat_reply'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'chat_reply';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'chat_mention'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type'))
  THEN
    ALTER TYPE public.notification_type ADD VALUE 'chat_mention';
  END IF;
END $$;


-- ============================================================================
-- 2. Add action_url column (deep-link target for mobile / web)
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url VARCHAR(500);

COMMENT ON COLUMN public.notifications.action_url IS
  'Deep-link URL for notification tap action (e.g. /care/shift/uuid or iworkr://schedule/active)';


-- ============================================================================
-- 3. Add read_at column (precise read timestamp)
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN public.notifications.read_at IS
  'Timestamp when the user actually read the notification (supplements the boolean read flag)';


-- ============================================================================
-- 4. Add priority column
-- ============================================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

-- Add CHECK constraint idempotently
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (priority IN ('low', 'normal', 'high', 'emergency_override'));
  END IF;
END $$;

COMMENT ON COLUMN public.notifications.priority IS
  'Notification priority: low, normal, high, emergency_override. High and emergency_override bypass DND.';


-- ============================================================================
-- 5. user_devices — multi-device FCM token registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type   VARCHAR(20) NOT NULL,
  fcm_token     TEXT NOT NULL,
  app_version   VARCHAR(50),
  device_name   VARCHAR(100),
  is_active     BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_devices_device_type_check
    CHECK (device_type IN ('ios', 'android', 'web')),
  CONSTRAINT user_devices_fcm_token_unique UNIQUE (fcm_token)
);

COMMENT ON TABLE public.user_devices IS
  'Multi-device push notification token registry. One user can have many devices (phone, tablet, web).';

-- Index for fast lookup of active devices per user
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
  ON public.user_devices (user_id, is_active)
  WHERE is_active = true;

-- RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can read their own devices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Users can read own devices'
  ) THEN
    CREATE POLICY "Users can read own devices"
      ON public.user_devices FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Users can register new devices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Users can register own devices'
  ) THEN
    CREATE POLICY "Users can register own devices"
      ON public.user_devices FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Users can update their own devices (e.g. mark inactive, update token)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Users can update own devices'
  ) THEN
    CREATE POLICY "Users can update own devices"
      ON public.user_devices FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Users can delete their own devices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Users can delete own devices'
  ) THEN
    CREATE POLICY "Users can delete own devices"
      ON public.user_devices FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;


-- ============================================================================
-- 6. user_notification_preferences — per-user notification settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled              BOOLEAN DEFAULT true,
  email_digest_enabled      BOOLEAN DEFAULT false,
  mute_chat_mentions        BOOLEAN DEFAULT false,
  mute_shift_reminders      BOOLEAN DEFAULT false,
  mute_announcements        BOOLEAN DEFAULT false,
  dnd_enabled               BOOLEAN DEFAULT false,
  dnd_start                 TIME,
  dnd_end                   TIME,
  quiet_hours_respect_shifts BOOLEAN DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_notification_preferences_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE public.user_notification_preferences IS
  'Per-user notification preferences: push toggles, DND hours, muting categories.';
COMMENT ON COLUMN public.user_notification_preferences.quiet_hours_respect_shifts IS
  'When true, auto-enables DND when user is off-duty (no active shift).';

-- Index on user_id (unique constraint already covers this, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user
  ON public.user_notification_preferences (user_id);

-- Auto-update updated_at trigger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS set_user_notification_preferences_updated_at
      ON public.user_notification_preferences;
    CREATE TRIGGER set_user_notification_preferences_updated_at
      BEFORE UPDATE ON public.user_notification_preferences
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences'
      AND policyname = 'Users can read own notification preferences'
  ) THEN
    CREATE POLICY "Users can read own notification preferences"
      ON public.user_notification_preferences FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences'
      AND policyname = 'Users can create own notification preferences'
  ) THEN
    CREATE POLICY "Users can create own notification preferences"
      ON public.user_notification_preferences FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences'
      AND policyname = 'Users can update own notification preferences'
  ) THEN
    CREATE POLICY "Users can update own notification preferences"
      ON public.user_notification_preferences FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;


-- ============================================================================
-- 7. notification_push_log — throttling / dedup ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_push_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  last_push_at      TIMESTAMPTZ DEFAULT NOW(),
  push_count        INTEGER DEFAULT 1,

  CONSTRAINT notification_push_log_user_type_unique
    UNIQUE (user_id, notification_type)
);

COMMENT ON TABLE public.notification_push_log IS
  'Push notification throttling/dedup ledger. Tracks last push time and count per user per type.';

-- RLS: service role only — no direct user access
ALTER TABLE public.notification_push_log ENABLE ROW LEVEL SECURITY;

-- No user-facing policies; only service_role or SECURITY DEFINER functions can access


-- ============================================================================
-- 8. nudge_check_clock_in — scheduled function (pg_cron)
--    Runs every 5 minutes. Finds overdue schedule_blocks and nudges the tech.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.nudge_check_clock_in()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _block RECORD;
  _minutes_late INTEGER;
BEGIN
  -- Find schedule_blocks that are still 'scheduled' but should have started
  -- between 15 minutes and 2 hours ago (to avoid spamming ancient blocks)
  FOR _block IN
    SELECT
      sb.id,
      sb.organization_id,
      sb.technician_id,
      sb.title,
      sb.start_time,
      EXTRACT(EPOCH FROM (NOW() - sb.start_time))::integer / 60 AS minutes_late
    FROM public.schedule_blocks sb
    WHERE sb.status = 'scheduled'
      AND sb.start_time < (NOW() - INTERVAL '15 minutes')
      AND sb.start_time > (NOW() - INTERVAL '2 hours')
  LOOP
    -- Dedup: skip if we already sent a nudge for this exact schedule_block
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'nudge_clock_in'
        AND related_entity_id = _block.id
        AND related_entity_type = 'schedule_block'
    ) THEN
      _minutes_late := _block.minutes_late;

      INSERT INTO public.notifications (
        organization_id,
        user_id,
        type,
        title,
        body,
        related_entity_type,
        related_entity_id,
        action_url,
        priority,
        metadata
      ) VALUES (
        _block.organization_id,
        _block.technician_id,
        'nudge_clock_in',
        'Shift Started?',
        'You are scheduled for "' || _block.title || '" that began '
          || _minutes_late || ' minutes ago. Tap to clock in.',
        'schedule_block',
        _block.id,
        '/care/shift/' || _block.id::text,
        'high',
        jsonb_build_object(
          'schedule_block_id', _block.id,
          'minutes_late', _minutes_late,
          'scheduled_start', _block.start_time
        )
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.nudge_check_clock_in() IS
  'Pulse Engine: Checks for overdue clock-ins (15m–2h window) and sends nudge notifications. Runs via pg_cron every 5 minutes.';


-- ============================================================================
-- 9. nudge_check_clock_out — scheduled function (pg_cron)
--    Runs every 15 minutes. Finds in-progress shifts past end_time.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.nudge_check_clock_out()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _block RECORD;
  _minutes_overdue INTEGER;
BEGIN
  -- Find schedule_blocks still 'in_progress' but ended 30 min to 4 hours ago
  FOR _block IN
    SELECT
      sb.id,
      sb.organization_id,
      sb.technician_id,
      sb.title,
      sb.end_time,
      EXTRACT(EPOCH FROM (NOW() - sb.end_time))::integer / 60 AS minutes_overdue
    FROM public.schedule_blocks sb
    WHERE sb.status = 'in_progress'
      AND sb.end_time < (NOW() - INTERVAL '30 minutes')
      AND sb.end_time > (NOW() - INTERVAL '4 hours')
  LOOP
    -- Dedup: skip if we already nudged for this schedule_block
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'nudge_clock_out'
        AND related_entity_id = _block.id
        AND related_entity_type = 'schedule_block'
    ) THEN
      _minutes_overdue := _block.minutes_overdue;

      INSERT INTO public.notifications (
        organization_id,
        user_id,
        type,
        title,
        body,
        related_entity_type,
        related_entity_id,
        action_url,
        priority,
        metadata
      ) VALUES (
        _block.organization_id,
        _block.technician_id,
        'nudge_clock_out',
        'Still on site?',
        'Your shift "' || _block.title || '" was scheduled to end '
          || _minutes_overdue || ' minutes ago. Please clock out or update your schedule.',
        'schedule_block',
        _block.id,
        '/care/shift/' || _block.id::text,
        'high',
        jsonb_build_object(
          'schedule_block_id', _block.id,
          'minutes_overdue', _minutes_overdue,
          'scheduled_end', _block.end_time
        )
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.nudge_check_clock_out() IS
  'Pulse Engine: Checks for overdue clock-outs (30m–4h window) and sends nudge notifications. Runs via pg_cron every 15 minutes.';


-- ============================================================================
-- 10. parse_chat_mentions — trigger on messages table
--     Detects <mention id="UUID"> patterns and creates chat_mention notifications.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.parse_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _match       TEXT[];
  _mentioned_id UUID;
  _sender_name TEXT;
  _truncated   TEXT;
  _org_id      UUID;
BEGIN
  -- Only process if content contains mention markup
  IF NEW.content IS NULL OR position('<mention' IN NEW.content) = 0 THEN
    RETURN NEW;
  END IF;

  -- Get the sender's display name for the notification
  SELECT full_name INTO _sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Truncate message content for notification body (max 200 chars)
  -- Strip mention tags for readability
  _truncated := regexp_replace(NEW.content, '<mention[^>]*>[^<]*</mention>', '@user', 'g');
  IF length(_truncated) > 200 THEN
    _truncated := left(_truncated, 197) || '...';
  END IF;

  -- Extract all mention UUIDs from the message content
  -- Pattern: <mention id="UUID"> or <mention id="UUID">DisplayName</mention>
  FOR _match IN
    SELECT regexp_matches(NEW.content, '<mention\s+id="([0-9a-f\-]{36})"', 'g')
  LOOP
    BEGIN
      _mentioned_id := _match[1]::UUID;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE; -- Skip malformed UUIDs
    END;

    -- Skip self-mentions
    IF _mentioned_id = NEW.user_id THEN
      CONTINUE;
    END IF;

    -- Resolve the organization_id for context (via channel membership or a lookup)
    -- We use the first org the mentioned user belongs to that the sender also belongs to
    SELECT om.organization_id INTO _org_id
    FROM public.organization_members om
    WHERE om.user_id = _mentioned_id
      AND om.status = 'active'
      AND om.organization_id IN (
        SELECT om2.organization_id FROM public.organization_members om2
        WHERE om2.user_id = NEW.user_id AND om2.status = 'active'
      )
    LIMIT 1;

    -- Only create notification if we found a shared org
    IF _org_id IS NOT NULL THEN
      -- Dedup: don't re-notify for the same message + user combo
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE type = 'chat_mention'
          AND user_id = _mentioned_id
          AND related_entity_id = NEW.id
          AND related_entity_type = 'message'
      ) THEN
        INSERT INTO public.notifications (
          organization_id,
          user_id,
          type,
          title,
          body,
          sender_id,
          sender_name,
          related_entity_type,
          related_entity_id,
          action_url,
          priority,
          metadata
        ) VALUES (
          _org_id,
          _mentioned_id,
          'chat_mention',
          COALESCE(_sender_name, 'Someone') || ' mentioned you',
          _truncated,
          NEW.user_id,
          _sender_name,
          'message',
          NEW.id,
          '/messages/' || NEW.channel_id::text,
          'normal',
          jsonb_build_object(
            'channel_id', NEW.channel_id,
            'message_id', NEW.id,
            'sender_id', NEW.user_id
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.parse_chat_mentions() IS
  'Pulse Engine: Parses <mention id="UUID"> patterns from chat messages and creates chat_mention notifications.';

-- Attach trigger to messages table (idempotent)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    DROP TRIGGER IF EXISTS trg_parse_chat_mentions ON public.messages;
    CREATE TRIGGER trg_parse_chat_mentions
      AFTER INSERT ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.parse_chat_mentions();
  ELSE
    RAISE NOTICE '[119] Skipping chat mention trigger — messages table not found.';
  END IF;
END $$;


-- ============================================================================
-- 11. broadcast_announcement — RPC for org-wide announcements
--     SECURITY DEFINER: only admin/owner can invoke.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_organization_id UUID,
  p_title           TEXT,
  p_body            TEXT,
  p_priority        TEXT DEFAULT 'high'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _caller_role TEXT;
  _inserted    INTEGER := 0;
  _member      RECORD;
BEGIN
  -- Verify caller is admin or owner of this organization
  SELECT role INTO _caller_role
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND status = 'active';

  IF _caller_role IS NULL OR _caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Permission denied: only admin or owner can broadcast announcements.';
  END IF;

  -- Validate priority
  IF p_priority NOT IN ('low', 'normal', 'high', 'emergency_override') THEN
    RAISE EXCEPTION 'Invalid priority: %. Must be one of: low, normal, high, emergency_override', p_priority;
  END IF;

  -- Insert a notification for every active member of the organization
  FOR _member IN
    SELECT om.user_id
    FROM public.organization_members om
    WHERE om.organization_id = p_organization_id
      AND om.status = 'active'
  LOOP
    INSERT INTO public.notifications (
      organization_id,
      user_id,
      type,
      title,
      body,
      sender_id,
      sender_name,
      priority,
      action_url,
      metadata
    ) VALUES (
      p_organization_id,
      _member.user_id,
      'announcement',
      p_title,
      p_body,
      auth.uid(),
      (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
      p_priority,
      '/inbox',
      jsonb_build_object(
        'broadcast', true,
        'organization_id', p_organization_id
      )
    );

    _inserted := _inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'recipients', _inserted,
    'organization_id', p_organization_id
  );
END;
$$;

COMMENT ON FUNCTION public.broadcast_announcement(UUID, TEXT, TEXT, TEXT) IS
  'Pulse Engine: Broadcasts an announcement notification to all active members of an organization. Admin/owner only.';


-- ============================================================================
-- 12. Schedule pg_cron jobs for nudge functions
-- ============================================================================

DO $$ BEGIN
  -- Only schedule cron jobs if the pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Unschedule existing jobs if they exist (idempotent re-create)
    BEGIN
      PERFORM cron.unschedule('nudge-clock-in');
    EXCEPTION WHEN OTHERS THEN
      -- Job doesn't exist yet, that's fine
      NULL;
    END;

    BEGIN
      PERFORM cron.unschedule('nudge-clock-out');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Schedule nudge_check_clock_in to run every 5 minutes
    PERFORM cron.schedule(
      'nudge-clock-in',
      '*/5 * * * *',
      'SELECT public.nudge_check_clock_in()'
    );

    -- Schedule nudge_check_clock_out to run every 15 minutes
    PERFORM cron.schedule(
      'nudge-clock-out',
      '*/15 * * * *',
      'SELECT public.nudge_check_clock_out()'
    );

    RAISE NOTICE '[119] pg_cron jobs scheduled: nudge-clock-in (*/5), nudge-clock-out (*/15).';

  ELSE
    RAISE NOTICE '[119] pg_cron extension not found — skipping cron job scheduling. Install pg_cron and re-run.';
  END IF;
END $$;


-- ============================================================================
-- Done. Pulse Notification Engine is live.
-- ============================================================================
