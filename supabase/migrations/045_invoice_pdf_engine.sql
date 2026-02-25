-- ============================================================================
-- Migration 045: Invoice PDF Engine — "Project Ledger"
-- ============================================================================
-- Adds columns for discount support, per-line tax overrides, and PDF storage.
-- Creates the 'invoices' storage bucket for generated PDFs.
-- ============================================================================

-- Per-line tax rate override (null = use workspace default)
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric(5,4) DEFAULT NULL;

-- Discount fields on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_url text DEFAULT NULL;

-- Invoices storage bucket (public for client portal access)
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
