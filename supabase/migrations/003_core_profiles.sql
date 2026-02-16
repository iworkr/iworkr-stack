-- ============================================================
-- Migration 003: Profiles
-- Extends auth.users with application-specific data
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  phone           text,
  timezone        text default 'Australia/Brisbane',
  notification_preferences jsonb default '{
    "email_digest": true,
    "push_jobs": true,
    "push_inbox": true,
    "push_schedule": true
  }'::jsonb,
  onboarding_completed boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_profiles_email on public.profiles (email);

-- Auto-update updated_at on any table
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- Auto-create profile when a user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
