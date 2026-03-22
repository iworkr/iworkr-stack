-- ============================================================
-- Migration 152: Project Athena-SOP — Knowledge Base & Video Wiki
-- Version 154.0 — "Omnipresent Expertise & Zero-Friction Upskilling"
-- ============================================================

-- ── 1. Enable pgvector ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Article Status ENUM ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Upgrade knowledge_articles ───────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  category                TEXT,
  tags                    JSONB DEFAULT '[]'::jsonb,
  thumbnail_url           TEXT,
  is_pinned               BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS content_html TEXT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS video_raw_url TEXT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS video_hls_url TEXT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS video_duration_seconds INT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS author_id UUID;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS is_mandatory_read BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS is_offline_critical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS estimated_read_minutes INT;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner';

-- ── 4. Knowledge Tags ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tag_name      TEXT NOT NULL,
  color_hex     TEXT DEFAULT '#10B981',
  usage_count   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_tags_unique
  ON public.knowledge_tags(workspace_id, LOWER(tag_name));
CREATE INDEX IF NOT EXISTS idx_knowledge_tags_workspace
  ON public.knowledge_tags(workspace_id);

-- ── 5. Article-Tag Junction ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.article_tags (
  article_id  UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES public.knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- ── 6. Article Embeddings (pgvector) ────────────────────────
CREATE TABLE IF NOT EXISTS public.article_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  embedding     vector(1536),
  model_name    TEXT DEFAULT 'text-embedding-3-small',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_embeddings_article
  ON public.article_embeddings(article_id);
CREATE INDEX IF NOT EXISTS idx_article_embeddings_workspace
  ON public.article_embeddings(workspace_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_article_embeddings_hnsw
  ON public.article_embeddings USING hnsw (embedding vector_cosine_ops);

-- ── 7. Read Receipts / Compliance ───────────────────────────
CREATE TABLE IF NOT EXISTS public.article_read_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  article_id            UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  worker_id             UUID NOT NULL,
  context_job_id        UUID REFERENCES public.jobs(id),
  watch_time_seconds    INT NOT NULL DEFAULT 0,
  completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  acknowledged_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_workspace ON public.article_read_receipts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_article ON public.article_read_receipts(article_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_worker ON public.article_read_receipts(worker_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_job ON public.article_read_receipts(context_job_id);

-- ── 8. Job Recommended SOPs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_recommended_sops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  article_id    UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  match_type    TEXT NOT NULL DEFAULT 'tag',
  match_score   DECIMAL(5,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_sops_unique ON public.job_recommended_sops(job_id, article_id);
CREATE INDEX IF NOT EXISTS idx_job_sops_job ON public.job_recommended_sops(job_id);

-- ── 9. Storage Bucket ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('knowledge-media', 'knowledge-media', false, 524288000,
  ARRAY['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── 10. RLS ─────────────────────────────────────────────────
ALTER TABLE public.knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_recommended_sops ENABLE ROW LEVEL SECURITY;

-- knowledge_tags
CREATE POLICY "Members manage knowledge tags" ON public.knowledge_tags
  FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = knowledge_tags.workspace_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Service role manages knowledge tags" ON public.knowledge_tags
  FOR ALL USING (auth.role() = 'service_role');

-- article_tags
CREATE POLICY "Members manage article tags" ON public.article_tags
  FOR ALL USING (EXISTS (SELECT 1 FROM public.knowledge_articles ka JOIN public.organization_members om ON om.organization_id = ka.organization_id WHERE ka.id = article_tags.article_id AND om.user_id = auth.uid() AND om.status = 'active'));
CREATE POLICY "Service role manages article tags" ON public.article_tags
  FOR ALL USING (auth.role() = 'service_role');

-- article_embeddings
CREATE POLICY "Members read embeddings" ON public.article_embeddings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = article_embeddings.workspace_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Service role manages embeddings" ON public.article_embeddings
  FOR ALL USING (auth.role() = 'service_role');

-- read_receipts
CREATE POLICY "Members manage read receipts" ON public.article_read_receipts
  FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = article_read_receipts.workspace_id AND user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Service role manages read receipts" ON public.article_read_receipts
  FOR ALL USING (auth.role() = 'service_role');

-- job_recommended_sops
CREATE POLICY "Members read job sops" ON public.job_recommended_sops
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs j JOIN public.organization_members om ON om.organization_id = j.organization_id WHERE j.id = job_recommended_sops.job_id AND om.user_id = auth.uid() AND om.status = 'active'));
CREATE POLICY "Service role manages job sops" ON public.job_recommended_sops
  FOR ALL USING (auth.role() = 'service_role');

-- Storage RLS
CREATE POLICY "Members upload knowledge media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'knowledge-media' AND EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Members read knowledge media" ON storage.objects
  FOR SELECT USING (bucket_id = 'knowledge-media' AND EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Service role manages knowledge media" ON storage.objects
  FOR ALL USING (bucket_id = 'knowledge-media' AND auth.role() = 'service_role');

-- ── 11. RPCs ────────────────────────────────────────────────

-- Semantic vector search
CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
  p_workspace_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT
        ka.id, ka.title, ka.description, ka.video_hls_url,
        ka.is_mandatory_read, ka.status, ka.estimated_read_minutes,
        ka.video_duration_seconds, ka.view_count,
        1 - (ae.embedding <=> p_query_embedding) AS similarity_score
      FROM public.article_embeddings ae
      JOIN public.knowledge_articles ka ON ka.id = ae.article_id
      WHERE ae.workspace_id = p_workspace_id
        AND ka.status = 'published'
      ORDER BY ae.embedding <=> p_query_embedding
      LIMIT p_limit
    ) t
  );
END;
$$;

-- Tag-based matching for a job
CREATE OR REPLACE FUNCTION public.match_sops_by_tags(
  p_workspace_id UUID,
  p_tag_names TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT DISTINCT ON (ka.id)
        ka.id, ka.title, ka.description, ka.video_hls_url,
        ka.is_mandatory_read, ka.estimated_read_minutes,
        ka.video_duration_seconds
      FROM public.knowledge_articles ka
      JOIN public.article_tags at2 ON at2.article_id = ka.id
      JOIN public.knowledge_tags kt ON kt.id = at2.tag_id
      WHERE ka.organization_id = p_workspace_id
        AND ka.status = 'published'
        AND LOWER(kt.tag_name) = ANY(SELECT LOWER(unnest(p_tag_names)))
      ORDER BY ka.id
      LIMIT 10
    ) t
  );
END;
$$;

-- Get articles for the knowledge library
CREATE OR REPLACE FUNCTION public.get_knowledge_library(
  p_workspace_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT
        ka.id, ka.title, ka.description, ka.category,
        ka.content_html, ka.video_hls_url, ka.video_duration_seconds,
        ka.author_id, ka.view_count, ka.is_mandatory_read,
        ka.is_offline_critical, ka.status,
        ka.estimated_read_minutes, ka.difficulty_level,
        ka.tags, ka.thumbnail_url,
        ka.created_at, ka.updated_at,
        p.full_name AS author_name,
        (SELECT COALESCE(json_agg(kt.tag_name), '[]'::json)
         FROM public.article_tags at2
         JOIN public.knowledge_tags kt ON kt.id = at2.tag_id
         WHERE at2.article_id = ka.id) AS structured_tags
      FROM public.knowledge_articles ka
      LEFT JOIN public.profiles p ON p.id = ka.author_id
      WHERE ka.organization_id = p_workspace_id
        AND (p_status IS NULL OR ka.status = p_status)
        AND (p_search IS NULL OR p_search = ''
          OR ka.title ILIKE '%' || p_search || '%'
          OR ka.description ILIKE '%' || p_search || '%'
          OR ka.raw_text ILIKE '%' || p_search || '%')
        AND (p_tag IS NULL OR p_tag = ''
          OR EXISTS (SELECT 1 FROM public.article_tags at2
                     JOIN public.knowledge_tags kt ON kt.id = at2.tag_id
                     WHERE at2.article_id = ka.id AND LOWER(kt.tag_name) = LOWER(p_tag)))
      ORDER BY ka.is_pinned DESC NULLS LAST, ka.updated_at DESC
      LIMIT p_limit OFFSET p_offset
    ) t
  );
END;
$$;

-- Knowledge stats
CREATE OR REPLACE FUNCTION public.get_knowledge_stats(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_articles', COUNT(*),
      'published', COUNT(*) FILTER (WHERE status = 'published'),
      'drafts', COUNT(*) FILTER (WHERE status = 'draft'),
      'with_video', COUNT(*) FILTER (WHERE video_hls_url IS NOT NULL),
      'mandatory', COUNT(*) FILTER (WHERE is_mandatory_read = true),
      'offline_critical', COUNT(*) FILTER (WHERE is_offline_critical = true),
      'total_views', COALESCE(SUM(view_count), 0),
      'total_watch_time', (
        SELECT COALESCE(SUM(watch_time_seconds), 0)
        FROM public.article_read_receipts
        WHERE workspace_id = p_workspace_id
      ),
      'unread_mandatory', (
        SELECT COUNT(DISTINCT ka.id)
        FROM public.knowledge_articles ka
        WHERE ka.organization_id = p_workspace_id
          AND ka.is_mandatory_read = true
          AND ka.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM public.article_read_receipts arr
            WHERE arr.article_id = ka.id AND arr.acknowledged_at IS NOT NULL
          )
      )
    )
    FROM public.knowledge_articles
    WHERE organization_id = p_workspace_id
  );
END;
$$;

-- Get recommended SOPs for a job
CREATE OR REPLACE FUNCTION public.get_job_recommended_sops(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
      SELECT
        ka.id, ka.title, ka.description, ka.video_hls_url,
        ka.video_duration_seconds, ka.is_mandatory_read,
        ka.estimated_read_minutes, ka.thumbnail_url,
        ka.content_html, ka.status,
        jrs.match_type, jrs.match_score
      FROM public.job_recommended_sops jrs
      JOIN public.knowledge_articles ka ON ka.id = jrs.article_id
      WHERE jrs.job_id = p_job_id
        AND ka.status = 'published'
      ORDER BY jrs.match_score DESC NULLS LAST
    ) t
  );
END;
$$;

-- Acknowledge article (compliance)
CREATE OR REPLACE FUNCTION public.acknowledge_article(
  p_workspace_id UUID,
  p_article_id UUID,
  p_worker_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_watch_time_seconds INT DEFAULT 0,
  p_completion_percentage DECIMAL DEFAULT 1.0
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_receipt_id UUID;
BEGIN
  INSERT INTO public.article_read_receipts (
    workspace_id, article_id, worker_id, context_job_id,
    watch_time_seconds, completion_percentage, acknowledged_at
  ) VALUES (
    p_workspace_id, p_article_id, p_worker_id, p_job_id,
    p_watch_time_seconds, p_completion_percentage, now()
  )
  RETURNING id INTO v_receipt_id;

  -- Increment view count
  UPDATE public.knowledge_articles
  SET view_count = view_count + 1
  WHERE id = p_article_id;

  RETURN json_build_object(
    'success', true,
    'receipt_id', v_receipt_id,
    'acknowledged_at', now()
  );
END;
$$;

-- ── 12. Realtime ────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_articles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_recommended_sops;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
