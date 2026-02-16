-- ============================================================
-- Migration 024: Finance Module Enhancements
-- get_finance_overview RPC, create_invoice_full RPC,
-- overdue watchdog, realtime for invoices
-- ============================================================

-- ── 1. RPC: Finance Overview (dashboard aggregations) ───
create or replace function public.get_finance_overview(
  p_org_id uuid,
  p_month_start date default null,
  p_month_end date default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_month_start date;
  v_month_end date;
  v_revenue_mtd numeric;
  v_revenue_prev numeric;
  v_revenue_growth numeric;
  v_overdue_amount numeric;
  v_overdue_count int;
  v_avg_payout_days numeric;
  v_unpaid_balance numeric;
  v_total_paid_all_time numeric;
  v_invoices_sent int;
  v_invoices_paid int;
begin
  v_month_start := coalesce(p_month_start, date_trunc('month', current_date)::date);
  v_month_end := coalesce(p_month_end, (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date);

  -- Revenue MTD: sum of paid invoices this month
  select coalesce(sum(total), 0)
  into v_revenue_mtd
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= v_month_start
    and paid_date <= v_month_end
    and deleted_at is null;

  -- Revenue previous month for growth %
  select coalesce(sum(total), 0)
  into v_revenue_prev
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= (v_month_start - interval '1 month')::date
    and paid_date < v_month_start
    and deleted_at is null;

  -- Growth percentage
  if v_revenue_prev > 0 then
    v_revenue_growth := round(((v_revenue_mtd - v_revenue_prev) / v_revenue_prev) * 100);
  elsif v_revenue_mtd > 0 then
    v_revenue_growth := 100;
  else
    v_revenue_growth := 0;
  end if;

  -- Overdue: sum and count of overdue invoices
  select coalesce(sum(total), 0), count(*)
  into v_overdue_amount, v_overdue_count
  from public.invoices
  where organization_id = p_org_id
    and status = 'overdue'
    and deleted_at is null;

  -- Also include sent invoices past due date
  select v_overdue_amount + coalesce(sum(total), 0),
         v_overdue_count + count(*)
  into v_overdue_amount, v_overdue_count
  from public.invoices
  where organization_id = p_org_id
    and status = 'sent'
    and due_date < current_date
    and deleted_at is null;

  -- Average payout days (time from paid_date to payout arrival)
  select coalesce(avg(p.payout_date - i.paid_date), 2.4)
  into v_avg_payout_days
  from public.payouts p
  cross join lateral unnest(p.invoice_ids) as inv_id
  join public.invoices i on i.id = inv_id
  where p.organization_id = p_org_id
    and p.status = 'completed'
    and i.paid_date is not null;

  -- Unpaid balance: paid invoices not yet in a completed payout
  select coalesce(sum(total), 0)
  into v_unpaid_balance
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null
    and id not in (
      select unnest(invoice_ids)
      from public.payouts
      where organization_id = p_org_id
        and status = 'completed'
    );

  -- Total paid all time
  select coalesce(sum(total), 0)
  into v_total_paid_all_time
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null;

  -- Counts
  select count(*) into v_invoices_sent
  from public.invoices
  where organization_id = p_org_id
    and status = 'sent'
    and deleted_at is null;

  select count(*) into v_invoices_paid
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null;

  return json_build_object(
    'revenue_mtd', v_revenue_mtd,
    'revenue_growth', v_revenue_growth,
    'overdue_amount', v_overdue_amount,
    'overdue_count', v_overdue_count,
    'avg_payout_days', round(v_avg_payout_days::numeric, 1),
    'stripe_balance', v_unpaid_balance,
    'total_paid_all_time', v_total_paid_all_time,
    'invoices_sent', v_invoices_sent,
    'invoices_paid', v_invoices_paid
  );
end;
$$;

-- ── 2. RPC: Create invoice with line items (transactional) ─
create or replace function public.create_invoice_full(
  p_org_id uuid,
  p_client_id uuid default null,
  p_client_name text default null,
  p_client_email text default null,
  p_client_address text default null,
  p_status text default 'draft',
  p_issue_date date default current_date,
  p_due_date date default null,
  p_tax_rate numeric default 10,
  p_notes text default null,
  p_payment_link text default null,
  p_items json default '[]',
  p_created_by uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_invoice_id uuid;
  v_display_id text;
  v_next_num int;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item json;
  v_sort int := 0;
  v_due date;
begin
  -- Generate display_id
  select coalesce(
    (select max(
      case when display_id ~ '^INV-\d+$'
        then substring(display_id from 5)::int
        else 0
      end
    ) from public.invoices where organization_id = p_org_id),
    1250
  ) + 1
  into v_next_num;

  v_display_id := 'INV-' || lpad(v_next_num::text, 4, '0');

  -- Calculate totals from items
  for v_item in select * from json_array_elements(p_items)
  loop
    v_subtotal := v_subtotal + (
      coalesce((v_item->>'quantity')::numeric, 1) *
      coalesce((v_item->>'unit_price')::numeric, 0)
    );
  end loop;

  v_tax := round(v_subtotal * (p_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;

  -- Default due date = issue + 7 days
  v_due := coalesce(p_due_date, p_issue_date + interval '7 days');

  -- Insert invoice
  insert into public.invoices (
    organization_id, display_id, client_id,
    client_name, client_email, client_address,
    status, issue_date, due_date,
    subtotal, tax_rate, tax, total,
    payment_link, notes, created_by
  ) values (
    p_org_id, v_display_id, p_client_id,
    p_client_name, p_client_email, p_client_address,
    p_status::public.invoice_status, p_issue_date, v_due,
    v_subtotal, p_tax_rate, v_tax, v_total,
    p_payment_link, p_notes, p_created_by
  )
  returning id into v_invoice_id;

  -- Insert line items
  for v_item in select * from json_array_elements(p_items)
  loop
    insert into public.invoice_line_items (
      invoice_id, description, quantity, unit_price, sort_order
    ) values (
      v_invoice_id,
      coalesce(v_item->>'description', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  -- Create "created" event
  insert into public.invoice_events (invoice_id, type, text)
  values (v_invoice_id, 'created', 'Invoice ' || v_display_id || ' was created');

  -- If status is 'sent', also create a "sent" event
  if p_status = 'sent' then
    insert into public.invoice_events (invoice_id, type, text)
    values (v_invoice_id, 'sent', 'Invoice ' || v_display_id || ' was sent to ' || coalesce(p_client_email, 'client'));
  end if;

  return json_build_object(
    'invoice_id', v_invoice_id,
    'display_id', v_display_id,
    'total', v_total
  );
end;
$$;

-- ── 3. Overdue Watchdog: Auto-mark sent invoices as overdue ─
create or replace function public.mark_overdue_invoices(p_org_id uuid default null)
returns json
language plpgsql
security definer
as $$
declare
  v_count int;
  v_ids uuid[];
begin
  -- Update sent invoices past due date to overdue
  with updated as (
    update public.invoices
    set status = 'overdue',
        updated_at = now()
    where status = 'sent'
      and due_date < current_date
      and deleted_at is null
      and (p_org_id is null or organization_id = p_org_id)
    returning id, display_id, organization_id, client_name, total
  )
  select count(*), array_agg(id)
  into v_count, v_ids
  from updated;

  -- Create events for each newly overdue invoice
  if v_count > 0 then
    insert into public.invoice_events (invoice_id, type, text)
    select id, 'reminder', 'Invoice ' || display_id || ' is now overdue'
    from public.invoices
    where id = any(v_ids);
  end if;

  return json_build_object(
    'marked_overdue', v_count,
    'invoice_ids', coalesce(v_ids, '{}')
  );
end;
$$;

-- ── 4. RPC: Get full invoice detail (single query) ─────
create or replace function public.get_invoice_detail(p_invoice_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select row_to_json(t)
  into v_result
  from (
    select
      i.*,
      (
        select coalesce(json_agg(row_to_json(li) order by li.sort_order), '[]'::json)
        from public.invoice_line_items li
        where li.invoice_id = i.id
      ) as line_items,
      (
        select coalesce(json_agg(row_to_json(ev) order by ev.created_at desc), '[]'::json)
        from public.invoice_events ev
        where ev.invoice_id = i.id
      ) as events,
      (
        select row_to_json(c)
        from public.clients c
        where c.id = i.client_id
      ) as client_details
    from public.invoices i
    where i.id = p_invoice_id
      and i.deleted_at is null
  ) t;

  return v_result;
end;
$$;

-- ── 5. Enable Realtime for invoices ─────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
end $$;
