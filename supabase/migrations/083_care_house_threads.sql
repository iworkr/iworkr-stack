-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 083: Care Communications — House Thread Messaging Engine
-- (Project Nightingale — Project Echo)
-- Participant-centric channels with internal/external split, mandatory
-- acknowledgements, dynamic roster-synced memberships.
-- SAFE: All statements use IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Care Chat Channels (House Threads) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_chat_channels (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id    uuid,  -- NULL for DMs and team channels

  channel_type      text NOT NULL CHECK (channel_type IN (
    'house_internal', 'house_external', 'direct_message', 'team_channel'
  )),

  name              text,  -- e.g., "John Doe — Internal Care" or "#weekend-staff"
  description       text,
  is_archived       boolean DEFAULT false,
  is_read_only      boolean DEFAULT false,

  -- House thread linkage
  parent_group_name text,  -- e.g., "The Smith House" — groups internal+external together

  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_chat_org
  ON public.care_chat_channels (organization_id);
CREATE INDEX IF NOT EXISTS idx_care_chat_participant
  ON public.care_chat_channels (participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_chat_type
  ON public.care_chat_channels (organization_id, channel_type);

ALTER TABLE public.care_chat_channels ENABLE ROW LEVEL SECURITY;

-- ─── 2. Care Chat Members ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_chat_members (
  channel_id    uuid NOT NULL REFERENCES public.care_chat_channels(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,

  role          text NOT NULL DEFAULT 'member' CHECK (role IN (
    'admin', 'member', 'read_only', 'family_guest'
  )),

  -- Roster-sync tracking
  added_by_roster   boolean DEFAULT false,
  is_permanent      boolean DEFAULT false,  -- Key workers, coordinators
  last_read_at      timestamptz DEFAULT now(),
  joined_at         timestamptz DEFAULT now(),

  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_care_chat_members_user
  ON public.care_chat_members (user_id);

ALTER TABLE public.care_chat_members ENABLE ROW LEVEL SECURITY;

-- ─── 3. Care Chat Messages ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES public.care_chat_channels(id) ON DELETE CASCADE,
  sender_id     uuid,  -- NULL for system messages

  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'standard' CHECK (message_type IN (
    'standard', 'system_handover', 'manager_alert', 'system_roster_sync',
    'system_archived', 'system_message_removed'
  )),

  -- Rich content
  attachments   jsonb DEFAULT '[]'::jsonb,
  -- Array of: { filename: string, url: string, type: string, size_bytes: number }

  metadata      jsonb DEFAULT '{}'::jsonb,
  -- For alerts: { severity: 'critical'|'high', requires_ack: true, ack_count: 0, total_required: 5 }
  -- For handovers: { shift_id: string, worker_name: string, shift_time: string }

  reply_to_id   uuid REFERENCES public.care_chat_messages(id) ON DELETE SET NULL,
  is_edited     boolean DEFAULT false,
  is_pinned     boolean DEFAULT false,
  is_deleted    boolean DEFAULT false,  -- Soft delete for "nuke" feature

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_msgs_channel
  ON public.care_chat_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_msgs_sender
  ON public.care_chat_messages (sender_id)
  WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_msgs_type
  ON public.care_chat_messages (channel_id, message_type)
  WHERE message_type != 'standard';

ALTER TABLE public.care_chat_messages ENABLE ROW LEVEL SECURITY;

-- ─── 4. Message Acknowledgements (Manager Alerts) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.message_acknowledgements (
  message_id      uuid NOT NULL REFERENCES public.care_chat_messages(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_acknowledgements ENABLE ROW LEVEL SECURITY;

-- ─── 5. Typing Indicators (ephemeral, cleaned by cron) ─────────────────────

CREATE TABLE IF NOT EXISTS public.care_typing_indicators (
  channel_id  uuid NOT NULL REFERENCES public.care_chat_channels(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- Clean stale typing indicators every 10 seconds
-- (handled by application logic, table is ephemeral)

-- ─── 6. RLS Policies ────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Channels: members can see their channels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_channels' AND policyname = 'Members see their channels') THEN
    EXECUTE 'CREATE POLICY "Members see their channels" ON public.care_chat_channels FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.care_chat_members
        WHERE care_chat_members.channel_id = care_chat_channels.id
        AND care_chat_members.user_id = auth.uid()
      )
    )';
  END IF;

  -- Channels: org admins can manage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_channels' AND policyname = 'Org admins manage channels') THEN
    EXECUTE 'CREATE POLICY "Org admins manage channels" ON public.care_chat_channels FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.members
        WHERE members.organization_id = care_chat_channels.organization_id
        AND members.user_id = auth.uid()
        AND members.role IN (''owner'', ''admin'')
      )
    )';
  END IF;

  -- Members: users see their own memberships
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_members' AND policyname = 'Users see own memberships') THEN
    EXECUTE 'CREATE POLICY "Users see own memberships" ON public.care_chat_members FOR SELECT USING (
      user_id = auth.uid()
    )';
  END IF;

  -- Members: admins manage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_members' AND policyname = 'Admins manage memberships') THEN
    EXECUTE 'CREATE POLICY "Admins manage memberships" ON public.care_chat_members FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.care_chat_channels cc
        JOIN public.members m ON m.organization_id = cc.organization_id
        WHERE cc.id = care_chat_members.channel_id
        AND m.user_id = auth.uid()
        AND m.role IN (''owner'', ''admin'')
      )
    )';
  END IF;

  -- Messages: channel members can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_messages' AND policyname = 'Channel members read messages') THEN
    EXECUTE 'CREATE POLICY "Channel members read messages" ON public.care_chat_messages FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.care_chat_members
        WHERE care_chat_members.channel_id = care_chat_messages.channel_id
        AND care_chat_members.user_id = auth.uid()
      )
    )';
  END IF;

  -- Messages: members can insert
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_messages' AND policyname = 'Members send messages') THEN
    EXECUTE 'CREATE POLICY "Members send messages" ON public.care_chat_messages FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.care_chat_members
        WHERE care_chat_members.channel_id = care_chat_messages.channel_id
        AND care_chat_members.user_id = auth.uid()
        AND care_chat_members.role != ''read_only''
      )
    )';
  END IF;

  -- CRITICAL: Family guests CANNOT see internal channels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_chat_channels' AND policyname = 'Family guests blocked from internal') THEN
    EXECUTE 'CREATE POLICY "Family guests blocked from internal" ON public.care_chat_channels FOR SELECT USING (
      NOT (
        channel_type = ''house_internal''
        AND EXISTS (
          SELECT 1 FROM public.care_chat_members
          WHERE care_chat_members.channel_id = care_chat_channels.id
          AND care_chat_members.user_id = auth.uid()
          AND care_chat_members.role = ''family_guest''
        )
      )
    )';
  END IF;

  -- Acknowledgements: users manage their own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_acknowledgements' AND policyname = 'Users manage own acks') THEN
    EXECUTE 'CREATE POLICY "Users manage own acks" ON public.message_acknowledgements FOR ALL USING (
      user_id = auth.uid()
    )';
  END IF;

  -- Typing indicators
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'care_typing_indicators' AND policyname = 'Members manage typing') THEN
    EXECUTE 'CREATE POLICY "Members manage typing" ON public.care_typing_indicators FOR ALL USING (
      user_id = auth.uid()
    )';
  END IF;
END $$;

-- ─── 7. Auto-update triggers ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_care_chat_channels_updated_at') THEN
    CREATE TRIGGER set_care_chat_channels_updated_at
      BEFORE UPDATE ON public.care_chat_channels
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_care_chat_messages_updated_at') THEN
    CREATE TRIGGER set_care_chat_messages_updated_at
      BEFORE UPDATE ON public.care_chat_messages
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 8. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.care_chat_channels IS 'Care-sector messaging channels: house_internal, house_external, DMs, team channels. Project Echo.';
COMMENT ON TABLE public.care_chat_members IS 'Channel membership with roster-sync tracking and role-based access (admin/member/read_only/family_guest).';
COMMENT ON TABLE public.care_chat_messages IS 'Messages with type system: standard, system_handover, manager_alert. Supports soft-delete for compliance.';
COMMENT ON TABLE public.message_acknowledgements IS 'Mandatory read receipts for manager_alert messages. Required before shift clock-in.';
COMMENT ON TABLE public.care_typing_indicators IS 'Ephemeral typing indicator state for realtime UI. Cleaned automatically.';
