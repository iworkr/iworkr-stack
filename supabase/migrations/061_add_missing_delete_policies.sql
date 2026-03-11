-- ============================================================================
-- Migration 061: Add Missing DELETE RLS Policies
-- SAFE: All statements wrapped with table + policy existence checks.
-- ============================================================================

-- Helper macro: for each table, check existence then add policy
-- 1. client_contacts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_contacts')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_contacts' AND policyname='Members can delete client contacts') THEN
    CREATE POLICY "Members can delete client contacts" ON public.client_contacts FOR DELETE
      USING (client_id IN (SELECT c.id FROM public.clients c JOIN public.organization_members om ON om.organization_id = c.organization_id WHERE om.user_id = auth.uid() AND om.status = 'active'));
  END IF;
END $$;

-- 2. job_subtasks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_subtasks')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_subtasks' AND policyname='Members can delete job subtasks') THEN
    CREATE POLICY "Members can delete job subtasks" ON public.job_subtasks FOR DELETE
      USING (job_id IN (SELECT j.id FROM public.jobs j JOIN public.organization_members om ON om.organization_id = j.organization_id WHERE om.user_id = auth.uid() AND om.status = 'active'));
  END IF;
END $$;

-- 3. job_activity
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_activity')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='job_activity' AND policyname='Members can delete job activity') THEN
    CREATE POLICY "Members can delete job activity" ON public.job_activity FOR DELETE
      USING (job_id IN (SELECT j.id FROM public.jobs j JOIN public.organization_members om ON om.organization_id = j.organization_id WHERE om.user_id = auth.uid() AND om.status = 'active'));
  END IF;
END $$;

-- 4. invoice_line_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_line_items')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_line_items' AND policyname='Members can delete invoice line items') THEN
    CREATE POLICY "Members can delete invoice line items" ON public.invoice_line_items FOR DELETE
      USING (invoice_id IN (SELECT i.id FROM public.invoices i JOIN public.organization_members om ON om.organization_id = i.organization_id WHERE om.user_id = auth.uid() AND om.status = 'active'));
  END IF;
END $$;

-- 5. invoice_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_events')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_events' AND policyname='Members can delete invoice events') THEN
    CREATE POLICY "Members can delete invoice events" ON public.invoice_events FOR DELETE
      USING (invoice_id IN (SELECT i.id FROM public.invoices i JOIN public.organization_members om ON om.organization_id = i.organization_id WHERE om.user_id = auth.uid() AND om.status = 'active'));
  END IF;
END $$;

-- 6. payouts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payouts')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payouts' AND policyname='Members can delete org payouts') THEN
    CREATE POLICY "Members can delete org payouts" ON public.payouts FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 7. assets
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assets')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assets' AND policyname='Members can delete org assets') THEN
    CREATE POLICY "Members can delete org assets" ON public.assets FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 8. inventory_items
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inventory_items')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_items' AND policyname='Members can delete org inventory') THEN
    CREATE POLICY "Members can delete org inventory" ON public.inventory_items FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 9. asset_audits
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='asset_audits')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asset_audits' AND policyname='Members can delete org asset audits') THEN
    CREATE POLICY "Members can delete org asset audits" ON public.asset_audits FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 10. forms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='forms')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forms' AND policyname='Members can delete org forms') THEN
    CREATE POLICY "Members can delete org forms" ON public.forms FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 11. form_submissions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='form_submissions')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_submissions' AND policyname='Members can delete org submissions') THEN
    CREATE POLICY "Members can delete org submissions" ON public.form_submissions FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;

-- 12. notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Users can delete own notifications') THEN
    CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 13. integrations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='integrations')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='integrations' AND policyname='Admins can delete org integrations') THEN
    CREATE POLICY "Admins can delete org integrations" ON public.integrations FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')));
  END IF;
END $$;

-- 14. automation_flows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_flows' AND policyname='Admins can delete org automation flows') THEN
    CREATE POLICY "Admins can delete org automation flows" ON public.automation_flows FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')));
  END IF;
END $$;

-- 15. automation_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_logs')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_logs' AND policyname='Members can delete org automation logs') THEN
    CREATE POLICY "Members can delete org automation logs" ON public.automation_logs FOR DELETE
      USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
END $$;
