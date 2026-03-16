-- ============================================================
-- Migration 104: Project Crucible
-- Multi-tenant integration token vault + auditor SMS OTP gate
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Multi-tenant integration token vault (encrypted at rest)
-- ------------------------------------------------------------
create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_type text not null,
  xero_tenant_id text,
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_integrations_org_type_tenant_unique unique (organization_id, integration_type, xero_tenant_id)
);

create index if not exists idx_tenant_integrations_lookup
  on public.tenant_integrations (integration_type, xero_tenant_id, organization_id);

create trigger set_tenant_integrations_updated_at
  before update on public.tenant_integrations
  for each row execute function public.update_updated_at();

create or replace function public.integration_encryption_key()
returns text
language sql
stable
security definer
as $$
  select coalesce(
    nullif(current_setting('app.settings.oauth_encryption_key', true), ''),
    nullif(current_setting('app.settings.service_role_key', true), ''),
    'local-dev-integration-key'
  );
$$;

create or replace function public.upsert_tenant_integration_secret(
  p_organization_id uuid,
  p_integration_type text,
  p_xero_tenant_id text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_key text := public.integration_encryption_key();
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  insert into public.tenant_integrations (
    organization_id,
    integration_type,
    xero_tenant_id,
    access_token_encrypted,
    refresh_token_encrypted,
    expires_at,
    metadata
  )
  values (
    p_organization_id,
    p_integration_type,
    p_xero_tenant_id,
    pgp_sym_encrypt(p_access_token, v_key),
    case when p_refresh_token is null then null else pgp_sym_encrypt(p_refresh_token, v_key) end,
    p_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (organization_id, integration_type, xero_tenant_id)
  do update set
    access_token_encrypted = excluded.access_token_encrypted,
    refresh_token_encrypted = excluded.refresh_token_encrypted,
    expires_at = excluded.expires_at,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_tenant_integration_secret(
  p_integration_type text,
  p_xero_tenant_id text
)
returns table (
  id uuid,
  organization_id uuid,
  integration_type text,
  xero_tenant_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.integration_encryption_key();
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;

  return query
  select
    ti.id,
    ti.organization_id,
    ti.integration_type,
    ti.xero_tenant_id,
    convert_from(pgp_sym_decrypt(ti.access_token_encrypted, v_key), 'utf8') as access_token,
    case
      when ti.refresh_token_encrypted is null then null
      else convert_from(pgp_sym_decrypt(ti.refresh_token_encrypted, v_key), 'utf8')
    end as refresh_token,
    ti.expires_at,
    ti.metadata
  from public.tenant_integrations ti
  where ti.integration_type = p_integration_type
    and ti.xero_tenant_id = p_xero_tenant_id
  limit 1;
end;
$$;

alter table public.tenant_integrations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'tenant_integrations' and policyname = 'Admins can view tenant integrations metadata'
  ) then
    create policy "Admins can view tenant integrations metadata"
      on public.tenant_integrations
      for select
      using (
        public.user_has_role(organization_id, 'admin')
        or auth.role() = 'service_role'
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Auditor portal phone + OTP challenge store
-- ------------------------------------------------------------
alter table public.auditor_portals
  add column if not exists auditor_phone text;

create table if not exists public.auditor_portal_otps (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.auditor_portals(id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auditor_portal_otps_portal_created
  on public.auditor_portal_otps (portal_id, created_at desc);

create trigger set_auditor_portal_otps_updated_at
  before update on public.auditor_portal_otps
  for each row execute function public.update_updated_at();

alter table public.auditor_portal_otps enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'auditor_portal_otps' and policyname = 'Service role can manage auditor OTPs'
  ) then
    create policy "Service role can manage auditor OTPs"
      on public.auditor_portal_otps
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
