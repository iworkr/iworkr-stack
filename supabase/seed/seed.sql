-- ============================================================
-- Seed Data: Demo Organization for Development
-- Run after migrations to populate test data
-- ============================================================

-- This seed file is designed to be idempotent.
-- It creates a demo organization that the first sign-up user
-- can be manually linked to during development.

-- Demo organization
insert into public.organizations (id, slug, name, trade, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'apex-plumbing',
  'Apex Plumbing',
  'plumbing',
  '{
    "timezone": "Australia/Brisbane",
    "currency": "AUD",
    "date_format": "DD/MM/YYYY",
    "fiscal_year_start": 7,
    "default_tax_rate": 10,
    "default_payment_terms": 14,
    "branches": ["HQ", "North Side"]
  }'::jsonb
)
on conflict (slug) do nothing;

-- NOTE: Organization members and profiles depend on auth.users
-- which are created at runtime. The onboarding flow handles
-- linking the first user as owner automatically.
