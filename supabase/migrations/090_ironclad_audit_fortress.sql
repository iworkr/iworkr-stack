-- ============================================================================
-- Migration 090: Project Ironclad — Global Audit & Compliance Fortress
-- ============================================================================

-- 1) Immutable, partitioned system audit ledger
create table if not exists public.system_audit_logs (
  id uuid not null default gen_random_uuid(),
  table_name text not null,
  record_id text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by_user_id uuid references public.profiles(id) on delete set null,
  ip_address text,
  created_at timestamptz not null default statement_timestamp(),
  primary key (id, created_at)
) partition by range (created_at);

create index if not exists idx_system_audit_logs_lookup
  on public.system_audit_logs (table_name, record_id, created_at desc);
create index if not exists idx_system_audit_logs_org
  on public.system_audit_logs (organization_id, created_at desc);
create index if not exists idx_system_audit_logs_actor
  on public.system_audit_logs (changed_by_user_id, created_at desc);

-- Create monthly partition helper to prevent table bloat on active partition.
create or replace function public.ensure_system_audit_partition(p_month_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_partition_name text;
begin
  v_from := date_trunc('month', p_month_start)::timestamptz;
  v_to := (date_trunc('month', p_month_start) + interval '1 month')::timestamptz;
  v_partition_name := format('system_audit_logs_%s', to_char(v_from, 'YYYY_MM'));

  execute format(
    'create table if not exists public.%I partition of public.system_audit_logs for values from (%L) to (%L)',
    v_partition_name,
    v_from,
    v_to
  );
end;
$$;

select public.ensure_system_audit_partition(current_date);
select public.ensure_system_audit_partition((current_date + interval '1 month')::date);

-- 2) Auditor data room tables
create table if not exists public.auditor_portals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  auditor_email text not null,
  passcode_hash text not null,
  expires_at timestamptz not null,
  is_revoked boolean not null default false,
  scope_date_start date not null,
  scope_date_end date not null,
  allowed_participant_ids uuid[] not null default '{}',
  allowed_staff_ids uuid[] not null default '{}',
  title text,
  access_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  constraint auditor_portal_scope_dates_valid check (scope_date_end >= scope_date_start)
);

create index if not exists idx_auditor_portals_org on public.auditor_portals (organization_id, created_at desc);
create index if not exists idx_auditor_portals_token on public.auditor_portals (access_token);
create index if not exists idx_auditor_portals_active
  on public.auditor_portals (organization_id, expires_at)
  where is_revoked = false;

create table if not exists public.auditor_access_logs (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.auditor_portals(id) on delete cascade,
  action text not null,
  target_record_id text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_auditor_access_logs_portal on public.auditor_access_logs (portal_id, created_at desc);
create index if not exists idx_auditor_access_logs_action on public.auditor_access_logs (action, created_at desc);

create table if not exists public.document_hashes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  generated_by uuid references public.profiles(id) on delete set null,
  document_type text not null,
  sha256_hash text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_hashes_org on public.document_hashes (organization_id, created_at desc);
create index if not exists idx_document_hashes_type on public.document_hashes (document_type, created_at desc);

-- 3) Trigger function for immutable row-change capture
create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_data jsonb;
  v_new_data jsonb;
  v_user_id uuid;
  v_record_id text;
  v_org_id uuid;
  v_headers jsonb;
  v_ip text;
begin
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
    v_ip := coalesce(
      v_headers ->> 'x-forwarded-for',
      v_headers ->> 'x-real-ip',
      null
    );
  exception when others then
    v_ip := null;
  end;

  if (tg_op = 'UPDATE') then
    v_old_data := to_jsonb(old);
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(v_new_data ->> 'id', v_old_data ->> 'id', 'unknown');
    begin
      v_org_id := coalesce((v_new_data ->> 'organization_id')::uuid, (v_old_data ->> 'organization_id')::uuid);
    exception when others then
      v_org_id := null;
    end;

    insert into public.system_audit_logs (
      table_name, record_id, organization_id, action, old_data, new_data, changed_by_user_id, ip_address
    )
    values (
      tg_table_name::text, v_record_id, v_org_id, tg_op, v_old_data, v_new_data, v_user_id, v_ip
    );
    return new;
  elsif (tg_op = 'DELETE') then
    v_old_data := to_jsonb(old);
    v_record_id := coalesce(v_old_data ->> 'id', 'unknown');
    begin
      v_org_id := (v_old_data ->> 'organization_id')::uuid;
    exception when others then
      v_org_id := null;
    end;

    insert into public.system_audit_logs (
      table_name, record_id, organization_id, action, old_data, changed_by_user_id, ip_address
    )
    values (
      tg_table_name::text, v_record_id, v_org_id, tg_op, v_old_data, v_user_id, v_ip
    );
    return old;
  elsif (tg_op = 'INSERT') then
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(v_new_data ->> 'id', 'unknown');
    begin
      v_org_id := (v_new_data ->> 'organization_id')::uuid;
    exception when others then
      v_org_id := null;
    end;

    insert into public.system_audit_logs (
      table_name, record_id, organization_id, action, new_data, changed_by_user_id, ip_address
    )
    values (
      tg_table_name::text, v_record_id, v_org_id, tg_op, v_new_data, v_user_id, v_ip
    );
    return new;
  end if;

  return null;
end;
$$;

-- 4) Attach trigger to critical tables if present
do $$
declare
  v_tbl text;
  v_tables text[] := array[
    'schedule_blocks',
    'progress_notes',
    'participant_profiles',
    'staff_profiles',
    'incidents',
    'timesheets'
  ];
begin
  foreach v_tbl in array v_tables loop
    if exists (
      select 1
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_name = v_tbl
    ) then
      execute format('drop trigger if exists ironclad_audit_%I on public.%I', v_tbl, v_tbl);
      execute format(
        'create trigger ironclad_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_trigger_func()',
        v_tbl,
        v_tbl
      );
    end if;
  end loop;
end $$;

-- 5) Access logging helper for vault views/downloads/breach attempts
create or replace function public.log_auditor_access(
  p_portal_id uuid,
  p_action text,
  p_target_record_id text,
  p_ip_address text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditor_access_logs (
    portal_id, action, target_record_id, ip_address, user_agent
  ) values (
    p_portal_id, p_action, p_target_record_id, p_ip_address, p_user_agent
  );
end;
$$;

-- 6) RLS hardening
alter table public.system_audit_logs enable row level security;
alter table public.auditor_portals enable row level security;
alter table public.auditor_access_logs enable row level security;
alter table public.document_hashes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'system_audit_logs' and policyname = 'Admins can view system audit logs'
  ) then
    create policy "Admins can view system audit logs"
      on public.system_audit_logs
      for select
      using (
        public.user_has_role(system_audit_logs.organization_id, 'admin')
        or auth.role() = 'service_role'
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'auditor_portals' and policyname = 'Admins can view auditor portals'
  ) then
    create policy "Admins can view auditor portals"
      on public.auditor_portals
      for select
      using (public.user_has_role(organization_id, 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'auditor_portals' and policyname = 'Admins can create auditor portals'
  ) then
    create policy "Admins can create auditor portals"
      on public.auditor_portals
      for insert
      with check (public.user_has_role(organization_id, 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'auditor_portals' and policyname = 'Admins can update auditor portals'
  ) then
    create policy "Admins can update auditor portals"
      on public.auditor_portals
      for update
      using (public.user_has_role(organization_id, 'admin'))
      with check (public.user_has_role(organization_id, 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'auditor_access_logs' and policyname = 'Admins can view auditor access logs'
  ) then
    create policy "Admins can view auditor access logs"
      on public.auditor_access_logs
      for select
      using (
        exists (
          select 1
          from public.auditor_portals p
          where p.id = auditor_access_logs.portal_id
            and public.user_has_role(p.organization_id, 'admin')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'document_hashes' and policyname = 'Org members can view document hashes'
  ) then
    create policy "Org members can view document hashes"
      on public.document_hashes
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = document_hashes.organization_id
            and m.user_id = auth.uid()
        )
        or auth.role() = 'service_role'
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'document_hashes' and policyname = 'Admins can create document hashes'
  ) then
    create policy "Admins can create document hashes"
      on public.document_hashes
      for insert
      with check (public.user_has_role(organization_id, 'admin') or auth.role() = 'service_role');
  end if;
end $$;

comment on table public.system_audit_logs is 'Project Ironclad: immutable DB-trigger audit ledger, partitioned monthly.';
comment on table public.auditor_portals is 'Project Ironclad: secure time-bound external auditor data rooms.';
comment on table public.auditor_access_logs is 'Project Ironclad: immutable portal access/activity trail.';
comment on table public.document_hashes is 'Project Ironclad: SHA-256 seals for exported compliance artifacts.';
