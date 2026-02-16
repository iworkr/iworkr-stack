-- ============================================================
-- Migration 001: Extensions
-- Enable required Postgres extensions
-- ============================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
