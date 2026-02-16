-- ============================================================
-- Migration 016: Notifications (Inbox)
-- In-app notification system
-- ============================================================

create type public.notification_type as enum (
  'job_assigned', 'quote_approved', 'mention', 'system', 'review',
  'invoice_paid', 'schedule_conflict', 'form_signed', 'team_invite'
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  type            public.notification_type not null,
  title           text not null,
  body            text,
  sender_id       uuid references public.profiles on delete set null,
  sender_name     text,
  context         text,
  read            boolean default false,
  archived        boolean default false,
  snoozed_until   timestamptz,
  related_job_id  uuid references public.jobs on delete set null,
  related_client_id uuid references public.clients on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

create index idx_notifications_user on public.notifications (user_id, read, archived);
create index idx_notifications_org on public.notifications (organization_id);
create index idx_notifications_time on public.notifications (user_id, created_at desc);
create index idx_notifications_unread on public.notifications (user_id) where read = false and archived = false;

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "System can create notifications"
  on public.notifications for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
    )
  );
