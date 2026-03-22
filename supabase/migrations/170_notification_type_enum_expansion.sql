-- ============================================================================
-- @migration NotificationTypeEnumExpansion
-- @status COMPLETE
-- @description Compatibility patch — add missing notification_type enum values
-- @tables (none — enum expansion: notification_type)
-- @lastAudit 2026-03-22
-- ============================================================================
-- Compatibility patch: notification types used by later triggers/seed data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'notification_type'
        AND e.enumlabel = 'job_cancelled'
    ) THEN
      ALTER TYPE public.notification_type ADD VALUE 'job_cancelled';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'notification_type'
        AND e.enumlabel = 'job_rescheduled'
    ) THEN
      ALTER TYPE public.notification_type ADD VALUE 'job_rescheduled';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'notification_type'
        AND e.enumlabel = 'message_received'
    ) THEN
      ALTER TYPE public.notification_type ADD VALUE 'message_received';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'notification_type'
        AND e.enumlabel = 'compliance_warning'
    ) THEN
      ALTER TYPE public.notification_type ADD VALUE 'compliance_warning';
    END IF;
  END IF;
END $$;
