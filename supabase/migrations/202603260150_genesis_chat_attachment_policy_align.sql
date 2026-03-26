-- ============================================================================
-- @migration GenesisChatAttachmentPolicyAlign
-- @description Align chat attachment storage policies with active membership
--              model (channel_members + chat_participants compatibility).
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat attachments read by participant" ON storage.objects;
DROP POLICY IF EXISTS "chat attachments insert by participant" ON storage.objects;
DROP POLICY IF EXISTS "chat attachments update by participant" ON storage.objects;
DROP POLICY IF EXISTS "chat attachments delete by participant" ON storage.objects;

CREATE POLICY "chat attachments read by channel member"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat_attachments'
  AND (
    EXISTS (
      SELECT 1
      FROM public.channel_members cm
      WHERE cm.channel_id = (storage.foldername(name))[1]::uuid
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = (storage.foldername(name))[1]::uuid
        AND cp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "chat attachments insert by channel member"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'chat_attachments'
  AND (
    EXISTS (
      SELECT 1
      FROM public.channel_members cm
      WHERE cm.channel_id = (storage.foldername(name))[1]::uuid
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = (storage.foldername(name))[1]::uuid
        AND cp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "chat attachments update by channel member"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'chat_attachments'
  AND (
    EXISTS (
      SELECT 1
      FROM public.channel_members cm
      WHERE cm.channel_id = (storage.foldername(name))[1]::uuid
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = (storage.foldername(name))[1]::uuid
        AND cp.user_id = auth.uid()
    )
  )
);

CREATE POLICY "chat attachments delete by channel member"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'chat_attachments'
  AND (
    EXISTS (
      SELECT 1
      FROM public.channel_members cm
      WHERE cm.channel_id = (storage.foldername(name))[1]::uuid
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = (storage.foldername(name))[1]::uuid
        AND cp.user_id = auth.uid()
    )
  )
);
