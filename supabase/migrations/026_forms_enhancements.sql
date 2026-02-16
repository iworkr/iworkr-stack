-- ============================================================
-- Migration 026: Forms & Compliance Module Enhancements
-- increment_form_submissions, sign_and_lock_submission RPC,
-- save_form_draft RPC, document_hash, verify hash, realtime
-- ============================================================

-- ── 1. Add missing columns ──────────────────────────────
alter table public.form_submissions
  add column if not exists document_hash text;

alter table public.form_submissions
  add column if not exists pdf_url text;

alter table public.forms
  add column if not exists version int default 1;

alter table public.forms
  add column if not exists layout_config jsonb default '{}';

alter table public.forms
  add column if not exists is_verified boolean default false;

-- ── 2. RPC: Increment form submissions count ────────────
create or replace function public.increment_form_submissions(form_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.forms
  set submissions_count = submissions_count + 1,
      updated_at = now()
  where id = form_id;
end;
$$;

-- ── 3. RPC: Save form draft (autosave) ──────────────────
create or replace function public.save_form_draft(
  p_submission_id uuid,
  p_data jsonb
)
returns json
language plpgsql
security definer
as $$
begin
  update public.form_submissions
  set data = p_data,
      updated_at = now()
  where id = p_submission_id
    and status = 'pending';

  if not found then
    return json_build_object('error', 'Submission not found or already signed');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 4. RPC: Sign and lock submission ────────────────────
create or replace function public.sign_and_lock_submission(
  p_submission_id uuid,
  p_signature text,
  p_document_hash text,
  p_metadata jsonb default '{}'
)
returns json
language plpgsql
security definer
as $$
declare
  v_sub record;
  v_form record;
  v_block record;
  v_missing text[];
begin
  -- Get submission
  select * into v_sub
  from public.form_submissions
  where id = p_submission_id;

  if not found then
    return json_build_object('error', 'Submission not found');
  end if;

  if v_sub.status = 'signed' then
    return json_build_object('error', 'Submission already signed and locked');
  end if;

  -- Get form template for required field validation
  select * into v_form
  from public.forms
  where id = v_sub.form_id;

  if not found then
    return json_build_object('error', 'Form template not found');
  end if;

  -- Validate required fields
  if v_form.blocks is not null and jsonb_array_length(v_form.blocks) > 0 then
    select array_agg(b->>'label')
    into v_missing
    from jsonb_array_elements(v_form.blocks) as b
    where (b->>'required')::boolean = true
      and (
        v_sub.data->(b->>'id') is null
        or v_sub.data->>(b->>'id') = ''
      );

    if v_missing is not null and array_length(v_missing, 1) > 0 then
      return json_build_object(
        'error', 'Missing required fields',
        'missing_fields', to_json(v_missing)
      );
    end if;
  end if;

  -- Lock the submission
  update public.form_submissions
  set status = 'signed',
      signature = p_signature,
      document_hash = p_document_hash,
      signed_at = now(),
      metadata = coalesce(v_sub.metadata, '{}'::jsonb) || p_metadata,
      updated_at = now()
  where id = p_submission_id;

  return json_build_object(
    'success', true,
    'signed_at', now(),
    'document_hash', p_document_hash
  );
end;
$$;

-- ── 5. RPC: Verify document hash ────────────────────────
create or replace function public.verify_document_hash(p_hash text)
returns json
language plpgsql
security definer
as $$
declare
  v_sub record;
begin
  select
    fs.id,
    fs.form_id,
    fs.status,
    fs.signed_at,
    fs.document_hash,
    fs.submitter_name,
    f.title as form_title,
    fs.organization_id
  into v_sub
  from public.form_submissions fs
  join public.forms f on f.id = fs.form_id
  where fs.document_hash = p_hash
    and fs.status = 'signed';

  if not found then
    return json_build_object(
      'verified', false,
      'message', 'No matching signed document found for this hash'
    );
  end if;

  return json_build_object(
    'verified', true,
    'submission_id', v_sub.id,
    'form_title', v_sub.form_title,
    'signed_at', v_sub.signed_at,
    'signed_by', v_sub.submitter_name,
    'document_hash', v_sub.document_hash
  );
end;
$$;

-- ── 6. RPC: Get forms overview (stats) ──────────────────
create or replace function public.get_forms_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return json_build_object(
    'total_templates', (
      select count(*) from public.forms
      where organization_id = p_org_id and deleted_at is null
    ),
    'published_templates', (
      select count(*) from public.forms
      where organization_id = p_org_id and deleted_at is null and status = 'published'
    ),
    'total_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id
    ),
    'signed_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'signed'
    ),
    'pending_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'pending'
    ),
    'expired_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'expired'
    )
  );
end;
$$;

-- ── 7. RPC: Publish form (version bump) ─────────────────
create or replace function public.publish_form(p_form_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_new_version int;
begin
  update public.forms
  set status = 'published',
      version = version + 1,
      updated_at = now()
  where id = p_form_id
    and deleted_at is null
  returning version into v_new_version;

  if not found then
    return json_build_object('error', 'Form not found');
  end if;

  return json_build_object(
    'success', true,
    'version', v_new_version
  );
end;
$$;

-- ── 8. Enable Realtime for forms & submissions ──────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'form_submissions'
  ) then
    alter publication supabase_realtime add table public.form_submissions;
  end if;
end $$;
