-- ============================================================
-- Migration 048: Project Genesis — Team Lifecycle & Onboarding
-- brand_color_hex, revoked status, complete_onboarding RPC,
-- enhanced validate_invite_token, pg_cron invite cleanup
-- ============================================================

-- ── 1. Add brand_color_hex to organizations ──────────────
alter table public.organizations
  add column if not exists brand_color_hex text default '#00E676';

comment on column public.organizations.brand_color_hex
  is 'Hex color for branded emails and invite pages (e.g. #00E676)';

-- ── 2. Add ''revoked'' to invite_status enum ─────────────
-- Postgres enums are immutable — we add the new value safely.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'revoked'
      and enumtypid = 'public.invite_status'::regtype
  ) then
    alter type public.invite_status add value 'revoked';
  end if;
end $$;

-- ── 3. Enhanced validate_invite_token RPC ────────────────
-- Now returns branding data (logo_url, brand_color_hex) and
-- specific failure reasons (expired, accepted, revoked, invalid).
create or replace function public.validate_invite_token(p_token text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_invite record;
begin
  select
    i.*,
    o.name as org_name,
    o.slug as org_slug,
    o.logo_url as org_logo_url,
    o.brand_color_hex as org_brand_color,
    p.full_name as inviter_name
  into v_invite
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid', 'error', 'Invitation not found');
  end if;

  if v_invite.status = 'accepted' then
    return jsonb_build_object('valid', false, 'reason', 'accepted', 'error', 'This invitation has already been claimed');
  end if;

  if v_invite.status = 'revoked' then
    return jsonb_build_object('valid', false, 'reason', 'revoked', 'error', 'This invitation has been cancelled by the administrator');
  end if;

  if v_invite.status = 'expired' or v_invite.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired', 'error', 'This invitation has expired');
  end if;

  if v_invite.status != 'pending' then
    return jsonb_build_object('valid', false, 'reason', 'invalid', 'error', 'This invitation is no longer valid');
  end if;

  return jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'organization_id', v_invite.organization_id,
    'organization_name', v_invite.org_name,
    'organization_slug', v_invite.org_slug,
    'organization_logo', v_invite.org_logo_url,
    'brand_color', v_invite.org_brand_color,
    'inviter_name', v_invite.inviter_name,
    'expires_at', v_invite.expires_at
  );
end;
$$;

-- ── 4. complete_onboarding RPC (Transactional) ──────────
-- Single atomic function: verifies token, creates profile,
-- adds member, accepts invite. Prevents race conditions and
-- ensures consistency.
create or replace function public.complete_onboarding(
  p_auth_user_id uuid,
  p_token text,
  p_full_name text,
  p_phone text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_invite record;
  v_existing_member boolean;
begin
  -- 1. Verify the token is still valid
  select
    i.*,
    o.name as org_name,
    o.slug as org_slug
  into v_invite
  from public.organization_invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
  for update; -- lock the row to prevent concurrent acceptance

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invitation not found');
  end if;

  if v_invite.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'This invitation is no longer valid. It may have been revoked by the administrator.');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'This invitation has expired');
  end if;

  -- 2. Upsert profile (handles both new and existing users)
  insert into public.profiles (id, email, full_name, phone, avatar_url, onboarding_completed)
  values (p_auth_user_id, v_invite.email, p_full_name, p_phone, p_avatar_url, true)
  on conflict (id) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    phone = coalesce(nullif(excluded.phone, ''), profiles.phone),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    onboarding_completed = true;

  -- 3. Check if already a member (collision case — existing user joining another org)
  select exists(
    select 1 from public.organization_members
    where organization_id = v_invite.organization_id
      and user_id = p_auth_user_id
  ) into v_existing_member;

  if v_existing_member then
    return jsonb_build_object('success', false, 'error', 'You are already a member of this organization');
  end if;

  -- 4. Add to organization as a member
  insert into public.organization_members (
    organization_id, user_id, role, status, invited_by, joined_at
  ) values (
    v_invite.organization_id,
    p_auth_user_id,
    v_invite.role,
    'active',
    v_invite.invited_by,
    now()
  );

  -- 5. Accept the invite
  update public.organization_invites
  set status = 'accepted'
  where id = v_invite.id;

  -- 6. Audit log
  insert into public.audit_log (organization_id, user_id, action, entity_type, entity_id, new_data)
  values (
    v_invite.organization_id,
    p_auth_user_id,
    'member.joined',
    'organization_member',
    p_auth_user_id::text,
    jsonb_build_object('role', v_invite.role, 'via', 'invite_onboarding')
  );

  return jsonb_build_object(
    'success', true,
    'organization_id', v_invite.organization_id,
    'organization_name', v_invite.org_name,
    'organization_slug', v_invite.org_slug,
    'role', v_invite.role
  );
end;
$$;

-- ── 5. Expire stale invites (daily cleanup) ──────────────
-- If pg_cron is available, schedule a daily cleanup.
-- Falls back gracefully if pg_cron is not installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'expire_stale_invites',
      '0 3 * * *', -- 3 AM daily
      $cron$
        update public.organization_invites
        set status = 'expired'
        where status = 'pending'
          and expires_at < now();
      $cron$
    );
  end if;
exception when others then
  -- pg_cron not available — no-op
  null;
end $$;

-- ── 6. Revoke invite function ────────────────────────────
-- Admin action to cancel a pending invite
create or replace function public.revoke_invite(p_invite_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  v_invite record;
begin
  select i.*
  into v_invite
  from public.organization_invites i
  where i.id = p_invite_id
    and i.status = 'pending';

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invite not found or already processed');
  end if;

  -- Verify caller is admin+ in the org
  if not exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = v_invite.organization_id
      and role in ('owner', 'admin', 'manager')
      and status = 'active'
  ) then
    return jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  end if;

  update public.organization_invites
  set status = 'revoked'
  where id = p_invite_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ── 7. Resend invite function (extends expiry) ──────────
create or replace function public.resend_invite(p_invite_id uuid)
returns jsonb
language plpgsql security definer
as $$
declare
  v_invite record;
begin
  select i.*
  into v_invite
  from public.organization_invites i
  where i.id = p_invite_id
    and i.status in ('pending', 'expired');

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invite not found or not resendable');
  end if;

  -- Verify caller is admin+ in the org
  if not exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = v_invite.organization_id
      and role in ('owner', 'admin', 'manager')
      and status = 'active'
  ) then
    return jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  end if;

  -- Reset expiry and status
  update public.organization_invites
  set status = 'pending',
      expires_at = now() + interval '7 days',
      created_at = now()
  where id = p_invite_id;

  return jsonb_build_object(
    'success', true,
    'token', v_invite.token,
    'email', v_invite.email,
    'organization_id', v_invite.organization_id
  );
end;
$$;
