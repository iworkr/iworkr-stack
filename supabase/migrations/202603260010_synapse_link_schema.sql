-- ============================================================================
-- @migration SynapseLinkSchema
-- @status COMPLETE
-- @description Real-time internal messaging schema for DMs, job threads, groups
-- @tables chat_channels, chat_participants, chat_messages
-- @lastAudit 2026-03-26
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_channel_type') then
    create type public.chat_channel_type as enum ('DIRECT', 'JOB_THREAD', 'GROUP');
  end if;
end $$;

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id) on delete cascade,
  type public.chat_channel_type not null,
  name text,
  reference_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_channels_workspace on public.chat_channels (workspace_id, type);
create index if not exists idx_chat_channels_reference on public.chat_channels (reference_id) where reference_id is not null;

create table if not exists public.chat_participants (
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists idx_chat_participants_user on public.chat_participants (user_id, channel_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_channel_time on public.chat_messages (channel_id, created_at desc);

-- Keep channel updated_at fresh on message insert.
create or replace function public.touch_chat_channel_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chat_channels
  set updated_at = now()
  where id = new.channel_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_channel_updated_at on public.chat_messages;
create trigger trg_touch_chat_channel_updated_at
after insert on public.chat_messages
for each row execute function public.touch_chat_channel_updated_at();

alter table public.chat_channels enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

-- Channel visibility: user must be participant.
drop policy if exists "chat channels select by participant" on public.chat_channels;
create policy "chat channels select by participant"
on public.chat_channels for select
using (
  exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = chat_channels.id
      and cp.user_id = auth.uid()
  )
);

-- Channel insert: active org member only.
drop policy if exists "chat channels insert by org member" on public.chat_channels;
create policy "chat channels insert by org member"
on public.chat_channels for insert
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = chat_channels.workspace_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

-- Participant read: only participants can read participant list.
drop policy if exists "chat participants select by participant" on public.chat_participants;
create policy "chat participants select by participant"
on public.chat_participants for select
using (
  exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = chat_participants.channel_id
      and cp.user_id = auth.uid()
  )
);

-- Participant insert: only active member can add themselves/others to channels in their workspace.
drop policy if exists "chat participants insert by workspace member" on public.chat_participants;
create policy "chat participants insert by workspace member"
on public.chat_participants for insert
with check (
  exists (
    select 1
    from public.chat_channels cc
    join public.organization_members om
      on om.organization_id = cc.workspace_id
    where cc.id = chat_participants.channel_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

-- Message read: participant only.
drop policy if exists "chat messages select by participant" on public.chat_messages;
create policy "chat messages select by participant"
on public.chat_messages for select
using (
  exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = chat_messages.channel_id
      and cp.user_id = auth.uid()
  )
);

-- Message insert: sender must be auth user and participant.
drop policy if exists "chat messages insert by participant" on public.chat_messages;
create policy "chat messages insert by participant"
on public.chat_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = chat_messages.channel_id
      and cp.user_id = auth.uid()
  )
);

-- Auto-create job thread channel and enroll creator + assignee.
create or replace function public.ensure_job_chat_channel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_org_id uuid;
  v_created_by uuid;
  v_assignee_id uuid;
  v_display_id text;
  v_title text;
begin
  v_org_id := nullif(to_jsonb(new)->>'organization_id', '')::uuid;
  v_created_by := nullif(to_jsonb(new)->>'created_by', '')::uuid;
  v_assignee_id := nullif(to_jsonb(new)->>'assignee_id', '')::uuid;
  v_display_id := nullif(to_jsonb(new)->>'display_id', '');
  v_title := nullif(to_jsonb(new)->>'title', '');

  if v_org_id is null then
    return new;
  end if;

  insert into public.chat_channels (workspace_id, type, name, reference_id, created_by)
  values (
    v_org_id,
    'JOB_THREAD',
    coalesce(v_display_id, 'Job') || ' · ' || coalesce(v_title, 'Thread'),
    new.id,
    coalesce(v_created_by, auth.uid())
  )
  returning id into v_channel_id;

  if v_created_by is not null then
    insert into public.chat_participants (channel_id, user_id, role)
    values (v_channel_id, v_created_by, 'admin')
    on conflict do nothing;
  end if;

  if v_assignee_id is not null then
    insert into public.chat_participants (channel_id, user_id, role)
    values (v_channel_id, v_assignee_id, 'member')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_create_chat_channel on public.jobs;
create trigger trg_jobs_create_chat_channel
after insert on public.jobs
for each row execute function public.ensure_job_chat_channel();

-- Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
