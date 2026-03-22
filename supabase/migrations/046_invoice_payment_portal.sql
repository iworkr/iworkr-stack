-- ============================================================================
-- @migration InvoicePaymentPortal
-- @status COMPLETE
-- @description Invoice payment portal — secure tokens, public invoice access
-- @tables invoices (altered — secure_token)
-- @lastAudit 2026-03-22
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN
    -- 1. Add secure_token column
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS secure_token text;

    -- 2. Unique index on secure_token
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_secure_token
      ON public.invoices (secure_token)
      WHERE secure_token IS NOT NULL;

    -- 3. Trigger function to auto-generate secure_token and payment_link
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.invoice_auto_token()
      RETURNS trigger
      LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.secure_token IS NULL THEN
          NEW.secure_token := encode(gen_random_bytes(24), 'hex');
        END IF;
        IF NEW.payment_link IS NULL OR NEW.payment_link = '' THEN
          NEW.payment_link := 'https://iworkrapp.com/pay/' || NEW.id::text;
        END IF;
        RETURN NEW;
      END;
      $body$;
    $fn$;

    DROP TRIGGER IF EXISTS trg_invoice_auto_token ON public.invoices;
    CREATE TRIGGER trg_invoice_auto_token
      BEFORE INSERT ON public.invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.invoice_auto_token();

    -- 4. Backfill existing invoices
    UPDATE public.invoices
      SET secure_token = encode(gen_random_bytes(24), 'hex')
      WHERE secure_token IS NULL;

    UPDATE public.invoices
      SET payment_link = 'https://iworkrapp.com/pay/' || id::text
      WHERE payment_link IS NULL OR payment_link = '';
  ELSE
    RAISE NOTICE '[046] Skipping — invoices table not found.';
  END IF;
END $$;
