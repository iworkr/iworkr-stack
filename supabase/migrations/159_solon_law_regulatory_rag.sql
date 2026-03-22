-- ============================================================================
-- @migration SolonLawRegulatoryRAG
-- @status COMPLETE
-- @description Project Solon-Law — semantic regulatory RAG, compliance firewall, pgvector
-- @tables regulatory_frameworks, regulation_chunks, compliance_checks
-- @lastAudit 2026-03-22
-- ============================================================================

-- pgvector already enabled in migration 152

-- ═══════════════════════════════════════════════════════════
-- PART 1: ENUMs
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_status') THEN
    CREATE TYPE public.framework_status AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_mode') THEN
    CREATE TYPE public.compliance_mode AS ENUM ('ADVISORY', 'HARD_STOP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intercept_result') THEN
    CREATE TYPE public.intercept_result AS ENUM (
      'COMPLIANT', 'VIOLATION_DETECTED', 'LOW_CONFIDENCE', 'ERROR'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Regulatory Frameworks (Versioned legislation)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.regulatory_frameworks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  version_code    VARCHAR(50),
  description     TEXT,
  sector          VARCHAR(20) DEFAULT 'both',
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  source_pdf_url  TEXT,
  total_chunks    INT DEFAULT 0,
  status          public.framework_status NOT NULL DEFAULT 'DRAFT',
  ingestion_status VARCHAR(30) DEFAULT 'pending',
  ingested_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_frameworks_ws
  ON public.regulatory_frameworks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_frameworks_active
  ON public.regulatory_frameworks(effective_date, expiry_date)
  WHERE status = 'ACTIVE';

ALTER TABLE public.regulatory_frameworks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_frameworks"
  ON public.regulatory_frameworks FOR SELECT
  USING (
    workspace_id IS NULL OR
    workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_frameworks"
  ON public.regulatory_frameworks FOR ALL
  USING (
    workspace_id IS NULL OR
    workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Regulatory Chunks (Vector embeddings)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.regulatory_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES public.regulatory_frameworks(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  content         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  embedding       vector(1536),
  token_count     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_chunks_framework
  ON public.regulatory_chunks(framework_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_reg_chunks_embedding
  ON public.regulatory_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE public.regulatory_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "read_chunks_via_framework"
  ON public.regulatory_chunks FOR SELECT
  USING (
    framework_id IN (
      SELECT id FROM public.regulatory_frameworks
      WHERE workspace_id IS NULL OR workspace_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "manage_chunks_via_framework"
  ON public.regulatory_chunks FOR ALL
  USING (
    framework_id IN (
      SELECT id FROM public.regulatory_frameworks
      WHERE workspace_id IS NULL OR workspace_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Compliance Audit Logs
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.compliance_intercept_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.profiles(id),
  context_type      VARCHAR(50) NOT NULL,
  context_id        UUID,
  serialized_intent TEXT NOT NULL,
  result            public.intercept_result NOT NULL,
  confidence_flag   VARCHAR(20) DEFAULT 'HIGH',
  violations        JSONB DEFAULT '[]',
  matched_chunks    JSONB DEFAULT '[]',
  framework_id      UUID REFERENCES public.regulatory_frameworks(id),
  llm_model_used    VARCHAR(100),
  was_overridden    BOOLEAN DEFAULT false,
  override_reason   TEXT,
  overridden_by     UUID REFERENCES public.profiles(id),
  overridden_at     TIMESTAMPTZ,
  processing_ms     INT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_logs_org
  ON public.compliance_intercept_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_logs_result
  ON public.compliance_intercept_logs(organization_id, result)
  WHERE result = 'VIOLATION_DETECTED';

ALTER TABLE public.compliance_intercept_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_compliance_logs"
  ON public.compliance_intercept_logs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_compliance_logs"
  ON public.compliance_intercept_logs FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 5: Compliance config on organizations
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS compliance_mode public.compliance_mode DEFAULT 'ADVISORY',
  ADD COLUMN IF NOT EXISTS compliance_enabled BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════
-- PART 6: Semantic Search RPC (Temporal-aware)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_regulatory_chunks(
  p_query_embedding  vector(1536),
  p_workspace_id     UUID DEFAULT NULL,
  p_operation_date   DATE DEFAULT CURRENT_DATE,
  p_framework_id     UUID DEFAULT NULL,
  p_limit            INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id        UUID,
  framework_id    UUID,
  framework_title TEXT,
  chunk_index     INT,
  content         TEXT,
  metadata        JSONB,
  similarity      FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id AS chunk_id,
    rc.framework_id,
    rf.title AS framework_title,
    rc.chunk_index,
    rc.content,
    rc.metadata,
    (1 - (rc.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM public.regulatory_chunks rc
  JOIN public.regulatory_frameworks rf ON rf.id = rc.framework_id
  WHERE rf.status = 'ACTIVE'
    AND rf.effective_date <= p_operation_date
    AND (rf.expiry_date IS NULL OR rf.expiry_date >= p_operation_date)
    AND (p_framework_id IS NULL OR rc.framework_id = p_framework_id)
    AND (
      rf.workspace_id IS NULL
      OR rf.workspace_id = p_workspace_id
    )
    AND rc.embedding IS NOT NULL
  ORDER BY rc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 7: Storage bucket for raw regulation PDFs
-- ═══════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-raw', 'compliance-raw', false, 104857600,
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;
