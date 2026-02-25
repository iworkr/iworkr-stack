/**
 * POST /api/invoices/generate-pdf
 *
 * Server-side PDF generation using @react-pdf/renderer.
 * Accepts { invoice_id } or a full { data, workspace } payload.
 * Returns the PDF as application/pdf or saves to Supabase Storage.
 */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InvoiceDocument } from "@/components/pdf/invoice-document";
import type { InvoiceData, WorkspaceBrand } from "@/components/pdf/invoice-types";

export const runtime = "nodejs";
export const maxDuration = 30;

async function fetchInvoicePayload(
  invoiceId: string,
): Promise<{ data: InvoiceData; workspace: WorkspaceBrand } | null> {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      invoice_line_items(*),
      organizations!inner(
        name,
        logo_url,
        brand_color_hex,
        brand_logo_url,
        settings
      )
    `,
    )
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) return null;

  const org = invoice.organizations;
  const settings = org.settings || {};

  const workspace: WorkspaceBrand = {
    name: org.name,
    logo_url: org.brand_logo_url || org.logo_url || null,
    brand_color_hex: org.brand_color_hex || "#10B981",
    tax_id: settings.tax_id || null,
    address: settings.address || null,
    email: settings.email || null,
    phone: settings.phone || null,
  };

  const lineItems = (invoice.invoice_line_items || [])
    .sort(
      (a: { sort_order: number }, b: { sort_order: number }) =>
        a.sort_order - b.sort_order,
    )
    .map(
      (li: {
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        tax_rate_percent: number | null;
        sort_order: number;
      }) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        tax_rate_percent: li.tax_rate_percent,
        sort_order: li.sort_order,
      }),
    );

  const data: InvoiceData = {
    display_id: invoice.display_id,
    status: invoice.status,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    paid_date: invoice.paid_date,
    client_name: invoice.client_name || "—",
    client_email: invoice.client_email,
    client_address: invoice.client_address,
    line_items: lineItems,
    subtotal: Number(invoice.subtotal) || 0,
    tax_rate: Number(invoice.tax_rate) || 10,
    tax: Number(invoice.tax) || 0,
    discount_type: invoice.discount_type || null,
    discount_value: Number(invoice.discount_value) || 0,
    discount_total: Number(invoice.discount_total) || 0,
    total: Number(invoice.total) || 0,
    notes: invoice.notes,
    payment_link: invoice.payment_link,
  };

  return { data, workspace };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let invoiceData: InvoiceData;
    let workspaceData: WorkspaceBrand;

    if (body.invoice_id) {
      const payload = await fetchInvoicePayload(body.invoice_id);
      if (!payload) {
        return NextResponse.json(
          { error: "Invoice not found or unauthorized" },
          { status: 404 },
        );
      }
      invoiceData = payload.data;
      workspaceData = payload.workspace;
    } else if (body.data && body.workspace) {
      invoiceData = body.data;
      workspaceData = body.workspace;
    } else {
      return NextResponse.json(
        { error: "Provide invoice_id or {data, workspace}" },
        { status: 400 },
      );
    }

    const element = createElement(InvoiceDocument, {
      data: invoiceData,
      workspace: workspaceData,
    });
    const pdfBuffer = await renderToBuffer(element);

    if (body.save_to_storage && body.invoice_id) {
      const supabase = (await createServerSupabaseClient()) as any;
      const storagePath = `${invoiceData.display_id.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

      await supabase.storage
        .from("invoices")
        .upload(storagePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      const {
        data: { publicUrl },
      } = supabase.storage.from("invoices").getPublicUrl(storagePath);

      await supabase
        .from("invoices")
        .update({ pdf_url: publicUrl })
        .eq("id", body.invoice_id);

      return NextResponse.json({ url: publicUrl });
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoiceData.display_id}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: err.message || "PDF generation failed" },
      { status: 500 },
    );
  }
}
