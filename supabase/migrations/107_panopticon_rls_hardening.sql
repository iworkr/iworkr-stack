-- ============================================================================
-- @migration PanopticonRLSHardening
-- @status COMPLETE
-- @description Project Panopticon — RLS hardening for vault, audit, and DLQ tables
-- @tables super_admin_audit_logs, webhook_dead_letters, tenant_integrations (policies)
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1) Hard deny grants for sensitive tables.
revoke all on table public.super_admin_audit_logs from public, anon, authenticated;
revoke all on table public.webhook_dead_letters from public, anon, authenticated;
revoke all on table public.tenant_integrations from public, anon, authenticated;

grant all on table public.super_admin_audit_logs to service_role;
grant all on table public.webhook_dead_letters to service_role;
grant all on table public.tenant_integrations to service_role;

-- 2) Force RLS so privileged ownership paths do not bypass policies.
alter table public.super_admin_audit_logs force row level security;
alter table public.webhook_dead_letters force row level security;
alter table public.tenant_integrations force row level security;

-- 3) Tighten tenant vault table policies to service role only.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_integrations'
      and policyname = 'Admins can view tenant integrations metadata'
  ) then
    drop policy "Admins can view tenant integrations metadata" on public.tenant_integrations;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_integrations'
      and policyname = 'Service role manages tenant integrations'
  ) then
    create policy "Service role manages tenant integrations"
      on public.tenant_integrations
      for all
      using (coalesce(auth.role(), '') = 'service_role')
      with check (coalesce(auth.role(), '') = 'service_role');
  end if;
end $$;

-- 4) Restrict vault RPC execute permissions to service_role.
revoke execute on function public.integration_encryption_key() from public, anon, authenticated;
revoke execute on function public.get_tenant_integration_secret(text, text) from public, anon, authenticated;
revoke execute on function public.upsert_tenant_integration_secret(uuid, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;

create or replace function public.integration_encryption_key()
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    nullif(current_setting('app.settings.vault_key', true), ''),
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
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_key text := public.integration_encryption_key();
begin
  if coalesce(nullif(auth.role(), ''), current_role, current_user, '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if v_key is null or v_key = '' then
    raise exception 'integration encryption key is not configured';
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
    extensions.pgp_sym_encrypt(p_access_token, v_key),
    case
      when p_refresh_token is null then null
      else extensions.pgp_sym_encrypt(p_refresh_token, v_key)
    end,
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
set search_path = public, extensions
as $$
declare
  v_key text := public.integration_encryption_key();
begin
  if coalesce(nullif(auth.role(), ''), current_role, current_user, '') is distinct from 'service_role' then
    raise exception 'forbidden';
  end if;

  if v_key is null or v_key = '' then
    raise exception 'integration encryption key is not configured';
  end if;

  return query
  select
    ti.id,
    ti.organization_id,
    ti.integration_type,
    ti.xero_tenant_id,
    extensions.pgp_sym_decrypt(ti.access_token_encrypted, v_key) as access_token,
    case
      when ti.refresh_token_encrypted is null then null
      else extensions.pgp_sym_decrypt(ti.refresh_token_encrypted, v_key)
    end as refresh_token,
    ti.expires_at,
    ti.metadata
  from public.tenant_integrations ti
  where ti.integration_type = p_integration_type
    and ti.xero_tenant_id = p_xero_tenant_id
  limit 1;
end;
$$;

grant execute on function public.integration_encryption_key() to service_role;
grant execute on function public.get_tenant_integration_secret(text, text) to service_role;
grant execute on function public.upsert_tenant_integration_secret(uuid, text, text, text, text, timestamptz, jsonb) to service_role;
