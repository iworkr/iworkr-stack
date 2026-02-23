-- ============================================================
-- 030: Storage Buckets
-- Creates the required storage buckets with RLS policies.
-- ============================================================

-- Create buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('forms', 'forms', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('assets', 'assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ── Avatars: public read, authenticated upload own ──────────
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Logos: public read, org members upload ──────────────────
create policy "Anyone can view logos"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Org members can upload logos"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin', 'manager')
    )
  );

create policy "Org admins can update logos"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin', 'manager')
    )
  );

create policy "Org admins can delete logos"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

-- ── Job Photos: org members read/write ──────────────────────
create policy "Org members can view job photos"
  on storage.objects for select
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete job photos"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

-- ── Forms: org members read/write ───────────────────────────
create policy "Org members can view form files"
  on storage.objects for select
  using (
    bucket_id = 'forms'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload form files"
  on storage.objects for insert
  with check (
    bucket_id = 'forms'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete form files"
  on storage.objects for delete
  using (
    bucket_id = 'forms'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

-- ── Assets: org members read/write ──────────────────────────
create policy "Org members can view asset files"
  on storage.objects for select
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload asset files"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete asset files"
  on storage.objects for delete
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );
