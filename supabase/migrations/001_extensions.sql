-- ============================================================================
-- @migration Extensions
-- @status COMPLETE
-- @description Enable required Postgres extensions (uuid-ossp, pg_cron, pg_net, pg_trgm)
-- @tables (none — extensions only)
-- @lastAudit 2026-03-22
-- ============================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_trgm with schema extensions;
