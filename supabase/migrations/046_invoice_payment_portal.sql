-- ============================================================================
-- Migration 046: Invoice Payment Portal
-- Adds secure_token to invoices for public portal access,
-- auto-generates payment_link on insert, and backfills existing invoices.
-- ============================================================================

-- 1. Add secure_token column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS secure_token text;

-- 2. Unique index on secure_token for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_secure_token
  ON public.invoices (secure_token)
  WHERE secure_token IS NOT NULL;

-- 3. Trigger function to auto-generate secure_token and payment_link on insert
CREATE OR REPLACE FUNCTION public.invoice_auto_token()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.secure_token IS NULL THEN
    NEW.secure_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  IF NEW.payment_link IS NULL OR NEW.payment_link = '' THEN
    NEW.payment_link := 'https://iworkrapp.com/pay/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_auto_token ON public.invoices;
CREATE TRIGGER trg_invoice_auto_token
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invoice_auto_token();

-- 4. Backfill existing invoices with secure_token and payment_link
UPDATE public.invoices
  SET secure_token = encode(gen_random_bytes(24), 'hex')
  WHERE secure_token IS NULL;

UPDATE public.invoices
  SET payment_link = 'https://iworkrapp.com/pay/' || id::text
  WHERE payment_link IS NULL OR payment_link = '';
