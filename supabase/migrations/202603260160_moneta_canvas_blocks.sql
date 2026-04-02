-- ============================================================================
-- @migration MonetaCanvasBlocks
-- @status COMPLETE
-- @description Project Moneta-Canvas — add block-based editor state to invoices
-- @tables invoices (altered — blocks_json, editor_version)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS blocks_json jsonb DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS editor_version integer DEFAULT 1;

    COMMENT ON COLUMN public.invoices.blocks_json IS
      'JSON array of InvoiceBlock objects for the Moneta-Canvas WYSIWYG editor. NULL for legacy v1 invoices.';
    COMMENT ON COLUMN public.invoices.editor_version IS
      '1 = legacy form-based, 2 = Moneta-Canvas block editor';
  END IF;
END $$;
