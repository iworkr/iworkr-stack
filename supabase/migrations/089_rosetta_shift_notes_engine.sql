-- ============================================================================
-- @migration RosettaShiftNotesEngine
-- @status COMPLETE
-- @description Project Rosetta — dynamic shift note templates and compliance forms
-- @tables shift_note_templates, shift_note_submissions
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1) Template definitions (versioned, immutable)
create table if not exists public.shift_note_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  version integer not null default 1,
  schema_payload jsonb not null,
  is_active boolean not null default true,
  supersedes_template_id uuid references public.shift_note_templates(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name, version)
);

create index if not exists idx_shift_note_templates_org on public.shift_note_templates (organization_id, created_at desc);
create index if not exists idx_shift_note_templates_org_active on public.shift_note_templates (organization_id, is_active) where is_active = true;

-- 2) Assignment rules
create table if not exists public.template_assignment_rules (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.shift_note_templates(id) on delete cascade,
  target_type text not null check (target_type in ('ndis_line_item', 'participant', 'duration', 'global_default')),
  target_value text,
  min_duration_minutes integer,
  max_duration_minutes integer,
  merge_strategy text not null default 'override' check (merge_strategy in ('override', 'merge')),
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint duration_rule_has_bounds check (
    target_type <> 'duration' or min_duration_minutes is not null or max_duration_minutes is not null
  )
);

create index if not exists idx_template_rules_org on public.template_assignment_rules (organization_id, is_active, priority desc, created_at desc);
create index if not exists idx_template_rules_target on public.template_assignment_rules (organization_id, target_type, target_value) where is_active = true;

-- 3) Shift submissions (single source of truth for EVV + dynamic payload)
create table if not exists public.shift_note_submissions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null unique references public.schedule_blocks(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  participant_id uuid references public.participant_profiles(id) on delete set null,
  template_id uuid references public.shift_note_templates(id) on delete set null,
  template_version integer not null default 1,
  submission_data jsonb not null default '{}'::jsonb,
  family_visible_data jsonb not null default '{}'::jsonb,
  worker_signature_token text,
  participant_signature_url text,
  participant_signature_base64 text,
  participant_signature_exemption_reason text check (
    participant_signature_exemption_reason in ('asleep', 'physical_incapacity', 'refusal_agitation')
  ),
  participant_signature_exemption_notes text,
  participant_signed_at timestamptz,
  worker_declared boolean not null default false,
  evv_clock_out_location jsonb,
  flags jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'review_required', 'reviewed', 'archived', 'missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_note_submissions_org on public.shift_note_submissions (organization_id, created_at desc);
create index if not exists idx_shift_note_submissions_worker on public.shift_note_submissions (worker_id, created_at desc);
create index if not exists idx_shift_note_submissions_participant on public.shift_note_submissions (participant_id, created_at desc);
create index if not exists idx_shift_note_submissions_status on public.shift_note_submissions (organization_id, status, created_at desc);

-- 4) Link required template to shifts (schedule_blocks in this codebase)
alter table public.schedule_blocks
  add column if not exists required_shift_note_template_id uuid references public.shift_note_templates(id) on delete set null;

alter table public.schedule_blocks
  add column if not exists required_shift_note_template_version integer;

-- 5) Updated_at trigger
drop trigger if exists set_shift_note_templates_updated_at on public.shift_note_templates;
create trigger set_shift_note_templates_updated_at
  before update on public.shift_note_templates
  for each row execute function public.update_updated_at();

drop trigger if exists set_shift_note_submissions_updated_at on public.shift_note_submissions;
create trigger set_shift_note_submissions_updated_at
  before update on public.shift_note_submissions
  for each row execute function public.update_updated_at();

-- 6) Rule resolution function (hierarchy: participant > ndis_line_item > duration > global_default)
create or replace function public.resolve_shift_note_template(
  p_organization_id uuid,
  p_participant_id uuid,
  p_ndis_line_item text,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns table (
  template_id uuid,
  template_version integer,
  resolved_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration_mins integer;
begin
  v_duration_mins := greatest(0, floor(extract(epoch from (coalesce(p_end_time, p_start_time) - p_start_time)) / 60)::integer);

  return query
    with candidate_rules as (
      select
        r.template_id,
        t.version as template_version,
        case
          when r.target_type = 'participant' then 4000 + r.priority
          when r.target_type = 'ndis_line_item' then 3000 + r.priority
          when r.target_type = 'duration' then 2000 + r.priority
          else 1000 + r.priority
        end as rank_score,
        r.target_type
      from public.template_assignment_rules r
      join public.shift_note_templates t on t.id = r.template_id
      where r.organization_id = p_organization_id
        and r.is_active = true
        and t.is_active = true
        and (
          (r.target_type = 'participant' and p_participant_id is not null and r.target_value = p_participant_id::text) or
          (r.target_type = 'ndis_line_item' and p_ndis_line_item is not null and r.target_value = p_ndis_line_item) or
          (r.target_type = 'duration' and
            (r.min_duration_minutes is null or v_duration_mins >= r.min_duration_minutes) and
            (r.max_duration_minutes is null or v_duration_mins <= r.max_duration_minutes)
          ) or
          (r.target_type = 'global_default')
        )
    )
    select
      c.template_id,
      c.template_version,
      c.target_type::text as resolved_by
    from candidate_rules c
    order by c.rank_score desc
    limit 1;
end;
$$;

-- 7) Trigger: preemptive required template resolution on schedule block write
create or replace function public.assign_required_shift_note_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ndis_line_item text;
  v_template_id uuid;
  v_template_version integer;
begin
  v_ndis_line_item := coalesce((new.metadata ->> 'ndis_line_item'), null);

  select r.template_id, r.template_version
  into v_template_id, v_template_version
  from public.resolve_shift_note_template(
    new.organization_id,
    new.participant_id,
    v_ndis_line_item,
    new.start_time,
    new.end_time
  ) r
  limit 1;

  new.required_shift_note_template_id := v_template_id;
  new.required_shift_note_template_version := v_template_version;
  return new;
end;
$$;

drop trigger if exists trg_assign_required_shift_note_template on public.schedule_blocks;
create trigger trg_assign_required_shift_note_template
  before insert or update of organization_id, participant_id, start_time, end_time, metadata
  on public.schedule_blocks
  for each row
  execute function public.assign_required_shift_note_template();

-- 8) RLS
alter table public.shift_note_templates enable row level security;
alter table public.template_assignment_rules enable row level security;
alter table public.shift_note_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'shift_note_templates' and policyname = 'Org members can view shift note templates'
  ) then
    create policy "Org members can view shift note templates"
      on public.shift_note_templates
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = shift_note_templates.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'shift_note_templates' and policyname = 'Managers can manage shift note templates'
  ) then
    create policy "Managers can manage shift note templates"
      on public.shift_note_templates
      for all
      using (public.user_has_role(organization_id, 'manager'))
      with check (public.user_has_role(organization_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'template_assignment_rules' and policyname = 'Org members can view assignment rules'
  ) then
    create policy "Org members can view assignment rules"
      on public.template_assignment_rules
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = template_assignment_rules.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'template_assignment_rules' and policyname = 'Managers can manage assignment rules'
  ) then
    create policy "Managers can manage assignment rules"
      on public.template_assignment_rules
      for all
      using (public.user_has_role(organization_id, 'manager'))
      with check (public.user_has_role(organization_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'shift_note_submissions' and policyname = 'Org members can view shift note submissions'
  ) then
    create policy "Org members can view shift note submissions"
      on public.shift_note_submissions
      for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = shift_note_submissions.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'shift_note_submissions' and policyname = 'Workers can create own shift note submissions'
  ) then
    create policy "Workers can create own shift note submissions"
      on public.shift_note_submissions
      for insert
      with check (
        worker_id = auth.uid()
        and exists (
          select 1
          from public.organization_members m
          where m.organization_id = shift_note_submissions.organization_id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'shift_note_submissions' and policyname = 'Workers can update own shift note submissions'
  ) then
    create policy "Workers can update own shift note submissions"
      on public.shift_note_submissions
      for update
      using (
        worker_id = auth.uid()
        and status in ('submitted', 'review_required')
      )
      with check (
        worker_id = auth.uid()
      );
  end if;
end $$;

-- 9) Realtime
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shift_note_submissions'
  ) then
    alter publication supabase_realtime add table public.shift_note_submissions;
  end if;
end $$;

comment on table public.shift_note_templates is 'Project Rosetta: versioned dynamic shift note templates.';
comment on table public.template_assignment_rules is 'Project Rosetta: assignment matrix for mapping templates to shifts.';
comment on table public.shift_note_submissions is 'Project Rosetta: worker submissions with EVV, signatures, and family-safe projection.';
