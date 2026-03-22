-- ============================================================================
-- @migration AegisZeroTypingIndicatorsRLSHardening
-- @status COMPLETE
-- @description Project Aegis-Zero — tighten care_typing_indicators RLS with org-scoped policies
-- @tables care_typing_indicators (policies)
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Chat members can manage typing indicators" ON public.care_typing_indicators;
DROP POLICY IF EXISTS "Members manage typing" ON public.care_typing_indicators;

-- 2. SELECT: Users can only see typing in channels they belong to,
-- AND the channel must belong to their organization
CREATE POLICY "Org-isolated typing read" ON public.care_typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_chat_members ccm
      JOIN public.care_chat_channels cc ON cc.id = ccm.channel_id
      JOIN public.organization_members om ON om.organization_id = cc.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
      WHERE ccm.channel_id = care_typing_indicators.channel_id
        AND ccm.user_id = auth.uid()
    )
  );

-- 3. INSERT: Users can only write their own typing status,
-- in channels they belong to within their org
CREATE POLICY "Org-isolated typing write" ON public.care_typing_indicators
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.care_chat_members ccm
      JOIN public.care_chat_channels cc ON cc.id = ccm.channel_id
      JOIN public.organization_members om ON om.organization_id = cc.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
      WHERE ccm.channel_id = care_typing_indicators.channel_id
        AND ccm.user_id = auth.uid()
    )
  );

-- 4. UPDATE: Users can only update their own typing status
CREATE POLICY "Own typing update" ON public.care_typing_indicators
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. DELETE: Users can only delete their own typing status
CREATE POLICY "Own typing delete" ON public.care_typing_indicators
  FOR DELETE USING (user_id = auth.uid());
