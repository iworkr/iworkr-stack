-- ============================================================
-- Migration 023: Clients Module Enhancements
-- get_clients_with_stats RPC, create_client_full RPC,
-- VIP auto-tag trigger, last_active_at trigger, billing_terms
-- ============================================================

-- ── 1. Add billing_terms and last_active_at to clients ──
alter table public.clients
  add column if not exists billing_terms text default 'due_on_receipt';

alter table public.clients
  add column if not exists last_active_at timestamptz;

-- ── 2. RPC: Get clients with aggregated stats ──────────
create or replace function public.get_clients_with_stats(
  p_org_id uuid,
  p_search text default null,
  p_status text default null,
  p_type text default null,
  p_sort_by text default 'name',
  p_sort_asc boolean default true,
  p_limit int default 200,
  p_offset int default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      c.*,
      coalesce(js.job_count, 0) as job_count,
      coalesce(is2.lifetime_value, 0) as total_spend,
      js.last_job_date,
      (
        select json_agg(row_to_json(cc) order by cc.is_primary desc, cc.created_at)
        from public.client_contacts cc
        where cc.client_id = c.id
      ) as contacts
    from public.clients c
    left join lateral (
      select
        count(*)::int as job_count,
        max(j.created_at) as last_job_date
      from public.jobs j
      where j.client_id = c.id
        and j.deleted_at is null
    ) js on true
    left join lateral (
      select coalesce(sum(i.total), 0)::numeric as lifetime_value
      from public.invoices i
      where i.client_id = c.id
        and i.status = 'paid'
    ) is2 on true
    where c.organization_id = p_org_id
      and c.deleted_at is null
      and (p_search is null
        or c.name ilike '%' || p_search || '%'
        or c.email ilike '%' || p_search || '%'
        or exists (
          select 1 from unnest(c.tags) tag where tag ilike '%' || p_search || '%'
        )
      )
      and (p_status is null or c.status = p_status::public.client_status)
      and (p_type is null or c.type = p_type::public.client_type)
    order by
      case when p_sort_by = 'name' and p_sort_asc then c.name end asc,
      case when p_sort_by = 'name' and not p_sort_asc then c.name end desc,
      case when p_sort_by = 'ltv' and p_sort_asc then coalesce(is2.lifetime_value, 0) end asc,
      case when p_sort_by = 'ltv' and not p_sort_asc then coalesce(is2.lifetime_value, 0) end desc,
      case when p_sort_by = 'jobs' and p_sort_asc then coalesce(js.job_count, 0) end asc,
      case when p_sort_by = 'jobs' and not p_sort_asc then coalesce(js.job_count, 0) end desc,
      case when p_sort_by = 'last_active' and p_sort_asc then c.last_active_at end asc nulls last,
      case when p_sort_by = 'last_active' and not p_sort_asc then c.last_active_at end desc nulls last,
      c.created_at desc
    limit p_limit
    offset p_offset
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 3. RPC: Create client with contact (transactional) ──
create or replace function public.create_client_full(
  p_org_id uuid,
  p_name text,
  p_type text default 'residential',
  p_status text default 'active',
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_address_lat double precision default null,
  p_address_lng double precision default null,
  p_tags text[] default '{}',
  p_notes text default null,
  p_billing_terms text default 'due_on_receipt',
  p_contact_name text default null,
  p_contact_role text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_client_id uuid;
  v_contact_id uuid;
begin
  -- Insert client
  insert into public.clients (
    organization_id, name, type, status, email, phone,
    address, address_lat, address_lng, tags, notes,
    billing_terms, since
  ) values (
    p_org_id, p_name,
    p_type::public.client_type,
    p_status::public.client_status,
    p_email, p_phone,
    p_address, p_address_lat, p_address_lng,
    p_tags, p_notes,
    p_billing_terms, now()
  )
  returning id into v_client_id;

  -- Insert primary contact if provided
  if p_contact_name is not null and p_contact_name != '' then
    insert into public.client_contacts (
      client_id, name, role, email, phone, is_primary
    ) values (
      v_client_id, p_contact_name,
      coalesce(p_contact_role, 'Primary Contact'),
      coalesce(p_contact_email, p_email),
      coalesce(p_contact_phone, p_phone),
      true
    )
    returning id into v_contact_id;
  end if;

  return json_build_object(
    'client_id', v_client_id,
    'contact_id', v_contact_id
  );
end;
$$;

-- ── 4. RPC: Get single client with full details ─────────
create or replace function public.get_client_details(p_client_id uuid)
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
      c.*,
      coalesce(js.job_count, 0) as job_count,
      coalesce(is2.lifetime_value, 0) as total_spend,
      js.last_job_date,
      (
        select coalesce(json_agg(row_to_json(cc) order by cc.is_primary desc, cc.created_at), '[]'::json)
        from public.client_contacts cc
        where cc.client_id = c.id
      ) as contacts,
      (
        select coalesce(json_agg(row_to_json(a) order by a.created_at desc), '[]'::json)
        from (
          select ja.*
          from public.job_activity ja
          join public.jobs j on j.id = ja.job_id
          where j.client_id = c.id
            and j.deleted_at is null
          order by ja.created_at desc
          limit 20
        ) a
      ) as recent_activity,
      (
        select coalesce(json_agg(row_to_json(inv) order by inv.created_at desc), '[]'::json)
        from (
          select i.id, i.status, i.total, i.created_at, i.due_date
          from public.invoices i
          where i.client_id = c.id
          order by i.created_at desc
          limit 50
        ) inv
      ) as spend_history
    from public.clients c
    left join lateral (
      select count(*)::int as job_count, max(j.created_at) as last_job_date
      from public.jobs j
      where j.client_id = c.id and j.deleted_at is null
    ) js on true
    left join lateral (
      select coalesce(sum(i.total), 0)::numeric as lifetime_value
      from public.invoices i
      where i.client_id = c.id and i.status = 'paid'
    ) is2 on true
    where c.id = p_client_id
      and c.deleted_at is null
  ) t;

  return v_result;
end;
$$;

-- ── 5. Trigger: Auto-tag VIP when LTV > $10,000 ────────
create or replace function public.auto_tag_vip_client()
returns trigger as $$
declare
  v_lifetime_value numeric;
  v_current_tags text[];
begin
  -- Calculate LTV for the client of the paid invoice
  select coalesce(sum(total), 0)
  into v_lifetime_value
  from public.invoices
  where client_id = NEW.client_id
    and status = 'paid';

  -- If LTV > $10,000 and VIP tag not already present
  if v_lifetime_value >= 10000 then
    select tags into v_current_tags
    from public.clients
    where id = NEW.client_id;

    if not ('VIP' = any(coalesce(v_current_tags, '{}'))) then
      update public.clients
      set tags = array_append(coalesce(tags, '{}'), 'VIP'),
          updated_at = now()
      where id = NEW.client_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_invoice_paid_vip_check on public.invoices;
create trigger on_invoice_paid_vip_check
  after insert or update on public.invoices
  for each row
  when (NEW.status = 'paid')
  execute function public.auto_tag_vip_client();

-- ── 6. Trigger: Update last_active_at on job completion ─
create or replace function public.update_client_last_active()
returns trigger as $$
begin
  if NEW.status = 'done' and NEW.client_id is not null then
    update public.clients
    set last_active_at = now(),
        updated_at = now()
    where id = NEW.client_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_done_update_client on public.jobs;
create trigger on_job_done_update_client
  after update on public.jobs
  for each row
  when (NEW.status = 'done' and (OLD.status is distinct from NEW.status))
  execute function public.update_client_last_active();
