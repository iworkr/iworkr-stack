-- ============================================================
-- Migration 002: Custom Enums
-- All enum types used across core and modules
-- ============================================================

-- Core enums
create type public.org_role as enum (
  'owner', 'admin', 'manager', 'senior_tech',
  'technician', 'apprentice', 'subcontractor', 'office_admin'
);

create type public.invite_status as enum ('pending', 'accepted', 'expired');

create type public.subscription_status as enum (
  'active', 'past_due', 'canceled', 'incomplete', 'trialing'
);

create type public.member_status as enum (
  'active', 'pending', 'suspended', 'archived'
);
