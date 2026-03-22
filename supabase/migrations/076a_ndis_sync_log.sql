-- ============================================================================
-- @migration NDISSyncLog
-- @status COMPLETE
-- @description NDIS sync history tracking and category counts RPC
-- @tables ndis_sync_log
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. NDIS Sync Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ndis_sync_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  synced_by         uuid REFERENCES auth.users(id),
  effective_from    date NOT NULL,
  items_inserted    int NOT NULL DEFAULT 0,
  items_updated     int NOT NULL DEFAULT 0,
  items_closed      int NOT NULL DEFAULT 0,
  source            text NOT NULL DEFAULT 'csv_upload',
  filename          text,
  status            text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_sync_log_org
  ON public.ndis_sync_log (organization_id, created_at DESC);

-- ─── 2. Enable RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.ndis_sync_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ndis_sync_log' AND policyname = 'Org members can read sync log') THEN
    CREATE POLICY "Org members can read sync log"
      ON public.ndis_sync_log FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── 3. Category Counts RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_ndis_category_counts()
RETURNS TABLE (support_category text, count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT support_category, COUNT(*)
  FROM public.ndis_catalogue
  WHERE effective_to IS NULL
  GROUP BY support_category;
$$;

-- ─── 4. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.ndis_sync_log IS
  'Audit trail of NDIS Support Catalogue sync operations.';
COMMENT ON FUNCTION public.get_ndis_category_counts IS
  'Returns count of active NDIS catalogue items grouped by support category.';
