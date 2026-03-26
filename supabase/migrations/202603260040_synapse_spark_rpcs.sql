-- ============================================================================
-- @migration SynapseSparkRPCs
-- @status COMPLETE
-- @description Messaging ignition RPCs for deterministic DM creation + RBAC search
-- @lastAudit 2026-03-26
-- ============================================================================

create or replace function public.get_messageable_users(
  p_workspace_id uuid
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_requester_role text;
begin
  if v_requester_id is null then
    raise exception 'Not authenticated';
  end if;

  select om.role::text
  into v_requester_role
  from public.organization_members om
  where om.organization_id = p_workspace_id
    and om.user_id = v_requester_id
    and om.status = 'active'
  limit 1;

  if v_requester_role is null then
    raise exception 'Not a member of this workspace';
  end if;

  if lower(v_requester_role) in ('owner', 'admin', 'manager', 'dispatcher', 'office_admin', 'coordinator', 'care_coordinator') then
    return query
    select
      p.id,
      coalesce(p.full_name, p.email, 'Unknown')::text as full_name,
      p.email::text as email,
      om.role::text as role,
      p.avatar_url::text as avatar_url
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = p_workspace_id
      and om.status = 'active'
      and om.user_id <> v_requester_id
    order by coalesce(p.full_name, p.email) asc;
  else
    return query
    select
      p.id,
      coalesce(p.full_name, p.email, 'Unknown')::text as full_name,
      p.email::text as email,
      om.role::text as role,
      p.avatar_url::text as avatar_url
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = p_workspace_id
      and om.status = 'active'
      and om.user_id <> v_requester_id
      and lower(om.role::text) in (
        'owner', 'admin', 'manager', 'dispatcher', 'office_admin', 'coordinator', 'care_coordinator'
      )
    order by coalesce(p.full_name, p.email) asc;
  end if;
end;
$$;

grant execute on function public.get_messageable_users(uuid) to authenticated;

create or replace function public.get_or_create_direct_message(
  p_target_user_id uuid,
  p_workspace_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_workspace_id uuid;
  v_channel_id uuid;
  v_requester_role text;
  v_target_role text;
  v_pair_key text;
begin
  if v_requester_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null or p_target_user_id = v_requester_id then
    raise exception 'Invalid target user';
  end if;

  if p_workspace_id is not null then
    v_workspace_id := p_workspace_id;
  else
    select om.organization_id
    into v_workspace_id
    from public.organization_members om
    join public.organization_members target_om
      on target_om.organization_id = om.organization_id
    where om.user_id = v_requester_id
      and target_om.user_id = p_target_user_id
      and om.status = 'active'
      and target_om.status = 'active'
    order by om.created_at desc
    limit 1;
  end if;

  if v_workspace_id is null then
    raise exception 'No shared workspace';
  end if;

  select om.role::text into v_requester_role
  from public.organization_members om
  where om.organization_id = v_workspace_id
    and om.user_id = v_requester_id
    and om.status = 'active'
  limit 1;

  select om.role::text into v_target_role
  from public.organization_members om
  where om.organization_id = v_workspace_id
    and om.user_id = p_target_user_id
    and om.status = 'active'
  limit 1;

  if v_requester_role is null or v_target_role is null then
    raise exception 'One or both users are not active members in workspace';
  end if;

  if lower(v_requester_role) not in ('owner', 'admin', 'manager', 'dispatcher', 'office_admin', 'coordinator', 'care_coordinator')
     and lower(v_target_role) not in ('owner', 'admin', 'manager', 'dispatcher', 'office_admin', 'coordinator', 'care_coordinator') then
    raise exception 'Messaging restricted by role policy';
  end if;

  v_pair_key := case when v_requester_id::text < p_target_user_id::text
    then v_requester_id::text || ':' || p_target_user_id::text || ':' || v_workspace_id::text
    else p_target_user_id::text || ':' || v_requester_id::text || ':' || v_workspace_id::text
  end;
  perform pg_advisory_xact_lock(hashtext(v_pair_key));

  select c.id
  into v_channel_id
  from public.channels c
  join public.channel_members requester_cm
    on requester_cm.channel_id = c.id
   and requester_cm.user_id = v_requester_id
  join public.channel_members target_cm
    on target_cm.channel_id = c.id
   and target_cm.user_id = p_target_user_id
  where c.organization_id = v_workspace_id
    and c.type = 'dm'
    and coalesce(c.is_archived, false) = false
  limit 1;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  insert into public.channels (
    organization_id,
    type,
    name,
    created_by
  ) values (
    v_workspace_id,
    'dm',
    null,
    v_requester_id
  )
  returning id into v_channel_id;

  insert into public.channel_members (channel_id, user_id, role)
  values
    (v_channel_id, v_requester_id, 'admin'),
    (v_channel_id, p_target_user_id, 'member')
  on conflict do nothing;

  return v_channel_id;
end;
$$;

grant execute on function public.get_or_create_direct_message(uuid, uuid) to authenticated;
