-- ============================================================================
-- @migration GenesisInviteOnboarding
-- @status COMPLETE
-- @description Project Genesis — team lifecycle, invite flow, and onboarding
-- @tables organizations (altered), invites (altered), onboarding_checklist
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Add brand_color_hex to organizations ──────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_color_hex text DEFAULT '#00E676';

-- ── 2. Add 'revoked' to invite_status enum ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'revoked'
        AND enumtypid = 'public.invite_status'::regtype
    ) THEN
      ALTER TYPE public.invite_status ADD VALUE 'revoked';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[048] Could not add revoked to invite_status — skipping.';
END $$;

-- ── 3. Enhanced validate_invite_token RPC ────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_invites') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.validate_invite_token(p_token text)
      RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER
      AS $body$
      DECLARE
        v_invite record;
      BEGIN
        SELECT
          i.*,
          o.name AS org_name,
          o.slug AS org_slug,
          o.logo_url AS org_logo_url,
          o.brand_color_hex AS org_brand_color,
          p.full_name AS inviter_name
        INTO v_invite
        FROM public.organization_invites i
        JOIN public.organizations o ON o.id = i.organization_id
        LEFT JOIN public.profiles p ON p.id = i.invited_by
        WHERE i.token = p_token;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'invalid', 'error', 'Invitation not found');
        END IF;

        IF v_invite.status = 'accepted' THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'accepted', 'error', 'This invitation has already been claimed');
        END IF;

        IF v_invite.status::text = 'revoked' THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'revoked', 'error', 'This invitation has been cancelled by the administrator');
        END IF;

        IF v_invite.status::text = 'expired' OR v_invite.expires_at < now() THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'error', 'This invitation has expired');
        END IF;

        IF v_invite.status != 'pending' THEN
          RETURN jsonb_build_object('valid', false, 'reason', 'invalid', 'error', 'This invitation is no longer valid');
        END IF;

        RETURN jsonb_build_object(
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
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 4. complete_onboarding RPC ──────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_invites') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.complete_onboarding(
        p_auth_user_id uuid,
        p_token text,
        p_full_name text,
        p_phone text DEFAULT NULL,
        p_avatar_url text DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER
      AS $body$
      DECLARE
        v_invite record;
        v_existing_member boolean;
      BEGIN
        SELECT
          i.*,
          o.name AS org_name,
          o.slug AS org_slug
        INTO v_invite
        FROM public.organization_invites i
        JOIN public.organizations o ON o.id = i.organization_id
        WHERE i.token = p_token
        FOR UPDATE;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
        END IF;

        IF v_invite.status != 'pending' THEN
          RETURN jsonb_build_object('success', false, 'error', 'This invitation is no longer valid.');
        END IF;

        IF v_invite.expires_at < now() THEN
          RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
        END IF;

        INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, onboarding_completed)
        VALUES (p_auth_user_id, v_invite.email, p_full_name, p_phone, p_avatar_url, true)
        ON CONFLICT (id) DO UPDATE SET
          full_name = COALESCE(NULLIF(excluded.full_name, ''), profiles.full_name),
          phone = COALESCE(NULLIF(excluded.phone, ''), profiles.phone),
          avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
          onboarding_completed = true;

        SELECT EXISTS(
          SELECT 1 FROM public.organization_members
          WHERE organization_id = v_invite.organization_id
            AND user_id = p_auth_user_id
        ) INTO v_existing_member;

        IF v_existing_member THEN
          RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this organization');
        END IF;

        INSERT INTO public.organization_members (
          organization_id, user_id, role, status, invited_by, joined_at
        ) VALUES (
          v_invite.organization_id,
          p_auth_user_id,
          v_invite.role,
          'active',
          v_invite.invited_by,
          now()
        );

        UPDATE public.organization_invites
        SET status = 'accepted'
        WHERE id = v_invite.id;

        BEGIN
          INSERT INTO public.audit_log (organization_id, user_id, action, entity_type, entity_id, new_data)
          VALUES (
            v_invite.organization_id,
            p_auth_user_id,
            'member.joined',
            'organization_member',
            p_auth_user_id::text,
            jsonb_build_object('role', v_invite.role, 'via', 'invite_onboarding')
          );
        EXCEPTION WHEN undefined_table THEN NULL;
        END;

        RETURN jsonb_build_object(
          'success', true,
          'organization_id', v_invite.organization_id,
          'organization_name', v_invite.org_name,
          'organization_slug', v_invite.org_slug,
          'role', v_invite.role
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 5. Expire stale invites (daily cleanup) ──────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_invites') THEN
    PERFORM cron.schedule(
      'expire_stale_invites',
      '0 3 * * *',
      $cron$
        UPDATE public.organization_invites
        SET status = 'expired'
        WHERE status = 'pending'
          AND expires_at < now();
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[048] pg_cron not available — skipping invite cleanup.';
END $$;

-- ── 6. Revoke invite function ────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_invites') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.revoke_invite(p_invite_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER
      AS $body$
      DECLARE
        v_invite record;
      BEGIN
        SELECT i.*
        INTO v_invite
        FROM public.organization_invites i
        WHERE i.id = p_invite_id
          AND i.status = 'pending';

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already processed');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE user_id = auth.uid()
            AND organization_id = v_invite.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND status = 'active'
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
        END IF;

        UPDATE public.organization_invites
        SET status = 'revoked'
        WHERE id = p_invite_id;

        RETURN jsonb_build_object('success', true);
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 7. Resend invite function ──────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_invites') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.resend_invite(p_invite_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER
      AS $body$
      DECLARE
        v_invite record;
      BEGIN
        SELECT i.*
        INTO v_invite
        FROM public.organization_invites i
        WHERE i.id = p_invite_id
          AND i.status IN ('pending', 'expired');

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'error', 'Invite not found or not resendable');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE user_id = auth.uid()
            AND organization_id = v_invite.organization_id
            AND role IN ('owner', 'admin', 'manager')
            AND status = 'active'
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
        END IF;

        UPDATE public.organization_invites
        SET status = 'pending',
            expires_at = now() + interval '7 days',
            created_at = now()
        WHERE id = p_invite_id;

        RETURN jsonb_build_object(
          'success', true,
          'token', v_invite.token,
          'email', v_invite.email,
          'organization_id', v_invite.organization_id
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;
