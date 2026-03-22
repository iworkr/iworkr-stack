-- ============================================================================
-- @migration FixLockedRLSTables
-- @status COMPLETE
-- @description Fix missing RLS policies on locked tables (organization_roles, etc.)
-- @tables organization_roles, automation_flows, automation_queue (policies)
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. organization_roles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_roles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organization_roles' AND policyname='Org members can view roles') THEN
      CREATE POLICY "Org members can view roles" ON public.organization_roles FOR SELECT
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organization_roles' AND policyname='Admins can insert roles') THEN
      CREATE POLICY "Admins can insert roles" ON public.organization_roles FOR INSERT
        WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organization_roles' AND policyname='Admins can update roles') THEN
      CREATE POLICY "Admins can update roles" ON public.organization_roles FOR UPDATE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organization_roles' AND policyname='Admins can delete roles') THEN
      CREATE POLICY "Admins can delete roles" ON public.organization_roles FOR DELETE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')));
    END IF;
  END IF;
END $$;

-- 2. job_line_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_line_items') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_line_items' AND policyname='Members can read job line items') THEN
      CREATE POLICY "Members can read job line items" ON public.job_line_items FOR SELECT
        USING (job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_line_items' AND policyname='Members can create job line items') THEN
      CREATE POLICY "Members can create job line items" ON public.job_line_items FOR INSERT
        WITH CHECK (job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_line_items' AND policyname='Members can update job line items') THEN
      CREATE POLICY "Members can update job line items" ON public.job_line_items FOR UPDATE
        USING (job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_line_items' AND policyname='Members can delete job line items') THEN
      CREATE POLICY "Members can delete job line items" ON public.job_line_items FOR DELETE
        USING (job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')));
    END IF;
  END IF;
END $$;

-- 3. schedule_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_events') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_events' AND policyname='Members can read org schedule events') THEN
      CREATE POLICY "Members can read org schedule events" ON public.schedule_events FOR SELECT
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_events' AND policyname='Members can create org schedule events') THEN
      CREATE POLICY "Members can create org schedule events" ON public.schedule_events FOR INSERT
        WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_events' AND policyname='Members can update org schedule events') THEN
      CREATE POLICY "Members can update org schedule events" ON public.schedule_events FOR UPDATE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schedule_events' AND policyname='Members can delete org schedule events') THEN
      CREATE POLICY "Members can delete org schedule events" ON public.schedule_events FOR DELETE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
  END IF;
END $$;

-- 4. notification_replies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_replies') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_replies' AND policyname='Users can read own replies') THEN
      CREATE POLICY "Users can read own replies" ON public.notification_replies FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_replies' AND policyname='Users can reply to own notifications') THEN
      CREATE POLICY "Users can reply to own notifications" ON public.notification_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_replies' AND policyname='Users can update own replies') THEN
      CREATE POLICY "Users can update own replies" ON public.notification_replies FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_replies' AND policyname='Users can delete own replies') THEN
      CREATE POLICY "Users can delete own replies" ON public.notification_replies FOR DELETE USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- 5. client_activity_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_activity_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_activity_logs' AND policyname='Members can update client activity') THEN
      CREATE POLICY "Members can update client activity" ON public.client_activity_logs FOR UPDATE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_activity_logs' AND policyname='Members can delete client activity') THEN
      CREATE POLICY "Members can delete client activity" ON public.client_activity_logs FOR DELETE
        USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
  END IF;
END $$;

-- 6. automation_runs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_runs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_runs' AND policyname='Members can update automation runs') THEN
      CREATE POLICY "Members can update automation runs" ON public.automation_runs FOR UPDATE
        USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_runs' AND policyname='Members can delete automation runs') THEN
      CREATE POLICY "Members can delete automation runs" ON public.automation_runs FOR DELETE
        USING (workspace_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
    END IF;
  END IF;
END $$;
