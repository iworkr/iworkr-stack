-- ============================================================
-- Migration 008: RLS Policies
-- Row Level Security for all core tables
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Org members can read teammate profiles"
  on public.profiles for select
  using (
    id in (
      select om.user_id from public.organization_members om
      where om.organization_id in (select public.get_user_org_ids())
        and om.status = 'active'
    )
  );

-- ── Organizations ─────────────────────────────────────────
alter table public.organizations enable row level security;

create policy "Members can read their orgs"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Owners and admins can update their org"
  on public.organizations for update
  using (public.user_has_role(id, 'admin'))
  with check (public.user_has_role(id, 'admin'));

create policy "Authenticated users can create orgs"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- ── Organization Members ──────────────────────────────────
alter table public.organization_members enable row level security;

create policy "Members can read fellow members"
  on public.organization_members for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Admins can insert members"
  on public.organization_members for insert
  with check (
    public.user_has_role(organization_id, 'admin')
    or (
      -- Allow a user to insert themselves as owner when creating a new org
      user_id = auth.uid()
      and role = 'owner'
    )
  );

create policy "Admins can update members"
  on public.organization_members for update
  using (public.user_has_role(organization_id, 'admin'));

create policy "Owners can delete members"
  on public.organization_members for delete
  using (public.user_has_role(organization_id, 'owner'));

-- ── Organization Invites ──────────────────────────────────
alter table public.organization_invites enable row level security;

create policy "Members can view org invites"
  on public.organization_invites for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Admins can create invites"
  on public.organization_invites for insert
  with check (public.user_has_role(organization_id, 'admin'));

-- Allow the invited user to see their own invite (for accepting)
create policy "Invitees can view their own invites"
  on public.organization_invites for select
  using (email = (select email from public.profiles where id = auth.uid()));

-- Allow invite status updates via service_role (Edge Functions)
-- No user-facing update policy needed

-- ── Subscriptions ─────────────────────────────────────────
alter table public.subscriptions enable row level security;

create policy "Members can read their org subscription"
  on public.subscriptions for select
  using (organization_id in (select public.get_user_org_ids()));

-- Write operations only via service_role key (webhook Edge Functions)

-- ── Audit Log ─────────────────────────────────────────────
alter table public.audit_log enable row level security;

create policy "Admins can read audit log"
  on public.audit_log for select
  using (public.user_has_role(organization_id, 'admin'));

-- Insert via service_role or security definer functions only
