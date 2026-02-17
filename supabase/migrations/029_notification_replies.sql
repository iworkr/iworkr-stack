-- ============================================================
-- 029: Notification Replies
-- Allows users to reply to inbox notifications.
-- ============================================================

create table if not exists public.notification_replies (
  id            uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now()
);

comment on table public.notification_replies is 'Replies to inbox notifications';

-- Index for fast lookup by notification
create index if not exists idx_notification_replies_notification
  on public.notification_replies (notification_id, created_at desc);

-- RLS
alter table public.notification_replies enable row level security;

-- Users can insert replies for themselves
create policy "Users can reply to own notifications"
  on public.notification_replies for insert
  with check (auth.uid() = user_id);

-- Users can read their own replies
create policy "Users can read own replies"
  on public.notification_replies for select
  using (auth.uid() = user_id);
