-- ============================================================================
-- Migration 043: Push Notification FCM Trigger
-- ============================================================================
-- pg_net already enabled in 001_extensions.sql

-- Add FCM token storage to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true;

-- Fires the send-push Edge Function via pg_net when a notification is inserted
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

CREATE TRIGGER trg_fire_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fire_push_notification();
