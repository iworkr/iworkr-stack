begin;

create extension if not exists pgtap;

select plan(8);

-- 1) Anonymous role cannot read sensitive audit trail
select throws_ok(
  $$ set local role anon; select * from public.super_admin_audit_logs limit 1; $$,
  '42501',
  'permission denied for table super_admin_audit_logs',
  'anon must be denied super_admin_audit_logs read access'
);

-- 2) Authenticated role cannot read webhook DLQ directly
select throws_ok(
  $$ set local role authenticated; select * from public.webhook_dead_letters limit 1; $$,
  '42501',
  'permission denied for table webhook_dead_letters',
  'authenticated role must be denied webhook_dead_letters read access'
);

-- 3) Anonymous role cannot read tenant token vault table
select throws_ok(
  $$ set local role anon; select * from public.tenant_integrations limit 1; $$,
  '42501',
  'permission denied for table tenant_integrations',
  'anon must be denied tenant_integrations read access'
);

-- 4) Authenticated role cannot read tenant token vault table
select throws_ok(
  $$ set local role authenticated; select * from public.tenant_integrations limit 1; $$,
  '42501',
  'permission denied for table tenant_integrations',
  'authenticated role must be denied tenant_integrations read access'
);

-- 5) Service role can call secure vault RPC
select lives_ok(
  $$
    select set_config('request.jwt.claim.role', 'service_role', true);
    select public.get_tenant_integration_secret('xero', 'does-not-exist');
  $$,
  'service_role may call get_tenant_integration_secret'
);

-- 6) Non-service role cannot call secure vault RPC
select throws_ok(
  $$
    set local role authenticated;
    select public.get_tenant_integration_secret('xero', 'does-not-exist');
  $$,
  '42501',
  'permission denied for function get_tenant_integration_secret',
  'authenticated must be blocked from get_tenant_integration_secret execution'
);

-- 7) Non-service role cannot call secure vault upsert RPC
select throws_ok(
  $$
    set local role authenticated;
    select public.upsert_tenant_integration_secret(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
      'xero',
      'panopticon-rls-test',
      'token-a',
      'token-b',
      now() + interval '1 day',
      '{}'::jsonb
    );
  $$,
  '42501',
  'permission denied for function upsert_tenant_integration_secret',
  'authenticated must be blocked from upsert_tenant_integration_secret execution'
);

-- 8) DLQ table exists and has unresolved index
select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'webhook_dead_letters'
      and indexname = 'idx_webhook_dlq_unresolved'
  ),
  'webhook_dead_letters unresolved index exists'
);

select * from finish();
rollback;
