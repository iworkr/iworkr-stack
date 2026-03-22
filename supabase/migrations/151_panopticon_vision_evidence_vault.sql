-- ============================================================================
-- @migration PanopticonVisionEvidenceVault
-- @status COMPLETE
-- @description Project Panopticon-Vision — evidence vault, photo annotations, before/after
-- @tables evidence_items, evidence_annotations, storage buckets: evidence-raw, evidence-annotated
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Storage Buckets ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('evidence-raw', 'evidence-raw', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('evidence-annotated', 'evidence-annotated', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── 2. Storage RLS ──────────────────────────────────────────
CREATE POLICY "Workspace members upload evidence-raw" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence-raw' AND
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Workspace members read evidence-raw" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence-raw' AND
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Workspace members upload evidence-annotated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence-annotated' AND
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Workspace members read evidence-annotated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence-annotated' AND
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Service role manages evidence-raw" ON storage.objects
  FOR ALL USING (bucket_id = 'evidence-raw' AND auth.role() = 'service_role');
CREATE POLICY "Service role manages evidence-annotated" ON storage.objects
  FOR ALL USING (bucket_id = 'evidence-annotated' AND auth.role() = 'service_role');

-- ── 3. The Evidence Vault Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id            UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id         UUID NOT NULL,

  original_path     TEXT NOT NULL,
  annotated_path    TEXT,
  thumbnail_path    TEXT,

  ai_tags           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_confidence     JSONB DEFAULT '{}'::jsonb,
  manual_caption    TEXT,
  manual_tags       TEXT[] DEFAULT '{}',

  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  lat_lng           geography(POINT, 4326),

  file_size_bytes   BIGINT,
  image_width       INT,
  image_height      INT,

  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  is_defect         BOOLEAN NOT NULL DEFAULT false,
  face_detected     BOOLEAN NOT NULL DEFAULT false,
  face_obfuscated   BOOLEAN NOT NULL DEFAULT false,

  watermark_data    JSONB DEFAULT '{}'::jsonb,
  device_info       JSONB DEFAULT '{}'::jsonb,

  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_evidence_workspace ON public.job_evidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_job_evidence_job ON public.job_evidence(job_id);
CREATE INDEX IF NOT EXISTS idx_job_evidence_worker ON public.job_evidence(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_evidence_ai_tags ON public.job_evidence USING GIN (ai_tags);
CREATE INDEX IF NOT EXISTS idx_job_evidence_captured ON public.job_evidence(workspace_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_evidence_defect ON public.job_evidence(workspace_id) WHERE is_defect = true;
CREATE INDEX IF NOT EXISTS idx_job_evidence_client_visible ON public.job_evidence(job_id) WHERE is_client_visible = true;

-- ── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE public.job_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage evidence" ON public.job_evidence
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = job_evidence.workspace_id AND user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Service role manages evidence" ON public.job_evidence
  FOR ALL USING (auth.role() = 'service_role');

-- ── 6. RPC: Search Evidence by AI Tags ──────────────────────
CREATE OR REPLACE FUNCTION public.search_evidence_by_tag(
  p_workspace_id UUID,
  p_search_term TEXT,
  p_job_id UUID DEFAULT NULL,
  p_defects_only BOOLEAN DEFAULT false,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT
        e.id, e.job_id, e.worker_id,
        e.original_path, e.annotated_path, e.thumbnail_path,
        e.ai_tags, e.manual_caption, e.manual_tags,
        e.location_lat, e.location_lng,
        e.is_client_visible, e.is_defect,
        e.face_detected, e.face_obfuscated,
        e.watermark_data, e.captured_at,
        j.display_id AS job_display_id, j.title AS job_title
      FROM public.job_evidence e
      LEFT JOIN public.jobs j ON j.id = e.job_id
      WHERE e.workspace_id = p_workspace_id
        AND (p_job_id IS NULL OR e.job_id = p_job_id)
        AND (NOT p_defects_only OR e.is_defect = true)
        AND (
          p_search_term IS NULL
          OR p_search_term = ''
          OR e.ai_tags::text ILIKE '%' || p_search_term || '%'
          OR e.manual_caption ILIKE '%' || p_search_term || '%'
          OR p_search_term = ANY(e.manual_tags)
        )
      ORDER BY e.captured_at DESC
      LIMIT p_limit OFFSET p_offset
    ) t
  );
END;
$$;

-- ── 7. RPC: Get Evidence Stats ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_evidence_stats(
  p_workspace_id UUID,
  p_job_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total', COUNT(*),
      'annotated', COUNT(*) FILTER (WHERE annotated_path IS NOT NULL),
      'defects', COUNT(*) FILTER (WHERE is_defect = true),
      'client_visible', COUNT(*) FILTER (WHERE is_client_visible = true),
      'face_detected', COUNT(*) FILTER (WHERE face_detected = true),
      'with_captions', COUNT(*) FILTER (WHERE manual_caption IS NOT NULL AND manual_caption != ''),
      'unique_tags', (
        SELECT COALESCE(json_agg(DISTINCT tag), '[]'::json)
        FROM public.job_evidence e2, jsonb_array_elements_text(e2.ai_tags) AS tag
        WHERE e2.workspace_id = p_workspace_id
          AND (p_job_id IS NULL OR e2.job_id = p_job_id)
      )
    )
    FROM public.job_evidence
    WHERE workspace_id = p_workspace_id
      AND (p_job_id IS NULL OR job_id = p_job_id)
  );
END;
$$;

-- ── 8. RPC: Toggle Client Visibility ────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_evidence_visibility(
  p_evidence_id UUID,
  p_visible BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.job_evidence
  SET is_client_visible = p_visible
  WHERE id = p_evidence_id;

  RETURN json_build_object('success', true, 'id', p_evidence_id, 'is_client_visible', p_visible);
END;
$$;

-- ── 9. Realtime ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_evidence;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
