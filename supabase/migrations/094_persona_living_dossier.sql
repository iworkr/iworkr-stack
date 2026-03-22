-- ============================================================================
-- @migration PersonaLivingDossier
-- @status COMPLETE
-- @description Project Persona — living dossier, RBAC governance, worker briefings, family triage
-- @tables participant_profiles (altered), dossier_sections, worker_briefing_acks
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1) Expand participant baseline
alter table public.participant_profiles
  add column if not exists cultural_background text,
  add column if not exists primary_language text default 'English',
  add column if not exists profile_summary text,
  add column if not exists mobility_level text
    check (mobility_level in ('independent', 'walking_aid', 'wheelchair_manual', 'wheelchair_power', 'bedbound')),
  add column if not exists transfer_requirement text
    check (transfer_requirement in ('independent', 'stand_by_assist', '1_person_assist', '2_person_hoist', 'slide_board')),
  add column if not exists dietary_requirements text[] default '{}';

-- 2) Medical alerts
create table if not exists public.participant_medical_alerts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  alert_type text not null check (alert_type in ('allergy', 'medical_condition', 'medication_warning', 'custom')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_participant_medical_alerts_participant
  on public.participant_medical_alerts (participant_id, is_active, severity);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_medical_alerts_updated_at') then
    create trigger set_participant_medical_alerts_updated_at
      before update on public.participant_medical_alerts
      for each row execute function public.update_updated_at();
  end if;
end $$;

-- 3) Personality + communication preferences
create table if not exists public.participant_preferences (
  participant_id uuid primary key references public.participant_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  hobbies text[] not null default '{}',
  morning_routine text,
  evening_routine text,
  communication_primary_method text,
  communication_receptive_notes text,
  communication_expressive_notes text,
  routines_and_comfort text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_preferences_updated_at') then
    create trigger set_participant_preferences_updated_at
      before update on public.participant_preferences
      for each row execute function public.update_updated_at();
  end if;
end $$;

-- 4) Behaviors + de-escalation matrix
create table if not exists public.participant_behaviors (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  behavior_name text not null,
  known_triggers text[] not null default '{}',
  early_warning_signs text[] not null default '{}',
  de_escalation_steps text[] not null default '{}',
  requires_restrictive_practice boolean not null default false,
  bsp_document_url text,
  is_active boolean not null default true,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_participant_behaviors_participant
  on public.participant_behaviors (participant_id, is_active, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_behaviors_updated_at') then
    create trigger set_participant_behaviors_updated_at
      before update on public.participant_behaviors
      for each row execute function public.update_updated_at();
  end if;
end $$;

-- 5) NDIS goals
create table if not exists public.participant_goals (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  ndis_goal_category text not null,
  goal_statement text not null,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'achieved', 'abandoned')),
  timeframe text check (timeframe in ('short_term', 'medium_term', 'long_term')),
  action_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_participant_goals_participant
  on public.participant_goals (participant_id, status, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_goals_updated_at') then
    create trigger set_participant_goals_updated_at
      before update on public.participant_goals
      for each row execute function public.update_updated_at();
  end if;
end $$;

-- 6) Briefing acknowledgments
create table if not exists public.worker_profile_acknowledgments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (shift_id, worker_id)
);

create index if not exists idx_worker_profile_acknowledgments_participant
  on public.worker_profile_acknowledgments (participant_id, acknowledged_at desc);

-- 7) Family update request queue
create table if not exists public.participant_profile_update_requests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null check (section in ('identity', 'preferences', 'clinical', 'behaviors', 'goals', 'other')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'merged')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_participant_profile_update_requests_org
  on public.participant_profile_update_requests (organization_id, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_profile_update_requests_updated_at') then
    create trigger set_participant_profile_update_requests_updated_at
      before update on public.participant_profile_update_requests
      for each row execute function public.update_updated_at();
  end if;
end $$;

-- 8) Access helper for support-worker scoped read windows
create or replace function public.can_worker_view_participant(
  p_org_id uuid,
  p_participant_id uuid
)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  -- Managers and above can view all participants in org.
  if public.user_has_role(p_org_id, 'manager') then
    return true;
  end if;

  -- Family-linked users can view their linked participants.
  if exists (
    select 1
    from public.participant_network_members pnm
    where pnm.participant_id = p_participant_id
      and pnm.user_id = v_uid
  ) then
    return true;
  end if;

  -- Support workers can only view participants they are rostered around now.
  return exists (
    select 1
    from public.schedule_blocks sb
    where sb.organization_id = p_org_id
      and sb.participant_id = p_participant_id
      and sb.technician_id = v_uid
      and sb.start_time >= now() - interval '7 days'
      and sb.start_time <= now() + interval '14 days'
  );
end;
$$;

-- 9) Dossier hydration RPC
create or replace function public.fetch_participant_dossier(
  p_participant_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile public.participant_profiles%rowtype;
  v_allowed boolean;
  v_payload jsonb;
begin
  select *
  into v_profile
  from public.participant_profiles
  where id = p_participant_id;

  if v_profile.id is null then
    raise exception 'Participant not found';
  end if;

  v_allowed := public.can_worker_view_participant(v_profile.organization_id, v_profile.id);
  if not v_allowed then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'participant', to_jsonb(v_profile),
    'medical_alerts', coalesce((
      select jsonb_agg(to_jsonb(a) order by
        case a.severity
          when 'critical' then 1
          when 'high' then 2
          when 'medium' then 3
          else 4
        end,
        a.updated_at desc
      )
      from public.participant_medical_alerts a
      where a.participant_id = v_profile.id
        and a.is_active = true
    ), '[]'::jsonb),
    'preferences', coalesce((
      select to_jsonb(p)
      from public.participant_preferences p
      where p.participant_id = v_profile.id
    ), '{}'::jsonb),
    'behaviors', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.updated_at desc)
      from public.participant_behaviors b
      where b.participant_id = v_profile.id
        and b.is_active = true
    ), '[]'::jsonb),
    'goals', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.updated_at desc)
      from public.participant_goals g
      where g.participant_id = v_profile.id
        and g.status <> 'abandoned'
    ), '[]'::jsonb),
    'critical_alert_count', (
      select count(*)
      from public.participant_medical_alerts a
      where a.participant_id = v_profile.id
        and a.is_active = true
        and a.severity = 'critical'
    ),
    'hydrated_at', now()
  )
  into v_payload;

  return v_payload;
end;
$$;

-- 10) Enable RLS
alter table public.participant_medical_alerts enable row level security;
alter table public.participant_preferences enable row level security;
alter table public.participant_behaviors enable row level security;
alter table public.participant_goals enable row level security;
alter table public.worker_profile_acknowledgments enable row level security;
alter table public.participant_profile_update_requests enable row level security;

-- Tighten participant profile visibility to scoped access
drop policy if exists "Org members can view participant profiles" on public.participant_profiles;
create policy "Scoped users can view participant profiles"
  on public.participant_profiles
  for select
  using (public.can_worker_view_participant(organization_id, id));

-- New table RLS: scoped read + manager write
create policy "Scoped users can view participant medical alerts"
  on public.participant_medical_alerts
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

create policy "Managers can manage participant medical alerts"
  on public.participant_medical_alerts
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Scoped users can view participant preferences"
  on public.participant_preferences
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

create policy "Managers can manage participant preferences"
  on public.participant_preferences
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Scoped users can view participant behaviors"
  on public.participant_behaviors
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

create policy "Managers can manage participant behaviors"
  on public.participant_behaviors
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Scoped users can view participant goals"
  on public.participant_goals
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

create policy "Managers can manage participant goals"
  on public.participant_goals
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Workers can insert own acknowledgments"
  on public.worker_profile_acknowledgments
  for insert
  with check (
    worker_id = auth.uid()
    and public.can_worker_view_participant(organization_id, participant_id)
  );

create policy "Scoped users can view acknowledgments"
  on public.worker_profile_acknowledgments
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

create policy "Family can submit own profile update requests"
  on public.participant_profile_update_requests
  for insert
  with check (
    requested_by_user_id = auth.uid()
    and exists (
      select 1
      from public.participant_network_members pnm
      where pnm.participant_id = participant_profile_update_requests.participant_id
        and pnm.user_id = auth.uid()
    )
  );

create policy "Managers can view/manage profile update requests"
  on public.participant_profile_update_requests
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Families can view own profile update requests"
  on public.participant_profile_update_requests
  for select
  using (requested_by_user_id = auth.uid());

-- 11) Grants for RPC
grant execute on function public.fetch_participant_dossier(uuid) to authenticated, service_role;
grant execute on function public.can_worker_view_participant(uuid, uuid) to authenticated, service_role;

