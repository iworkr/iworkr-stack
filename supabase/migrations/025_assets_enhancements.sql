-- ============================================================
-- Migration 025: Assets & Inventory Module Enhancements
-- toggle_asset_custody RPC, consume_inventory RPC,
-- get_assets_overview RPC, low-stock trigger, service due
-- ============================================================

-- ── 1. Add columns for PRD compatibility ────────────────
alter table public.assets
  add column if not exists service_interval_days int default 180;

alter table public.assets
  add column if not exists image_url text;

alter table public.inventory_items
  add column if not exists max_quantity int default 100;

alter table public.inventory_items
  add column if not exists bin_location text;

-- ── 2. RPC: Toggle asset custody (check-in / check-out) ─
create or replace function public.toggle_asset_custody(
  p_asset_id uuid,
  p_target_user_id uuid default null,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_asset record;
  v_action text;
  v_new_status text;
  v_user_name text;
begin
  -- Get current asset
  select * into v_asset
  from public.assets
  where id = p_asset_id and deleted_at is null;

  if not found then
    return json_build_object('error', 'Asset not found');
  end if;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles
  where id = coalesce(p_actor_id, p_target_user_id);

  if p_target_user_id is null then
    -- Check-in: clear assignment
    v_action := 'check_in';
    v_new_status := 'available';

    update public.assets
    set assigned_to = null,
        status = 'available',
        updated_at = now()
    where id = p_asset_id;
  else
    -- Check-out: assign to target
    v_action := 'check_out';
    v_new_status := 'assigned';

    update public.assets
    set assigned_to = p_target_user_id,
        status = 'assigned',
        updated_at = now()
    where id = p_asset_id;
  end if;

  -- Create audit log entry
  insert into public.asset_audits (
    organization_id, asset_id, inventory_id,
    action, notes, user_id, user_name, metadata
  ) values (
    v_asset.organization_id, p_asset_id, null,
    v_action,
    coalesce(p_notes, v_action || ' ' || v_asset.name || ' by ' || coalesce(v_user_name, 'unknown')),
    coalesce(p_actor_id, p_target_user_id),
    v_user_name,
    json_build_object(
      'previous_status', v_asset.status,
      'new_status', v_new_status,
      'previous_assignee', v_asset.assigned_to,
      'new_assignee', p_target_user_id
    )::jsonb
  );

  return json_build_object(
    'success', true,
    'action', v_action,
    'asset_id', p_asset_id,
    'new_status', v_new_status
  );
end;
$$;

-- ── 3. RPC: Consume inventory on a job ──────────────────
create or replace function public.consume_inventory(
  p_inventory_id uuid,
  p_quantity int,
  p_job_id uuid default null,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_item record;
  v_new_qty int;
  v_new_level text;
  v_user_name text;
  v_job_display text;
begin
  -- Get current item
  select * into v_item
  from public.inventory_items
  where id = p_inventory_id;

  if not found then
    return json_build_object('error', 'Inventory item not found');
  end if;

  -- Calculate new quantity
  v_new_qty := greatest(0, v_item.quantity - p_quantity);

  -- Calculate new stock level
  if v_new_qty <= 0 then
    v_new_level := 'critical';
  elsif v_new_qty <= v_item.min_quantity then
    v_new_level := 'low';
  else
    v_new_level := 'ok';
  end if;

  -- Update inventory
  update public.inventory_items
  set quantity = v_new_qty,
      stock_level = v_new_level::public.stock_level,
      updated_at = now()
  where id = p_inventory_id;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles
  where id = p_actor_id;

  -- Get job display_id if applicable
  if p_job_id is not null then
    select display_id into v_job_display
    from public.jobs
    where id = p_job_id;
  end if;

  -- Create audit log entry
  insert into public.asset_audits (
    organization_id, asset_id, inventory_id,
    action, notes, user_id, user_name, metadata
  ) values (
    v_item.organization_id, null, p_inventory_id,
    'consumed',
    coalesce(p_notes,
      'Used ' || p_quantity || 'x ' || v_item.name ||
      case when v_job_display is not null then ' on ' || v_job_display else '' end
    ),
    p_actor_id, v_user_name,
    json_build_object(
      'quantity_consumed', p_quantity,
      'previous_qty', v_item.quantity,
      'new_qty', v_new_qty,
      'job_id', p_job_id,
      'job_display_id', v_job_display
    )::jsonb
  );

  return json_build_object(
    'success', true,
    'new_quantity', v_new_qty,
    'stock_level', v_new_level,
    'low_stock_alert', v_new_qty <= v_item.min_quantity
  );
end;
$$;

-- ── 4. RPC: Get assets overview (dashboard stats) ───────
create or replace function public.get_assets_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'total_assets', (
      select count(*) from public.assets
      where organization_id = p_org_id and deleted_at is null
    ),
    'total_asset_value', (
      select coalesce(sum(purchase_cost), 0)
      from public.assets
      where organization_id = p_org_id and deleted_at is null
    ),
    'vehicles_active', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and category = 'vehicle'
        and status in ('available', 'assigned')
    ),
    'assets_assigned', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and status = 'assigned'
    ),
    'assets_maintenance', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and status = 'maintenance'
    ),
    'service_due_count', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and next_service is not null
        and next_service <= (current_date + interval '7 days')
    ),
    'low_stock_count', (
      select count(*) from public.inventory_items
      where organization_id = p_org_id
        and stock_level in ('low', 'critical')
    ),
    'critical_stock_count', (
      select count(*) from public.inventory_items
      where organization_id = p_org_id
        and stock_level = 'critical'
    ),
    'total_inventory_value', (
      select coalesce(sum(quantity * unit_cost), 0)
      from public.inventory_items
      where organization_id = p_org_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ── 5. RPC: Log service for an asset ────────────────────
create or replace function public.log_asset_service(
  p_asset_id uuid,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_asset record;
  v_user_name text;
  v_next_service date;
begin
  select * into v_asset
  from public.assets
  where id = p_asset_id and deleted_at is null;

  if not found then
    return json_build_object('error', 'Asset not found');
  end if;

  -- Calculate next service date
  v_next_service := current_date + (coalesce(v_asset.service_interval_days, 180) * interval '1 day');

  -- Update asset
  update public.assets
  set last_service = current_date,
      next_service = v_next_service,
      status = case when status = 'maintenance' then 'available' else status end,
      updated_at = now()
  where id = p_asset_id;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles where id = p_actor_id;

  -- Create audit log
  insert into public.asset_audits (
    organization_id, asset_id, action, notes, user_id, user_name, metadata
  ) values (
    v_asset.organization_id, p_asset_id, 'service',
    coalesce(p_notes, 'Service completed for ' || v_asset.name),
    p_actor_id, v_user_name,
    json_build_object('next_service', v_next_service)::jsonb
  );

  return json_build_object(
    'success', true,
    'last_service', current_date,
    'next_service', v_next_service
  );
end;
$$;

-- ── 6. Trigger: Auto low-stock notification ─────────────
create or replace function public.check_low_stock_trigger()
returns trigger as $$
begin
  -- Only fire when crossing below reorder point
  if NEW.quantity <= NEW.min_quantity
    and (OLD.quantity > OLD.min_quantity or OLD.quantity is null)
  then
    -- Insert system notification for org admins
    insert into public.notifications (
      user_id, type, title, body, metadata
    )
    select
      om.user_id,
      'system',
      'Low Stock Alert',
      NEW.name || ' is below reorder point (' || NEW.quantity || ' remaining)',
      json_build_object(
        'inventory_id', NEW.id,
        'item_name', NEW.name,
        'quantity', NEW.quantity,
        'min_quantity', NEW.min_quantity,
        'stock_level', NEW.stock_level
      )::jsonb
    from public.organization_members om
    where om.organization_id = NEW.organization_id
      and om.role in ('owner', 'admin');
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_inventory_low_stock on public.inventory_items;
create trigger on_inventory_low_stock
  after update on public.inventory_items
  for each row
  when (NEW.stock_level in ('low', 'critical'))
  execute function public.check_low_stock_trigger();

-- ── 7. Enable Realtime for assets & inventory ───────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'assets'
  ) then
    alter publication supabase_realtime add table public.assets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;
end $$;
