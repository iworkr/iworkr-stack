-- ============================================================================
-- @migration GlasshouseDailyUpdates
-- @status COMPLETE
-- @description Project Glasshouse — daily updates feed, worker bios, publishing workflow
-- @tables glasshouse_daily_updates, staff_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Worker Bio fields on staff_profiles ───────────────────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS public_bio text,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS is_published_to_directory boolean DEFAULT false;

-- ── 2. Glasshouse Daily Updates (Sanitized Clinical Feed) ────────
CREATE TABLE IF NOT EXISTS public.glasshouse_daily_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  original_shift_id uuid,
  original_progress_note_id uuid,

  -- The sanitized content
  title text NOT NULL,
  sanitized_content text NOT NULL,
  media_urls text[] DEFAULT '{}',

  -- Publishing metadata
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),

  -- Read receipts
  viewed_by jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.glasshouse_daily_updates ENABLE ROW LEVEL SECURITY;

-- Families can only view updates for their linked participants
CREATE POLICY "Families can view linked daily updates"
  ON public.glasshouse_daily_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participant_network_members pnm
      WHERE pnm.user_id = auth.uid()
        AND pnm.participant_id = glasshouse_daily_updates.participant_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = glasshouse_daily_updates.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Org members (coordinators) can insert daily updates
CREATE POLICY "Coordinators can publish daily updates"
  ON public.glasshouse_daily_updates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = glasshouse_daily_updates.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 3. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_updates_participant
  ON public.glasshouse_daily_updates(participant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_published
  ON public.staff_profiles(organization_id)
  WHERE is_published_to_directory = true;
