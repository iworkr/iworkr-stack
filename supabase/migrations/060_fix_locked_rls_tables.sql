-- ============================================================================
-- Migration 060: Fix Locked RLS Tables
-- ============================================================================
-- Several tables have ENABLE ROW LEVEL SECURITY but are missing complete
-- CRUD policies, making them partially or fully inaccessible via the
-- Supabase client.  This migration adds idempotent (DO $$ ... END $$)
-- SELECT / INSERT / UPDATE / DELETE policies scoped to org membership.
--
-- Tables addressed:
--   1. organization_roles   (027)  -- org_id = organization_id
--   2. job_line_items       (021)  -- via job_id -> jobs.organization_id
--   3. schedule_events      (022)  -- org_id = organization_id
--   4. notification_replies (029)  -- scoped to user_id = auth.uid()
--   5. client_activity_logs (047)  -- org_id = organization_id
--   6. automation_runs      (049)  -- org_id = workspace_id
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. public.organization_roles  (organization_id)
--    Existing: SELECT via get_user_org_ids(), ALL for admins
--    Adding:   explicit INSERT / UPDATE / DELETE for completeness
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_roles'
      AND policyname = 'Org members can view roles'
  ) THEN
    CREATE POLICY "Org members can view roles"
      ON public.organization_roles FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_roles'
      AND policyname = 'Admins can insert roles'
  ) THEN
    CREATE POLICY "Admins can insert roles"
      ON public.organization_roles FOR INSERT
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_roles'
      AND policyname = 'Admins can update roles'
  ) THEN
    CREATE POLICY "Admins can update roles"
      ON public.organization_roles FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_roles'
      AND policyname = 'Admins can delete roles'
  ) THEN
    CREATE POLICY "Admins can delete roles"
      ON public.organization_roles FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. public.job_line_items  (job_id -> jobs.organization_id)
--    Existing: SELECT, INSERT, UPDATE, DELETE
--    Adding guards so the migration is re-runnable
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'job_line_items'
      AND policyname = 'Members can read job line items'
  ) THEN
    CREATE POLICY "Members can read job line items"
      ON public.job_line_items FOR SELECT
      USING (
        job_id IN (
          SELECT id FROM public.jobs
          WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'job_line_items'
      AND policyname = 'Members can create job line items'
  ) THEN
    CREATE POLICY "Members can create job line items"
      ON public.job_line_items FOR INSERT
      WITH CHECK (
        job_id IN (
          SELECT id FROM public.jobs
          WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'job_line_items'
      AND policyname = 'Members can update job line items'
  ) THEN
    CREATE POLICY "Members can update job line items"
      ON public.job_line_items FOR UPDATE
      USING (
        job_id IN (
          SELECT id FROM public.jobs
          WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'job_line_items'
      AND policyname = 'Members can delete job line items'
  ) THEN
    CREATE POLICY "Members can delete job line items"
      ON public.job_line_items FOR DELETE
      USING (
        job_id IN (
          SELECT id FROM public.jobs
          WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. public.schedule_events  (organization_id)
--    Existing: SELECT, INSERT, UPDATE, DELETE
--    Adding guards so the migration is re-runnable
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_events'
      AND policyname = 'Members can read org schedule events'
  ) THEN
    CREATE POLICY "Members can read org schedule events"
      ON public.schedule_events FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_events'
      AND policyname = 'Members can create org schedule events'
  ) THEN
    CREATE POLICY "Members can create org schedule events"
      ON public.schedule_events FOR INSERT
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_events'
      AND policyname = 'Members can update org schedule events'
  ) THEN
    CREATE POLICY "Members can update org schedule events"
      ON public.schedule_events FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_events'
      AND policyname = 'Members can delete org schedule events'
  ) THEN
    CREATE POLICY "Members can delete org schedule events"
      ON public.schedule_events FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. public.notification_replies  (user_id scoped)
--    Existing: INSERT (own), SELECT (own)
--    Adding:   UPDATE (own), DELETE (own)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_replies'
      AND policyname = 'Users can read own replies'
  ) THEN
    CREATE POLICY "Users can read own replies"
      ON public.notification_replies FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_replies'
      AND policyname = 'Users can reply to own notifications'
  ) THEN
    CREATE POLICY "Users can reply to own notifications"
      ON public.notification_replies FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_replies'
      AND policyname = 'Users can update own replies'
  ) THEN
    CREATE POLICY "Users can update own replies"
      ON public.notification_replies FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_replies'
      AND policyname = 'Users can delete own replies'
  ) THEN
    CREATE POLICY "Users can delete own replies"
      ON public.notification_replies FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. public.client_activity_logs  (organization_id)
--    Existing: SELECT (org members), INSERT (true — system inserts)
--    Adding:   UPDATE (org members), DELETE (org members)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_activity_logs'
      AND policyname = 'Members can read client activity'
  ) THEN
    CREATE POLICY "Members can read client activity"
      ON public.client_activity_logs FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_activity_logs'
      AND policyname = 'System can insert client activity'
  ) THEN
    CREATE POLICY "System can insert client activity"
      ON public.client_activity_logs FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_activity_logs'
      AND policyname = 'Members can update client activity'
  ) THEN
    CREATE POLICY "Members can update client activity"
      ON public.client_activity_logs FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_activity_logs'
      AND policyname = 'Members can delete client activity'
  ) THEN
    CREATE POLICY "Members can delete client activity"
      ON public.client_activity_logs FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. public.automation_runs  (workspace_id -> organizations)
--    Existing: SELECT (workspace members), INSERT (true — system inserts)
--    Adding:   UPDATE (workspace members), DELETE (workspace members)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_runs'
      AND policyname = 'Members can read automation runs'
  ) THEN
    CREATE POLICY "Members can read automation runs"
      ON public.automation_runs FOR SELECT
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_runs'
      AND policyname = 'System can insert automation runs'
  ) THEN
    CREATE POLICY "System can insert automation runs"
      ON public.automation_runs FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_runs'
      AND policyname = 'Members can update automation runs'
  ) THEN
    CREATE POLICY "Members can update automation runs"
      ON public.automation_runs FOR UPDATE
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_runs'
      AND policyname = 'Members can delete automation runs'
  ) THEN
    CREATE POLICY "Members can delete automation runs"
      ON public.automation_runs FOR DELETE
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;
