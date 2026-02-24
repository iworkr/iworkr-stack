-- ═══════════════════════════════════════════════════════════
-- Migration 034: Chat Last Messages RPC
-- ═══════════════════════════════════════════════════════════
-- Returns the last message content, sender name, and unread count
-- for a batch of channel IDs. Used by the mobile Channels screen
-- to hydrate message previews without N+1 queries.

CREATE OR REPLACE FUNCTION get_last_messages_for_channels(p_channel_ids uuid[])
RETURNS TABLE (
  channel_id uuid,
  content text,
  sender_name text,
  unread_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.channel_id)
    m.channel_id,
    m.content,
    p.full_name AS sender_name,
    COALESCE(u.cnt, 0) AS unread_count
  FROM messages m
  LEFT JOIN profiles p ON p.id = m.sender_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM messages m2
    JOIN channel_members cm ON cm.channel_id = m2.channel_id
      AND cm.user_id = auth.uid()
    WHERE m2.channel_id = m.channel_id
      AND m2.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
      AND m2.sender_id != auth.uid()
  ) u ON true
  WHERE m.channel_id = ANY(p_channel_ids)
  ORDER BY m.channel_id, m.created_at DESC;
$$;
