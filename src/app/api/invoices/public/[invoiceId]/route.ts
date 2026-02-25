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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error("[public-invoice] NEXT_PUBLIC_SUPABASE_URL is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const key = serviceKey || anonKey;
  if (!key) {
    console.error("[public-invoice] Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false },
  });

  const { data: invoice, error: invError } = await (supabase as any)
    .from("invoices")
    .select("id, display_id, client_name, client_email, subtotal, tax_rate, tax, total, status, due_date, notes, payment_link, organization_id")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (invError) {
    console.error("[public-invoice] query error:", invError.message, invError.code, invoiceId);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice) {
    console.error("[public-invoice] no invoice found for id:", invoiceId);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const [orgResult, itemsResult] = await Promise.all([
    (supabase as any)
      .from("organizations")
      .select("name, logo_url, brand_color_hex")
      .eq("id", invoice.organization_id)
      .maybeSingle(),
    (supabase as any)
      .from("invoice_line_items")
      .select("id, description, quantity, unit_price, sort_order")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true }),
  ]);

  const org = orgResult.data;
  const lineItems = itemsResult.data || [];

  if (invoice.status === "sent") {
    await (supabase as any)
      .from("invoices")
      .update({ status: "viewed" })
      .eq("id", invoiceId)
      .eq("status", "sent");

    await (supabase as any)
      .from("invoice_events")
      .insert({
        invoice_id: invoiceId,
        type: "viewed",
        text: "Client viewed invoice",
      })
      .then(() => {})
      .catch(() => {});
  }

  return NextResponse.json({
    id: invoice.id,
    invoice_number: invoice.display_id,
    organization_name: org?.name || "Business",
    organization_logo: org?.logo_url || null,
    brand_color: org?.brand_color_hex || "#10B981",
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    line_items: lineItems.map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
    })),
    subtotal: invoice.subtotal || 0,
    tax_rate: invoice.tax_rate || 0,
    tax_amount: invoice.tax || 0,
    total: invoice.total || 0,
    currency: "aud",
    status: invoice.status,
    due_date: invoice.due_date,
    org_id: invoice.organization_id,
    notes: invoice.notes,
    payment_link: invoice.payment_link,
  });
}
