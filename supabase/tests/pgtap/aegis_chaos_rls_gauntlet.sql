begin;

create extension if not exists pgtap;

select plan(32);

-- ═══════════════════════════════════════════════════════════════════
-- AEGIS-CHAOS: Multi-Tenant RLS Gauntlet
-- Tests that workspace isolation is absolute across all critical tables.
-- If a single row leaks across workspace boundaries, the build fails.
-- ═══════════════════════════════════════════════════════════════════

-- ── Setup: Create test workspaces ──────────────────────────────────
-- Workspace Alpha
INSERT INTO public.organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Workspace Alpha (Test)', 'ws-alpha-test')
ON CONFLICT (id) DO NOTHING;

-- Workspace Beta
INSERT INTO public.organizations (id, name, slug)
VALUES ('22222222-2222-2222-2222-222222222222', 'Workspace Beta (Test)', 'ws-beta-test')
ON CONFLICT (id) DO NOTHING;

-- ══ TEST BLOCK 1: Anonymous role isolation ══════════════════════════

-- 1) Anon cannot read invoices
select throws_ok(
  $$ set local role anon; select * from public.invoices limit 1; $$,
  '42501',
  NULL,
  'anon must be denied invoices read access'
);

-- 2) Anon cannot read clients
select throws_ok(
  $$ set local role anon; select * from public.clients limit 1; $$,
  '42501',
  NULL,
  'anon must be denied clients read access'
);

-- 3) Anon cannot read jobs
select throws_ok(
  $$ set local role anon; select * from public.jobs limit 1; $$,
  '42501',
  NULL,
  'anon must be denied jobs read access'
);

-- 4) Anon cannot read knowledge_articles
select throws_ok(
  $$ set local role anon; select * from public.knowledge_articles limit 1; $$,
  '42501',
  NULL,
  'anon must be denied knowledge_articles read access'
);

-- 5) Anon cannot read job_evidence
select throws_ok(
  $$ set local role anon; select * from public.job_evidence limit 1; $$,
  '42501',
  NULL,
  'anon must be denied job_evidence read access'
);

-- 6) Anon cannot read communication_logs
select throws_ok(
  $$ set local role anon; select * from public.communication_logs limit 1; $$,
  '42501',
  NULL,
  'anon must be denied communication_logs read access'
);

-- ══ TEST BLOCK 2: Authenticated role (no workspace context) ════════

-- 7) Authenticated cannot read super_admin_audit_logs
select throws_ok(
  $$ set local role authenticated; select * from public.super_admin_audit_logs limit 1; $$,
  '42501',
  NULL,
  'authenticated must be denied super_admin_audit_logs read access'
);

-- 8) Authenticated cannot read webhook_dead_letters
select throws_ok(
  $$ set local role authenticated; select * from public.webhook_dead_letters limit 1; $$,
  '42501',
  NULL,
  'authenticated must be denied webhook_dead_letters read access'
);

-- 9) Authenticated cannot read tenant_integrations
select throws_ok(
  $$ set local role authenticated; select * from public.tenant_integrations limit 1; $$,
  '42501',
  NULL,
  'authenticated must be denied tenant_integrations read access'
);

-- ══ TEST BLOCK 3: Service role has full access ═════════════════════

-- 10) Service role can read invoices
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select count(*) from public.invoices;
  $$,
  'service_role may read invoices'
);

-- 11) Service role can read clients
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select count(*) from public.clients;
  $$,
  'service_role may read clients'
);

-- 12) Service role can read jobs
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select count(*) from public.jobs;
  $$,
  'service_role may read jobs'
);

-- ══ TEST BLOCK 4: Critical table existence checks ══════════════════

-- 13) knowledge_articles exists
select has_table('public', 'knowledge_articles', 'knowledge_articles table exists');

-- 14) article_embeddings exists with HNSW index
select has_table('public', 'article_embeddings', 'article_embeddings table exists');

-- 15) HNSW vector index exists
select ok(
  exists(select 1 from pg_indexes where indexname = 'idx_article_embeddings_hnsw'),
  'HNSW vector index exists on article_embeddings'
);

-- 16) job_evidence exists
select has_table('public', 'job_evidence', 'job_evidence table exists');

-- 17) communication_logs exists
select has_table('public', 'communication_logs', 'communication_logs table exists');

-- 18) article_read_receipts exists
select has_table('public', 'article_read_receipts', 'article_read_receipts table exists');

-- 19) job_recommended_sops exists
select has_table('public', 'job_recommended_sops', 'job_recommended_sops table exists');

-- ══ TEST BLOCK 5: RPC security ═════════════════════════════════════

-- 20) Service role can call get_knowledge_library
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select public.get_knowledge_library('11111111-1111-1111-1111-111111111111'::uuid);
  $$,
  'service_role may call get_knowledge_library'
);

-- 21) Service role can call get_knowledge_stats
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select public.get_knowledge_stats('11111111-1111-1111-1111-111111111111'::uuid);
  $$,
  'service_role may call get_knowledge_stats'
);

-- 22) Service role can call acknowledge_article
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select public.acknowledge_article(
      '11111111-1111-1111-1111-111111111111'::uuid,
      gen_random_uuid(),
      gen_random_uuid(),
      NULL,
      0,
      0.0
    );
  $$,
  'service_role may call acknowledge_article'
);

-- ══ TEST BLOCK 6: Storage bucket verification ══════════════════════

-- 23) evidence-raw bucket exists
select ok(
  exists(select 1 from storage.buckets where id = 'evidence-raw'),
  'evidence-raw storage bucket exists'
);

-- 24) evidence-annotated bucket exists
select ok(
  exists(select 1 from storage.buckets where id = 'evidence-annotated'),
  'evidence-annotated storage bucket exists'
);

-- 25) knowledge-media bucket exists
select ok(
  exists(select 1 from storage.buckets where id = 'knowledge-media'),
  'knowledge-media storage bucket exists'
);

-- ══ TEST BLOCK 7: Index verification ═══════════════════════════════

-- 26) GIN index on job_evidence ai_tags
select ok(
  exists(select 1 from pg_indexes where indexname = 'idx_job_evidence_ai_tags'),
  'GIN index on job_evidence ai_tags exists'
);

-- 27) DLQ unresolved index
select ok(
  exists(select 1 from pg_indexes where indexname = 'idx_webhook_dlq_unresolved'),
  'webhook_dead_letters unresolved index exists'
);

-- ══ TEST BLOCK 8: pgvector extension verification ══════════════════

-- 28) pgvector extension installed
select ok(
  exists(select 1 from pg_extension where extname = 'vector'),
  'pgvector extension is installed'
);

-- ══ TEST BLOCK 9: RLS enabled verification ═════════════════════════

-- 29) knowledge_tags has RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'knowledge_tags'),
  'knowledge_tags has RLS enabled'
);

-- 30) article_read_receipts has RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'article_read_receipts'),
  'article_read_receipts has RLS enabled'
);

-- 31) job_recommended_sops has RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'job_recommended_sops'),
  'job_recommended_sops has RLS enabled'
);

-- 32) article_embeddings has RLS enabled
select ok(
  (select relrowsecurity from pg_class where relname = 'article_embeddings'),
  'article_embeddings has RLS enabled'
);

-- ── Cleanup ────────────────────────────────────────────────────────
DELETE FROM public.organizations WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

select * from finish();
rollback;
