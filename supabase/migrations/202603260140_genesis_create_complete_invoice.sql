-- ============================================================================
-- @migration GenesisCreateCompleteInvoice
-- @description Atomic invoice creation RPC (header + line items + event).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_complete_invoice(
  p_org_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_client_name text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_client_address text DEFAULT NULL,
  p_status text DEFAULT 'draft',
  p_issue_date date DEFAULT current_date,
  p_due_date date DEFAULT NULL,
  p_tax_rate numeric DEFAULT 10,
  p_notes text DEFAULT NULL,
  p_payment_link text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_metadata jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_display_id text;
  v_next_num int;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_sort int := 0;
  v_due date;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access Denied: Cross-Tenant Violation';
  END IF;

  SELECT COALESCE(
    (
      SELECT MAX(
        CASE
          WHEN display_id ~ '^INV-\d+$' THEN substring(display_id FROM 5)::int
          ELSE 0
        END
      )
      FROM public.invoices
      WHERE organization_id = p_org_id
    ),
    1250
  ) + 1
  INTO v_next_num;

  v_display_id := 'INV-' || lpad(v_next_num::text, 4, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_subtotal := v_subtotal
      + (COALESCE((v_item->>'quantity')::numeric, 1)
      * COALESCE((v_item->>'unit_price')::numeric, 0));
  END LOOP;

  v_tax := round(v_subtotal * (p_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;
  v_due := COALESCE(p_due_date, p_issue_date + interval '7 days');

  INSERT INTO public.invoices (
    organization_id,
    display_id,
    client_id,
    job_id,
    client_name,
    client_email,
    client_address,
    status,
    issue_date,
    due_date,
    subtotal,
    tax_rate,
    tax,
    total,
    payment_link,
    notes,
    metadata,
    created_by
  ) VALUES (
    p_org_id,
    v_display_id,
    p_client_id,
    p_job_id,
    p_client_name,
    p_client_email,
    p_client_address,
    p_status::public.invoice_status,
    p_issue_date,
    v_due,
    v_subtotal,
    p_tax_rate,
    v_tax,
    v_total,
    p_payment_link,
    p_notes,
    p_metadata,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.invoice_line_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      sort_order
    ) VALUES (
      v_invoice_id,
      COALESCE(v_item->>'description', ''),
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.invoice_events (invoice_id, type, text)
  VALUES (v_invoice_id, 'created', 'Invoice ' || v_display_id || ' was created');

  RETURN json_build_object(
    'invoice_id', v_invoice_id,
    'display_id', v_display_id,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total
  );
END;
$$;
