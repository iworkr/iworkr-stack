-- ============================================================================
-- Migration 045: Invoice PDF Engine — "Project Ledger"
-- SAFE: All statements idempotent.
-- ============================================================================

-- Per-line tax rate override
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_line_items') THEN
    ALTER TABLE public.invoice_line_items
      ADD COLUMN IF NOT EXISTS tax_rate_percent numeric(5,4) DEFAULT NULL;
  END IF;
END $$;

-- Discount fields on invoices
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_total numeric(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pdf_url text DEFAULT NULL;
  END IF;
END $$;

-- Invoices storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoice PDFs
DO $$ BEGIN
  BEGIN
    CREATE POLICY "Org members can upload invoice PDFs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'invoices');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "Anyone can read invoice PDFs"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'invoices');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
