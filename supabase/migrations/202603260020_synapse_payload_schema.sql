-- ============================================================================
-- @migration SynapsePayloadSchema
-- @status COMPLETE
-- @description Rich media payload extensions for chat_messages + private storage
-- @lastAudit 2026-03-26
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_message_type') then
    create type public.chat_message_type as enum ('TEXT', 'IMAGE', 'FILE', 'LOCATION', 'POLL');
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'chat_messages'
  ) then
    alter table public.chat_messages
      add column if not exists message_type public.chat_message_type not null default 'TEXT',
      add column if not exists media_url text,
      add column if not exists metadata_jsonb jsonb not null default '{}'::jsonb;
  end if;
end $$;

insert into storage.buckets (id, name, public)
select 'chat_attachments', 'chat_attachments', false
where not exists (
  select 1 from storage.buckets where id = 'chat_attachments'
);

alter table storage.objects enable row level security;

drop policy if exists "chat attachments read by participant" on storage.objects;
create policy "chat attachments read by participant"
on storage.objects
for select
using (
  bucket_id = 'chat_attachments'
  and array_length(path_tokens, 1) >= 1
  and path_tokens[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = path_tokens[1]::uuid
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "chat attachments insert by participant" on storage.objects;
create policy "chat attachments insert by participant"
on storage.objects
for insert
with check (
  bucket_id = 'chat_attachments'
  and array_length(path_tokens, 1) >= 1
  and path_tokens[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = path_tokens[1]::uuid
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "chat attachments update by participant" on storage.objects;
create policy "chat attachments update by participant"
on storage.objects
for update
using (
  bucket_id = 'chat_attachments'
  and array_length(path_tokens, 1) >= 1
  and path_tokens[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = path_tokens[1]::uuid
      and cp.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'chat_attachments'
  and array_length(path_tokens, 1) >= 1
  and path_tokens[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = path_tokens[1]::uuid
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "chat attachments delete by participant" on storage.objects;
create policy "chat attachments delete by participant"
on storage.objects
for delete
using (
  bucket_id = 'chat_attachments'
  and array_length(path_tokens, 1) >= 1
  and path_tokens[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.chat_participants cp
    where cp.channel_id = path_tokens[1]::uuid
      and cp.user_id = auth.uid()
  )
);
