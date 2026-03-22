-- ============================================================================
-- @migration ArchitectSILQuotingEngine
-- @status COMPLETE
-- @description Project Architect — SIL quoting, roster of care, cost modeling
-- @tables sil_quotes, sil_quote_shifts, sil_quote_residents
-- @lastAudit 2026-03-22
-- ============================================================================

create table if not exists public.sil_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  facility_id uuid not null references public.care_facilities(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'archived')),
  source_mode text not null default 'blank' check (source_mode in ('master_roster', 'blank')),
  default_ndis_line_item text,
  base_week_start date not null,
  total_annual_cost numeric(12,2) not null default 0,
  projected_gross_margin_percent numeric(5,2) not null default 0,
  margin_worker_hourly_cost numeric(10,2) not null default 42.00,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sil_quote_participants (
  quote_id uuid not null references public.sil_quotes(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  annual_funding_cap numeric(12,2),
  primary key (quote_id, participant_id)
);

create table if not exists public.sil_quote_blocks (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sil_quotes(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  active_workers integer not null default 0 check (active_workers >= 0),
  active_participants integer not null default 0 check (active_participants >= 0),
  ndis_line_item_code text,
  is_sleepover boolean not null default false,
  is_active_night boolean not null default false,
  created_at timestamptz not null default now(),
  unique (quote_id, day_of_week, start_time)
);

create table if not exists public.sil_quote_block_participants (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.sil_quote_blocks(id) on delete cascade,
  quote_id uuid not null references public.sil_quotes(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  is_present boolean not null default true,
  share_override numeric(10,4),
  notes text,
  created_at timestamptz not null default now(),
  unique (block_id, participant_id)
);

create table if not exists public.sil_quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sil_quotes(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  ndis_line_item_code text not null,
  total_hours_per_week numeric(8,2) not null,
  hourly_rate numeric(10,2) not null,
  weekly_cost numeric(12,2) not null,
  annual_cost numeric(12,2) not null,
  is_irregular_support boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sil_quote_irregular_supports (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sil_quotes(id) on delete cascade,
  participant_id uuid references public.participant_profiles(id) on delete set null,
  description text not null,
  annual_cost numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sil_quotes_org on public.sil_quotes(organization_id, created_at desc);
create index if not exists idx_sil_quotes_facility on public.sil_quotes(facility_id, created_at desc);
create index if not exists idx_sil_quote_blocks_quote on public.sil_quote_blocks(quote_id, day_of_week, start_time);
create index if not exists idx_sil_quote_block_participants_quote on public.sil_quote_block_participants(quote_id, participant_id);
create index if not exists idx_sil_quote_line_items_quote on public.sil_quote_line_items(quote_id, participant_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_sil_quotes_updated_at') then
    create trigger set_sil_quotes_updated_at
      before update on public.sil_quotes
      for each row execute function public.update_updated_at();
  end if;
end $$;

create or replace function public.sil_time_band(p_start_time time, p_is_sleepover boolean, p_is_active_night boolean)
returns text
language plpgsql
immutable
as $$
begin
  if p_is_sleepover then
    return 'sleepover';
  end if;
  if p_is_active_night then
    return 'night_active';
  end if;
  if p_start_time >= time '06:00' and p_start_time < time '20:00' then
    return 'daytime';
  end if;
  if p_start_time >= time '20:00' and p_start_time < time '24:00' then
    return 'evening';
  end if;
  return 'night_active';
end;
$$;

create or replace function public.get_ndis_rate(p_line_item text)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select nc.base_rate_national
      from public.ndis_catalogue nc
      where nc.support_item_number = p_line_item
      order by nc.effective_from desc
      limit 1
    ),
    65.47
  )::numeric;
$$;

create or replace function public.initialize_sil_quote_blocks(p_quote_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day integer;
  v_slot integer;
  v_start time;
  v_end time;
  v_count integer := 0;
begin
  if not exists (select 1 from public.sil_quotes q where q.id = p_quote_id) then
    raise exception 'Quote not found';
  end if;

  delete from public.sil_quote_blocks where quote_id = p_quote_id;

  for v_day in 1..7 loop
    for v_slot in 0..47 loop
      v_start := (time '00:00' + (v_slot * interval '30 minutes'))::time;
      v_end := (v_start + interval '30 minutes')::time;
      insert into public.sil_quote_blocks (
        quote_id, day_of_week, start_time, end_time, active_workers, active_participants
      ) values (
        p_quote_id, v_day, v_start, v_end, 0, 0
      );
      v_count := v_count + 1;
    end loop;
  end loop;

  insert into public.sil_quote_block_participants (block_id, quote_id, participant_id, is_present)
  select b.id, b.quote_id, sqp.participant_id, true
  from public.sil_quote_blocks b
  join public.sil_quote_participants sqp on sqp.quote_id = b.quote_id
  where b.quote_id = p_quote_id;

  return v_count;
end;
$$;

create or replace function public.recalculate_sil_quote_blocks(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_cost numeric := 42.00;
  v_revenue numeric := 0;
  v_payroll numeric := 0;
begin
  select coalesce(margin_worker_hourly_cost, 42.00)
  into v_worker_cost
  from public.sil_quotes
  where id = p_quote_id
  for update;

  update public.sil_quote_blocks b
  set active_participants = coalesce(x.present_count, 0)
  from (
    select bp.block_id, count(*) filter (where bp.is_present) as present_count
    from public.sil_quote_block_participants bp
    where bp.quote_id = p_quote_id
    group by bp.block_id
  ) x
  where b.id = x.block_id
    and b.quote_id = p_quote_id;

  delete from public.sil_quote_line_items
  where quote_id = p_quote_id
    and is_irregular_support = false;

  insert into public.sil_quote_line_items (
    quote_id,
    participant_id,
    ndis_line_item_code,
    total_hours_per_week,
    hourly_rate,
    weekly_cost,
    annual_cost,
    is_irregular_support
  )
  select
    b.quote_id,
    bp.participant_id,
    coalesce(
      b.ndis_line_item_code,
      q.default_ndis_line_item,
      case public.sil_time_band(b.start_time, b.is_sleepover, b.is_active_night)
        when 'sleepover' then '01_903_0107_1_1'
        when 'night_active' then '01_020_0107_1_1'
        when 'evening' then '01_019_0107_1_1'
        else '01_013_0107_1_1'
      end
    ) as line_item_code,
    count(*) * 0.5 as total_hours_per_week,
    coalesce(public.get_ndis_rate(coalesce(b.ndis_line_item_code, q.default_ndis_line_item, '01_013_0107_1_1')), 65.47) as hourly_rate,
    round(sum(
      case
        when b.active_participants <= 0 then 0
        when b.active_workers <= 0 then 0
        else
          coalesce(bp.share_override, (b.active_workers::numeric / nullif(b.active_participants, 0)))
          * coalesce(public.get_ndis_rate(coalesce(b.ndis_line_item_code, q.default_ndis_line_item, '01_013_0107_1_1')), 65.47)
          * 0.5
      end
    ), 2) as weekly_cost,
    round(sum(
      case
        when b.active_participants <= 0 then 0
        when b.active_workers <= 0 then 0
        else
          coalesce(bp.share_override, (b.active_workers::numeric / nullif(b.active_participants, 0)))
          * coalesce(public.get_ndis_rate(coalesce(b.ndis_line_item_code, q.default_ndis_line_item, '01_013_0107_1_1')), 65.47)
          * 0.5
          * 52.14
      end
    ), 2) as annual_cost,
    false
  from public.sil_quote_blocks b
  join public.sil_quote_block_participants bp on bp.block_id = b.id
  join public.sil_quotes q on q.id = b.quote_id
  where b.quote_id = p_quote_id
    and bp.is_present = true
  group by b.quote_id, bp.participant_id, line_item_code, q.default_ndis_line_item, b.ndis_line_item_code;

  select coalesce(sum(li.annual_cost), 0)
  into v_revenue
  from public.sil_quote_line_items li
  where li.quote_id = p_quote_id;

  select coalesce(sum(
    case
      when b.active_workers <= 0 then 0
      else (b.active_workers::numeric * v_worker_cost * 0.5 * 52.14)
    end
  ), 0)
  into v_payroll
  from public.sil_quote_blocks b
  where b.quote_id = p_quote_id;

  update public.sil_quotes q
  set
    total_annual_cost = round(v_revenue, 2),
    projected_gross_margin_percent = case
      when v_revenue <= 0 then 0
      else round(((v_revenue - v_payroll) / v_revenue) * 100, 2)
    end
  where q.id = p_quote_id;
end;
$$;

alter table public.sil_quotes enable row level security;
alter table public.sil_quote_participants enable row level security;
alter table public.sil_quote_blocks enable row level security;
alter table public.sil_quote_block_participants enable row level security;
alter table public.sil_quote_line_items enable row level security;
alter table public.sil_quote_irregular_supports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quotes' and policyname = 'Org members can view sil quotes') then
    create policy "Org members can view sil quotes"
      on public.sil_quotes for select
      using (organization_id in (
        select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quotes' and policyname = 'Admins can manage sil quotes') then
    create policy "Admins can manage sil quotes"
      on public.sil_quotes for all
      using ((select role from public.organization_members where organization_id = sil_quotes.organization_id and user_id = auth.uid() and status = 'active') in ('owner','admin','manager','office_admin'))
      with check ((select role from public.organization_members where organization_id = sil_quotes.organization_id and user_id = auth.uid() and status = 'active') in ('owner','admin','manager','office_admin'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_participants' and policyname = 'Org members can view sil quote participants') then
    create policy "Org members can view sil quote participants"
      on public.sil_quote_participants for select
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_participants' and policyname = 'Admins can manage sil quote participants') then
    create policy "Admins can manage sil quote participants"
      on public.sil_quote_participants for all
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))))
      with check (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_blocks' and policyname = 'Org members can view sil quote blocks') then
    create policy "Org members can view sil quote blocks"
      on public.sil_quote_blocks for select
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_blocks' and policyname = 'Admins can manage sil quote blocks') then
    create policy "Admins can manage sil quote blocks"
      on public.sil_quote_blocks for all
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))))
      with check (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_block_participants' and policyname = 'Org members can view sil quote block participants') then
    create policy "Org members can view sil quote block participants"
      on public.sil_quote_block_participants for select
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_block_participants' and policyname = 'Admins can manage sil quote block participants') then
    create policy "Admins can manage sil quote block participants"
      on public.sil_quote_block_participants for all
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))))
      with check (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_line_items' and policyname = 'Org members can view sil quote line items') then
    create policy "Org members can view sil quote line items"
      on public.sil_quote_line_items for select
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_line_items' and policyname = 'Admins can manage sil quote line items') then
    create policy "Admins can manage sil quote line items"
      on public.sil_quote_line_items for all
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))))
      with check (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_irregular_supports' and policyname = 'Org members can view sil quote irregular supports') then
    create policy "Org members can view sil quote irregular supports"
      on public.sil_quote_irregular_supports for select
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active')));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'sil_quote_irregular_supports' and policyname = 'Admins can manage sil quote irregular supports') then
    create policy "Admins can manage sil quote irregular supports"
      on public.sil_quote_irregular_supports for all
      using (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))))
      with check (quote_id in (select id from public.sil_quotes where organization_id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active' and role in ('owner','admin','manager','office_admin'))));
  end if;
end $$;

grant execute on function public.initialize_sil_quote_blocks(uuid) to authenticated, service_role;
grant execute on function public.recalculate_sil_quote_blocks(uuid) to authenticated, service_role;
grant execute on function public.get_ndis_rate(text) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.sil_quotes;
    alter publication supabase_realtime add table public.sil_quote_blocks;
    alter publication supabase_realtime add table public.sil_quote_line_items;
  exception when others then null;
  end;
end $$;

