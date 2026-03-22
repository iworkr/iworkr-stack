-- ============================================================================
-- @migration PushNotificationTrigger
-- @status COMPLETE
-- @description FCM push notification trigger on notification insert
-- @tables profiles (altered — fcm_token, push_enabled)
-- @lastAudit 2026-03-22
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true;

CREATE OR REPLACE FUNCTION public.fire_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _base_url text;
  _anon_key text;
BEGIN
  IF NEW.type NOT IN (
    'job_assigned', 'job_cancelled', 'job_rescheduled',
    'message_received', 'invoice_paid', 'schedule_conflict',
    'compliance_warning', 'mention'
  ) THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF _base_url IS NOT NULL AND _anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    DROP TRIGGER IF EXISTS trg_fire_push_notification ON public.notifications;
    CREATE TRIGGER trg_fire_push_notification
      AFTER INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.fire_push_notification();
  ELSE
    RAISE NOTICE '[043] Skipping push notification trigger — notifications table not found.';
  END IF;
END $$;
