-- ============================================================================
-- @migration FortKnoxParticipantWallets
-- @status COMPLETE
-- @description Project Fort Knox — participant wallets, petty cash ledger, reconciliation
-- @tables participant_wallets, wallet_transactions, wallet_reconciliations
-- @lastAudit 2026-03-22
-- ============================================================================

create table if not exists public.participant_wallets (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid references public.participant_profiles(id) on delete cascade,
  facility_id uuid references public.care_facilities(id) on delete cascade,
  name text not null,
  wallet_type text not null check (wallet_type in ('cash', 'debit_card')),
  card_last_four text check (card_last_four is null or char_length(card_last_four) = 4),
  requires_financial_delegation boolean not null default false,
  current_balance numeric(10,2) not null default 0.00,
  is_active boolean not null default true,
  initialized_by uuid references public.profiles(id) on delete set null,
  initialized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((participant_id is not null) or (facility_id is not null))
);

create table if not exists public.wallet_financial_delegations (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references public.participant_wallets(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  delegated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(wallet_id, worker_id)
);

create table if not exists public.wallet_shift_sessions (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references public.participant_wallets(id) on delete cascade,
  shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  opening_counted_balance numeric(10,2),
  expected_opening_balance numeric(10,2),
  opening_balance_evidence_url text,
  opened_at timestamptz,
  is_opening_reconciled boolean,
  closing_counted_balance numeric(10,2),
  expected_closing_balance numeric(10,2),
  closed_at timestamptz,
  is_closing_reconciled boolean,
  closing_incident_id uuid references public.incidents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(wallet_id, shift_id, worker_id)
);

create table if not exists public.wallet_discrepancies (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wallet_id uuid not null references public.participant_wallets(id) on delete cascade,
  shift_id uuid references public.schedule_blocks(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,
  discrepancy_phase text not null check (discrepancy_phase in ('opening', 'closing', 'handover')),
  expected_balance numeric(10,2) not null,
  counted_balance numeric(10,2) not null,
  variance_amount numeric(10,2) not null,
  note text,
  linked_incident_id uuid references public.incidents(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved', 'written_off')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wallet_id uuid not null references public.participant_wallets(id) on delete cascade,
  shift_id uuid references public.schedule_blocks(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,
  entry_type text not null check (entry_type in ('opening_balance', 'expense', 'injection', 'closing_balance', 'discrepancy_writeoff')),
  amount numeric(10,2) not null,
  running_balance numeric(10,2) not null,
  category text,
  description text,
  no_receipt_justification text,
  receipt_image_url text,
  linked_incident_id uuid references public.incidents(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_participant_wallets_org on public.participant_wallets(organization_id, is_active);
create index if not exists idx_participant_wallets_participant on public.participant_wallets(participant_id) where participant_id is not null;
create index if not exists idx_wallet_ledger_wallet_created on public.wallet_ledger_entries(wallet_id, created_at desc);
create index if not exists idx_wallet_discrepancies_status on public.wallet_discrepancies(organization_id, status, created_at desc);
create index if not exists idx_wallet_shift_sessions_shift on public.wallet_shift_sessions(shift_id, worker_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_participant_wallets_updated_at') then
    create trigger set_participant_wallets_updated_at
      before update on public.participant_wallets
      for each row execute function public.update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_wallet_shift_sessions_updated_at') then
    create trigger set_wallet_shift_sessions_updated_at
      before update on public.wallet_shift_sessions
      for each row execute function public.update_updated_at();
  end if;
end $$;

create or replace function public.can_access_wallet(p_wallet_id uuid, p_user_id uuid default auth.uid(), p_for_write boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.participant_wallets%rowtype;
  v_org_role text;
  v_allowed boolean := false;
begin
  select * into v_wallet from public.participant_wallets where id = p_wallet_id and is_active = true;
  if v_wallet.id is null then
    return false;
  end if;

  select role into v_org_role
  from public.organization_members
  where organization_id = v_wallet.organization_id
    and user_id = p_user_id
    and status = 'active'
  limit 1;

  if v_org_role is null then
    -- Family portal linked participant read-only access.
    if (not p_for_write) and v_wallet.participant_id is not null then
      return exists(
        select 1
        from public.participant_network_members pnm
        where pnm.participant_id = v_wallet.participant_id
          and pnm.user_id = p_user_id
      );
    end if;
    return false;
  end if;

  if v_org_role in ('owner', 'admin', 'manager', 'office_admin') then
    return true;
  end if;

  -- Worker access must be roster-scoped.
  if v_wallet.participant_id is not null then
    v_allowed := exists(
      select 1
      from public.schedule_blocks sb
      where sb.organization_id = v_wallet.organization_id
        and sb.technician_id = p_user_id
        and sb.participant_id = v_wallet.participant_id
        and sb.start_time::date between (current_date - interval '7 days') and (current_date + interval '14 days')
        and sb.status != 'cancelled'
    );
  elsif v_wallet.facility_id is not null then
    v_allowed := exists(
      select 1
      from public.schedule_blocks sb
      where sb.organization_id = v_wallet.organization_id
        and sb.technician_id = p_user_id
        and sb.facility_id = v_wallet.facility_id
        and sb.start_time::date between (current_date - interval '7 days') and (current_date + interval '14 days')
        and sb.status != 'cancelled'
    );
  end if;

  if not v_allowed then
    return false;
  end if;

  if v_wallet.requires_financial_delegation then
    return exists(
      select 1 from public.wallet_financial_delegations d
      where d.wallet_id = v_wallet.id and d.worker_id = p_user_id
    );
  end if;

  return true;
end;
$$;

create or replace function public.initialize_wallet(
  p_wallet_id uuid,
  p_initial_balance numeric,
  p_description text default 'Initial wallet funding'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.participant_wallets%rowtype;
begin
  if not public.can_access_wallet(p_wallet_id, auth.uid(), true) then
    raise exception 'Access denied';
  end if;

  select * into v_wallet from public.participant_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  update public.participant_wallets
  set current_balance = round(coalesce(p_initial_balance, 0)::numeric, 2),
      initialized_by = auth.uid(),
      initialized_at = now()
  where id = p_wallet_id;

  insert into public.wallet_ledger_entries(
    organization_id, wallet_id, worker_id, entry_type, amount, running_balance, category, description
  ) values (
    v_wallet.organization_id, p_wallet_id, auth.uid(), 'injection',
    round(coalesce(p_initial_balance, 0)::numeric, 2),
    round(coalesce(p_initial_balance, 0)::numeric, 2),
    'initialization',
    coalesce(p_description, 'Initial wallet funding')
  );

  return jsonb_build_object('wallet_id', p_wallet_id, 'current_balance', round(coalesce(p_initial_balance, 0)::numeric, 2));
end;
$$;

create or replace function public.open_wallet_session_blind_count(
  p_wallet_id uuid,
  p_shift_id uuid,
  p_counted_balance numeric,
  p_evidence_url text default null,
  p_worker_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.participant_wallets%rowtype;
  v_expected numeric(10,2);
  v_counted numeric(10,2);
  v_variance numeric(10,2);
  v_reconciled boolean;
begin
  if not public.can_access_wallet(p_wallet_id, p_worker_id, true) then
    raise exception 'Access denied';
  end if;

  select * into v_wallet from public.participant_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  v_expected := round(coalesce(v_wallet.current_balance, 0)::numeric, 2);
  v_counted := round(coalesce(p_counted_balance, 0)::numeric, 2);
  v_variance := round(v_counted - v_expected, 2);
  v_reconciled := (v_counted = v_expected);

  insert into public.wallet_shift_sessions(
    wallet_id, shift_id, worker_id, opening_counted_balance, expected_opening_balance,
    opening_balance_evidence_url, opened_at, is_opening_reconciled
  ) values (
    p_wallet_id, p_shift_id, p_worker_id, v_counted, v_expected, p_evidence_url, now(), v_reconciled
  )
  on conflict (wallet_id, shift_id, worker_id) do update
    set opening_counted_balance = excluded.opening_counted_balance,
        expected_opening_balance = excluded.expected_opening_balance,
        opening_balance_evidence_url = excluded.opening_balance_evidence_url,
        opened_at = excluded.opened_at,
        is_opening_reconciled = excluded.is_opening_reconciled,
        updated_at = now();

  insert into public.wallet_ledger_entries(
    organization_id, wallet_id, shift_id, worker_id, entry_type, amount, running_balance, category, description, receipt_image_url
  ) values (
    v_wallet.organization_id, p_wallet_id, p_shift_id, p_worker_id, 'opening_balance',
    v_counted, v_counted, 'opening_check', 'Opening blind-count verification', p_evidence_url
  );

  if not v_reconciled then
    insert into public.wallet_discrepancies(
      organization_id, wallet_id, shift_id, worker_id, discrepancy_phase, expected_balance, counted_balance, variance_amount,
      note, status
    ) values (
      v_wallet.organization_id, p_wallet_id, p_shift_id, p_worker_id, 'opening',
      v_expected, v_counted, v_variance, 'Opening balance mismatch', 'open'
    );
  end if;

  return jsonb_build_object(
    'wallet_id', p_wallet_id,
    'expected_balance', v_expected,
    'counted_balance', v_counted,
    'variance_amount', v_variance,
    'is_reconciled', v_reconciled
  );
end;
$$;

create or replace function public.log_wallet_transaction(
  p_wallet_id uuid,
  p_shift_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_category text default null,
  p_description text default null,
  p_receipt_image_url text default null,
  p_no_receipt_justification text default null,
  p_linked_incident_id uuid default null,
  p_worker_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.participant_wallets%rowtype;
  v_prev numeric(10,2);
  v_amount numeric(10,2);
  v_next numeric(10,2);
  v_entry_type text;
begin
  if not public.can_access_wallet(p_wallet_id, p_worker_id, true) then
    raise exception 'Access denied';
  end if;

  if p_entry_type not in ('expense', 'injection', 'discrepancy_writeoff') then
    raise exception 'Unsupported entry type';
  end if;

  select * into v_wallet from public.participant_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  v_entry_type := p_entry_type;
  v_prev := round(coalesce(v_wallet.current_balance, 0)::numeric, 2);
  v_amount := round(coalesce(p_amount, 0)::numeric, 2);
  v_next := round(v_prev + v_amount, 2);

  if v_entry_type = 'expense' and v_amount > 0 then
    v_amount := -v_amount;
    v_next := round(v_prev + v_amount, 2);
  end if;

  if v_next < 0 then
    raise exception 'Insufficient wallet balance';
  end if;

  insert into public.wallet_ledger_entries(
    organization_id, wallet_id, shift_id, worker_id, entry_type, amount, running_balance,
    category, description, receipt_image_url, no_receipt_justification, linked_incident_id
  ) values (
    v_wallet.organization_id, p_wallet_id, p_shift_id, p_worker_id, v_entry_type, v_amount, v_next,
    p_category, p_description, p_receipt_image_url, p_no_receipt_justification, p_linked_incident_id
  );

  update public.participant_wallets
  set current_balance = v_next
  where id = p_wallet_id;

  return jsonb_build_object(
    'wallet_id', p_wallet_id,
    'previous_balance', v_prev,
    'amount', v_amount,
    'running_balance', v_next
  );
end;
$$;

create or replace function public.close_wallet_session_blind_count(
  p_wallet_id uuid,
  p_shift_id uuid,
  p_counted_balance numeric,
  p_incident_id uuid default null,
  p_force_with_incident boolean default false,
  p_worker_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.participant_wallets%rowtype;
  v_expected numeric(10,2);
  v_counted numeric(10,2);
  v_variance numeric(10,2);
  v_reconciled boolean;
begin
  if not public.can_access_wallet(p_wallet_id, p_worker_id, true) then
    raise exception 'Access denied';
  end if;

  select * into v_wallet from public.participant_wallets where id = p_wallet_id for update;
  if v_wallet.id is null then
    raise exception 'Wallet not found';
  end if;

  v_expected := round(coalesce(v_wallet.current_balance, 0)::numeric, 2);
  v_counted := round(coalesce(p_counted_balance, 0)::numeric, 2);
  v_variance := round(v_counted - v_expected, 2);
  v_reconciled := (v_counted = v_expected);

  if (not v_reconciled) and (not p_force_with_incident) then
    return jsonb_build_object(
      'requires_incident', true,
      'expected_balance', v_expected,
      'counted_balance', v_counted,
      'variance_amount', v_variance
    );
  end if;

  if (not v_reconciled) and p_incident_id is null then
    raise exception 'Discrepancy close requires linked incident';
  end if;

  insert into public.wallet_ledger_entries(
    organization_id, wallet_id, shift_id, worker_id, entry_type, amount, running_balance,
    category, description, linked_incident_id
  ) values (
    v_wallet.organization_id, p_wallet_id, p_shift_id, p_worker_id, 'closing_balance',
    v_counted, v_counted, 'closing_check', 'Closing blind-count verification', p_incident_id
  );

  update public.participant_wallets
  set current_balance = v_counted
  where id = p_wallet_id;

  update public.wallet_shift_sessions
  set closing_counted_balance = v_counted,
      expected_closing_balance = v_expected,
      closed_at = now(),
      is_closing_reconciled = v_reconciled,
      closing_incident_id = p_incident_id
  where wallet_id = p_wallet_id and shift_id = p_shift_id and worker_id = p_worker_id;

  if not v_reconciled then
    insert into public.wallet_discrepancies(
      organization_id, wallet_id, shift_id, worker_id, discrepancy_phase, expected_balance, counted_balance, variance_amount,
      note, linked_incident_id, status
    ) values (
      v_wallet.organization_id, p_wallet_id, p_shift_id, p_worker_id, 'closing',
      v_expected, v_counted, v_variance, 'Closing balance mismatch', p_incident_id, 'written_off'
    );
  end if;

  return jsonb_build_object(
    'requires_incident', false,
    'wallet_id', p_wallet_id,
    'expected_balance', v_expected,
    'counted_balance', v_counted,
    'variance_amount', v_variance,
    'is_reconciled', v_reconciled
  );
end;
$$;

create or replace function public.get_shift_wallet_gate(
  p_shift_id uuid,
  p_worker_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_count integer := 0;
begin
  select count(*) into v_open_count
  from public.wallet_shift_sessions s
  where s.shift_id = p_shift_id
    and s.worker_id = p_worker_id
    and s.opened_at is not null
    and s.closed_at is null;

  return jsonb_build_object(
    'can_clock_out', v_open_count = 0,
    'open_wallet_sessions', v_open_count
  );
end;
$$;

alter table public.participant_wallets enable row level security;
alter table public.wallet_financial_delegations enable row level security;
alter table public.wallet_shift_sessions enable row level security;
alter table public.wallet_discrepancies enable row level security;
alter table public.wallet_ledger_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'participant_wallets' and policyname = 'Authorized users can view wallets') then
    create policy "Authorized users can view wallets"
      on public.participant_wallets for select
      using (public.can_access_wallet(id, auth.uid(), false));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'participant_wallets' and policyname = 'Authorized users can manage wallets') then
    create policy "Authorized users can manage wallets"
      on public.participant_wallets for all
      using (public.can_access_wallet(id, auth.uid(), true))
      with check (public.can_access_wallet(id, auth.uid(), true));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'wallet_financial_delegations' and policyname = 'Org members view delegations') then
    create policy "Org members view delegations"
      on public.wallet_financial_delegations for select
      using (exists(
        select 1 from public.participant_wallets w
        where w.id = wallet_id and public.can_access_wallet(w.id, auth.uid(), false)
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_financial_delegations' and policyname = 'Admins manage delegations') then
    create policy "Admins manage delegations"
      on public.wallet_financial_delegations for all
      using (exists(
        select 1
        from public.participant_wallets w
        join public.organization_members m on m.organization_id = w.organization_id and m.user_id = auth.uid() and m.status = 'active'
        where w.id = wallet_id and m.role in ('owner', 'admin', 'manager', 'office_admin')
      ))
      with check (exists(
        select 1
        from public.participant_wallets w
        join public.organization_members m on m.organization_id = w.organization_id and m.user_id = auth.uid() and m.status = 'active'
        where w.id = wallet_id and m.role in ('owner', 'admin', 'manager', 'office_admin')
      ));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'wallet_shift_sessions' and policyname = 'Authorized users view wallet sessions') then
    create policy "Authorized users view wallet sessions"
      on public.wallet_shift_sessions for select
      using (public.can_access_wallet(wallet_id, auth.uid(), false));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_shift_sessions' and policyname = 'Authorized users insert wallet sessions') then
    create policy "Authorized users insert wallet sessions"
      on public.wallet_shift_sessions for insert
      with check (public.can_access_wallet(wallet_id, auth.uid(), true));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_shift_sessions' and policyname = 'Authorized users update wallet sessions') then
    create policy "Authorized users update wallet sessions"
      on public.wallet_shift_sessions for update
      using (public.can_access_wallet(wallet_id, auth.uid(), true))
      with check (public.can_access_wallet(wallet_id, auth.uid(), true));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'wallet_discrepancies' and policyname = 'Authorized users view discrepancies') then
    create policy "Authorized users view discrepancies"
      on public.wallet_discrepancies for select
      using (exists(
        select 1 from public.participant_wallets w
        where w.id = wallet_id and public.can_access_wallet(w.id, auth.uid(), false)
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_discrepancies' and policyname = 'Authorized users insert discrepancies') then
    create policy "Authorized users insert discrepancies"
      on public.wallet_discrepancies for insert
      with check (exists(
        select 1 from public.participant_wallets w
        where w.id = wallet_id and public.can_access_wallet(w.id, auth.uid(), true)
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_discrepancies' and policyname = 'Managers update discrepancies') then
    create policy "Managers update discrepancies"
      on public.wallet_discrepancies for update
      using (exists(
        select 1
        from public.participant_wallets w
        join public.organization_members m on m.organization_id = w.organization_id and m.user_id = auth.uid() and m.status = 'active'
        where w.id = wallet_id and m.role in ('owner', 'admin', 'manager', 'office_admin')
      ))
      with check (exists(
        select 1
        from public.participant_wallets w
        join public.organization_members m on m.organization_id = w.organization_id and m.user_id = auth.uid() and m.status = 'active'
        where w.id = wallet_id and m.role in ('owner', 'admin', 'manager', 'office_admin')
      ));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'wallet_ledger_entries' and policyname = 'Authorized users select wallet ledger') then
    create policy "Authorized users select wallet ledger"
      on public.wallet_ledger_entries for select
      using (exists(
        select 1 from public.participant_wallets w
        where w.id = wallet_id and public.can_access_wallet(w.id, auth.uid(), false)
      ));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_ledger_entries' and policyname = 'Insert only for wallet ledger') then
    create policy "Insert only for wallet ledger"
      on public.wallet_ledger_entries for insert
      with check (exists(
        select 1 from public.participant_wallets w
        where w.id = wallet_id and public.can_access_wallet(w.id, auth.uid(), true)
      ));
  end if;
end $$;

grant execute on function public.can_access_wallet(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.initialize_wallet(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.open_wallet_session_blind_count(uuid, uuid, numeric, text, uuid) to authenticated, service_role;
grant execute on function public.log_wallet_transaction(uuid, uuid, text, numeric, text, text, text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.close_wallet_session_blind_count(uuid, uuid, numeric, uuid, boolean, uuid) to authenticated, service_role;
grant execute on function public.get_shift_wallet_gate(uuid, uuid) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.participant_wallets;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.wallet_ledger_entries;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.wallet_discrepancies;
  exception when others then null;
  end;
end $$;

