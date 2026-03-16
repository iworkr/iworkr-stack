-- ============================================================================
-- Migration 100: Project Solon - Policy & Procedure Acknowledgement System
-- ============================================================================

alter table public.policy_register
  add column if not exists target_audience_rules jsonb not null default '{"audience":"all"}'::jsonb,
  add column if not exists enforcement_level integer not null default 2 check (enforcement_level in (1,2,3)),
  add column if not exists grace_period_days integer not null default 7,
  add column if not exists is_active boolean not null default true,
  add column if not exists current_version_id uuid;

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policy_register(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number text not null,
  document_url text,
  rich_text_content text,
  quiz_template_id uuid references public.shift_note_templates(id) on delete set null,
  quiz_payload jsonb not null default '[]'::jsonb,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (policy_id, version_number)
);

create index if not exists idx_policy_versions_policy on public.policy_versions(policy_id, published_at desc);
create index if not exists idx_policy_versions_org on public.policy_versions(organization_id, published_at desc);

alter table public.policy_register
  drop constraint if exists policy_register_current_version_fk;
alter table public.policy_register
  add constraint policy_register_current_version_fk
  foreign key (current_version_id) references public.policy_versions(id) on delete set null;

alter table public.policy_acknowledgements
  add column if not exists policy_version_id uuid references public.policy_versions(id) on delete cascade,
  add column if not exists status text not null default 'pending' check (status in ('pending', 'signed', 'expired')),
  add column if not exists due_at timestamptz,
  add column if not exists signature_image_url text,
  add column if not exists biometric_token text,
  add column if not exists ip_address text,
  add column if not exists device_info text,
  add column if not exists quiz_passed boolean not null default false,
  add column if not exists quiz_score numeric(5,2),
  add column if not exists countdown_suspended boolean not null default false,
  add column if not exists countdown_resume_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_policy_acknowledgements_updated_at') then
    create trigger set_policy_acknowledgements_updated_at
      before update on public.policy_acknowledgements
      for each row execute function public.update_updated_at();
  end if;
end $$;

create index if not exists idx_policy_ack_worker_status on public.policy_acknowledgements(user_id, status, due_at);
create index if not exists idx_policy_ack_version on public.policy_acknowledgements(policy_version_id, status);

create unique index if not exists idx_policy_ack_worker_version_unique
  on public.policy_acknowledgements(user_id, policy_version_id)
  where policy_version_id is not null;

alter table public.policy_versions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'policy_versions' and policyname = 'Org members manage policy versions') then
    create policy "Org members manage policy versions"
      on public.policy_versions
      for all
      using (
        exists (
          select 1
          from public.organization_members members
          where members.organization_id = policy_versions.organization_id
            and members.user_id = auth.uid()
            and members.status = 'active'
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members members
          where members.organization_id = policy_versions.organization_id
            and members.user_id = auth.uid()
            and members.status = 'active'
        )
      );
  end if;
end $$;

create or replace function public.pending_critical_policies_for_user(p_user_id uuid default auth.uid())
returns table (
  acknowledgement_id uuid,
  policy_id uuid,
  policy_version_id uuid,
  title text,
  version_number text,
  due_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    pa.id as acknowledgement_id,
    pa.policy_id,
    pa.policy_version_id,
    pr.title,
    coalesce(pv.version_number, pa.policy_version) as version_number,
    pa.due_at
  from public.policy_acknowledgements pa
  join public.policy_register pr on pr.id = pa.policy_id
  left join public.policy_versions pv on pv.id = pa.policy_version_id
  where pa.user_id = p_user_id
    and pa.status = 'pending'
    and pr.enforcement_level = 3
    and coalesce(pa.countdown_suspended, false) = false
    and (pa.due_at is null or pa.due_at <= now())
  order by pa.due_at nulls first, pr.updated_at desc;
$$;

grant execute on function public.pending_critical_policies_for_user(uuid) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'policy_acknowledgements' and policyname = 'Org members manage acknowledgements') then
    drop policy "Org members manage acknowledgements" on public.policy_acknowledgements;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'policy_acknowledgements' and policyname = 'Org members can view policy acknowledgements') then
    create policy "Org members can view policy acknowledgements"
      on public.policy_acknowledgements
      for select
      using (
        exists (
          select 1
          from public.organization_members members
          where members.organization_id = policy_acknowledgements.organization_id
            and members.user_id = auth.uid()
            and members.status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'policy_acknowledgements' and policyname = 'Workers can sign own acknowledgements') then
    create policy "Workers can sign own acknowledgements"
      on public.policy_acknowledgements
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'policy_acknowledgements' and policyname = 'Admins can manage policy acknowledgements') then
    create policy "Admins can manage policy acknowledgements"
      on public.policy_acknowledgements
      for all
      using (
        exists (
          select 1
          from public.organization_members members
          where members.organization_id = policy_acknowledgements.organization_id
            and members.user_id = auth.uid()
            and members.status = 'active'
            and members.role in ('owner','admin','manager','office_admin')
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members members
          where members.organization_id = policy_acknowledgements.organization_id
            and members.user_id = auth.uid()
            and members.status = 'active'
            and members.role in ('owner','admin','manager','office_admin')
        )
      );
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.policy_versions;
  exception when others then null;
  end;
end $$;

