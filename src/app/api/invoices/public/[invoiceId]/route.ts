/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Public endpoint — no auth required.
 * Returns invoice data for the payment page.
 * Uses service role to bypass RLS (finance tables are locked to admins).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: invoice, error } = await (supabase as any)
    .from("invoices")
    .select(`
      id,
      invoice_number,
      client_name,
      client_email,
      line_items,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      currency,
      status,
      due_date,
      organization_id,
      organizations (
        name,
        logo_url,
        brand_color_hex
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const org = invoice.organizations as any;

  return NextResponse.json({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    organization_name: org?.name || "Business",
    organization_logo: org?.logo_url || null,
    brand_color: org?.brand_color_hex || "#10B981",
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    line_items: invoice.line_items || [],
    subtotal: invoice.subtotal || 0,
    tax_rate: invoice.tax_rate || 0,
    tax_amount: invoice.tax_amount || 0,
    total: invoice.total || 0,
    currency: invoice.currency || "usd",
    status: invoice.status,
    due_date: invoice.due_date,
    org_id: invoice.organization_id,
  });
}
