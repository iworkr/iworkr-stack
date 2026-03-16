-- ============================================================================
-- Migration 103: Project Doppelganger — Shadow & Buddy Shift Logistics Engine
-- ============================================================================

alter table public.schedule_blocks
  add column if not exists parent_shift_id uuid references public.schedule_blocks(id) on delete cascade,
  add column if not exists is_shadow_shift boolean not null default false;

create index if not exists idx_schedule_blocks_parent_shift
  on public.schedule_blocks (parent_shift_id);
create index if not exists idx_schedule_blocks_shadow
  on public.schedule_blocks (organization_id, is_shadow_shift, start_time);

alter table public.shift_financial_ledgers
  add column if not exists is_billable_to_ndis boolean not null default true,
  add column if not exists payroll_gl_account text not null default 'COGS - Direct Support';

create table if not exists public.mentorship_evaluations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  shadow_shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  evaluator_worker_id uuid references public.profiles(id) on delete set null,
  trainee_worker_id uuid references public.profiles(id) on delete set null,
  participant_id uuid references public.participant_profiles(id) on delete set null,
  evaluation_data jsonb not null default '{}'::jsonb,
  recommendation_status text not null check (recommendation_status in ('pass', 'fail', 'needs_more_training')),
  created_at timestamptz not null default now(),
  unique (primary_shift_id, shadow_shift_id)
);

create index if not exists idx_mentorship_eval_org_created
  on public.mentorship_evaluations (organization_id, created_at desc);
create index if not exists idx_mentorship_eval_trainee
  on public.mentorship_evaluations (trainee_worker_id, participant_id);

create table if not exists public.shadow_shift_reflections (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shadow_shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete set null,
  participant_id uuid references public.participant_profiles(id) on delete set null,
  reflection_data jsonb not null default '{}'::jsonb,
  confidence_ready boolean,
  created_at timestamptz not null default now(),
  unique (shadow_shift_id, worker_id)
);

create table if not exists public.worker_participant_familiarity (
  worker_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  shadow_shifts_completed integer not null default 0,
  shadow_shifts_required integer not null default 3,
  is_cleared_for_independent boolean not null default false,
  cleared_at timestamptz,
  cleared_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (worker_id, participant_id)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_worker_participant_familiarity_updated_at') then
    create trigger set_worker_participant_familiarity_updated_at
      before update on public.worker_participant_familiarity
      for each row execute function public.update_updated_at();
  end if;
end $$;

create or replace function public.enforce_shadow_financials()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_shadow boolean := false;
begin
  select coalesce(is_shadow_shift, false)
  into v_is_shadow
  from public.schedule_blocks
  where id = new.schedule_block_id;

  if v_is_shadow then
    new.projected_revenue := 0.00;
    new.actual_revenue := 0.00;
    new.travel_revenue := 0.00;
    new.is_billable_to_ndis := false;
    new.payroll_gl_account := 'Expense - Staff Training & Onboarding';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_shadow_financials on public.shift_financial_ledgers;
create trigger trigger_shadow_financials
before insert or update on public.shift_financial_ledgers
for each row execute function public.enforce_shadow_financials();

create or replace function public.propagate_parent_shift_updates_to_shadow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.is_shadow_shift, false) = true then
    return new;
  end if;

  if (new.start_time is distinct from old.start_time)
     or (new.end_time is distinct from old.end_time)
     or (new.status is distinct from old.status)
     or (new.participant_id is distinct from old.participant_id)
     or (new.location is distinct from old.location) then
    update public.schedule_blocks
    set start_time = new.start_time,
        end_time = new.end_time,
        status = case when new.status = 'cancelled' then 'cancelled' else status end,
        participant_id = new.participant_id,
        location = new.location,
        updated_at = now()
    where parent_shift_id = new.id
      and is_shadow_shift = true;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_propagate_parent_shift_updates_to_shadow on public.schedule_blocks;
create trigger trigger_propagate_parent_shift_updates_to_shadow
after update on public.schedule_blocks
for each row execute function public.propagate_parent_shift_updates_to_shadow();

create or replace function public.refresh_worker_familiarity_from_evaluation(
  p_trainee_worker_id uuid,
  p_participant_id uuid,
  p_org_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed integer := 0;
  v_required integer := 3;
begin
  if p_trainee_worker_id is null or p_participant_id is null then
    return;
  end if;

  select count(*)
  into v_completed
  from public.mentorship_evaluations me
  where me.trainee_worker_id = p_trainee_worker_id
    and me.participant_id = p_participant_id
    and me.recommendation_status = 'pass';

  insert into public.worker_participant_familiarity (
    worker_id,
    organization_id,
    participant_id,
    shadow_shifts_completed,
    shadow_shifts_required,
    is_cleared_for_independent,
    cleared_at
  )
  values (
    p_trainee_worker_id,
    p_org_id,
    p_participant_id,
    v_completed,
    v_required,
    v_completed >= v_required,
    case when v_completed >= v_required then now() else null end
  )
  on conflict (worker_id, participant_id)
  do update set
    organization_id = excluded.organization_id,
    shadow_shifts_completed = excluded.shadow_shifts_completed,
    is_cleared_for_independent = excluded.is_cleared_for_independent,
    cleared_at = case
      when excluded.is_cleared_for_independent then coalesce(worker_participant_familiarity.cleared_at, now())
      else null
    end,
    updated_at = now();
end;
$$;

create or replace function public.trg_refresh_worker_familiarity_from_eval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_worker_familiarity_from_evaluation(
    new.trainee_worker_id,
    new.participant_id,
    new.organization_id
  );
  return new;
end;
$$;

drop trigger if exists trigger_refresh_worker_familiarity_from_eval on public.mentorship_evaluations;
create trigger trigger_refresh_worker_familiarity_from_eval
after insert or update on public.mentorship_evaluations
for each row execute function public.trg_refresh_worker_familiarity_from_eval();

alter table public.mentorship_evaluations enable row level security;
alter table public.shadow_shift_reflections enable row level security;
alter table public.worker_participant_familiarity enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'mentorship_evaluations' and policyname = 'Org members manage mentorship evaluations') then
    create policy "Org members manage mentorship evaluations"
      on public.mentorship_evaluations for all
      using (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
      with check (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shadow_shift_reflections' and policyname = 'Org members manage shadow reflections') then
    create policy "Org members manage shadow reflections"
      on public.shadow_shift_reflections for all
      using (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
      with check (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'worker_participant_familiarity' and policyname = 'Org members manage familiarity matrix') then
    create policy "Org members manage familiarity matrix"
      on public.worker_participant_familiarity for all
      using (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
      with check (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;
end $$;

grant execute on function public.refresh_worker_familiarity_from_evaluation(uuid, uuid, uuid) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.worker_participant_familiarity;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin
    alter publication supabase_realtime add table public.mentorship_evaluations;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
