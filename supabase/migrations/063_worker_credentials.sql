-- ============================================================================
-- Migration 063: Worker Credentials (Project Nightingale)
-- Workforce compliance: credentials, expiry tracking, and scheduling hard gate.
-- SAFE: All statements wrapped with existence checks.
-- ============================================================================

-- 1. Create credential_type enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN
    CREATE TYPE public.credential_type AS ENUM (
      'NDIS_SCREENING',
      'WWCC',
      'FIRST_AID',
      'MANUAL_HANDLING',
      'MEDICATION_COMPETENCY',
      'CPR',
      'DRIVERS_LICENSE',
      'POLICE_CHECK',
      'OTHER'
    );
  END IF;
END $$;

-- 2. Create verification_status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE public.verification_status AS ENUM (
      'pending',
      'verified',
      'rejected',
      'expired'
    );
  END IF;
END $$;

-- 3. Create worker_credentials table
CREATE TABLE IF NOT EXISTS public.worker_credentials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  credential_type       public.credential_type NOT NULL,
  credential_name       text,
  document_url          text,
  issued_date           date,
  expiry_date           date,
  verification_status   public.verification_status NOT NULL DEFAULT 'pending',
  verified_by           uuid REFERENCES public.profiles,
  verified_at           timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_worker_credentials_org
  ON public.worker_credentials (organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_credentials_user
  ON public.worker_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_worker_credentials_expiry
  ON public.worker_credentials (expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worker_credentials_status
  ON public.worker_credentials (organization_id, verification_status);

-- 5. Updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_worker_credentials_updated_at'
  ) THEN
    CREATE TRIGGER set_worker_credentials_updated_at
      BEFORE UPDATE ON public.worker_credentials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- 6. Enable RLS
ALTER TABLE public.worker_credentials ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- SELECT: Org members can view their own credentials; admins+ see all in org
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_credentials' AND policyname = 'Members view own or admin views all credentials') THEN
    CREATE POLICY "Members view own or admin views all credentials"
      ON public.worker_credentials FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (
          user_id = auth.uid()
          OR (SELECT role FROM public.organization_members WHERE organization_id = worker_credentials.organization_id AND user_id = auth.uid() AND status = 'active') IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END $$;

-- INSERT: Worker can insert own credentials; admins can insert for anyone
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_credentials' AND policyname = 'Workers or admins can insert credentials') THEN
    CREATE POLICY "Workers or admins can insert credentials"
      ON public.worker_credentials FOR INSERT
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (
          user_id = auth.uid()
          OR (SELECT role FROM public.organization_members WHERE organization_id = worker_credentials.organization_id AND user_id = auth.uid() AND status = 'active') IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END $$;

-- UPDATE: Worker can update own; admins can update any
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_credentials' AND policyname = 'Workers or admins can update credentials') THEN
    CREATE POLICY "Workers or admins can update credentials"
      ON public.worker_credentials FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (
          user_id = auth.uid()
          OR (SELECT role FROM public.organization_members WHERE organization_id = worker_credentials.organization_id AND user_id = auth.uid() AND status = 'active') IN ('owner', 'admin', 'manager')
        )
      );
  END IF;
END $$;

-- DELETE: Admins only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worker_credentials' AND policyname = 'Admins can delete credentials') THEN
    CREATE POLICY "Admins can delete credentials"
      ON public.worker_credentials FOR DELETE
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = worker_credentials.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin')
      );
  END IF;
END $$;

-- 8. Function: Check credential expiry and enqueue warning emails
CREATE OR REPLACE FUNCTION public.check_credential_expiries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cred RECORD;
BEGIN
  -- Find credentials expiring within 30 days that haven't been warned recently
  FOR cred IN
    SELECT
      wc.id,
      wc.organization_id,
      wc.user_id,
      wc.credential_type::text AS cred_type,
      wc.credential_name,
      wc.expiry_date,
      p.email AS worker_email,
      p.full_name AS worker_name,
      o.name AS org_name
    FROM public.worker_credentials wc
    JOIN public.profiles p ON p.id = wc.user_id
    JOIN public.organizations o ON o.id = wc.organization_id
    WHERE wc.expiry_date IS NOT NULL
      AND wc.expiry_date <= (CURRENT_DATE + INTERVAL '30 days')
      AND wc.expiry_date >= CURRENT_DATE
      AND wc.verification_status != 'expired'
      -- Don't re-warn if we already sent one in the last 7 days
      AND NOT EXISTS (
        SELECT 1 FROM public.mail_queue mq
        WHERE mq.organization_id = wc.organization_id
          AND mq.event_type = 'credential_expiry_warning'
          AND (mq.payload->>'credential_id')::uuid = wc.id
          AND mq.created_at > (NOW() - INTERVAL '7 days')
      )
  LOOP
    -- Enqueue warning email to the worker
    INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
    VALUES (
      cred.organization_id,
      'credential_expiry_warning',
      cred.worker_email,
      jsonb_build_object(
        'credential_id', cred.id,
        'credential_type', cred.cred_type,
        'credential_name', COALESCE(cred.credential_name, cred.cred_type),
        'worker_name', cred.worker_name,
        'worker_email', cred.worker_email,
        'expiry_date', cred.expiry_date::text,
        'org_name', cred.org_name,
        'days_remaining', (cred.expiry_date - CURRENT_DATE)
      )
    );
  END LOOP;

  -- Auto-expire credentials that are past their expiry date
  UPDATE public.worker_credentials
  SET verification_status = 'expired', updated_at = now()
  WHERE expiry_date < CURRENT_DATE
    AND verification_status != 'expired';
END;
$$;

-- 9. Comments
COMMENT ON TABLE public.worker_credentials IS
  'Workforce compliance credentials: licenses, screenings, certifications. Used by the scheduling hard gate to prevent non-compliant shift assignments.';
COMMENT ON FUNCTION public.check_credential_expiries IS
  'Daily cron function: warns workers/admins about expiring credentials and auto-expires past-due credentials.';
