/**
 * @route POST /api/invoices/generate-pdf
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Generates invoice PDF via react-pdf and returns or stores it
 * @lastAudit 2026-03-22
 */
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
import { BlockInvoiceDocument } from "@/components/finance/editor/pdf-compiler";
import type { InvoiceData, WorkspaceBrand } from "@/components/pdf/invoice-types";
import type { InvoiceBlock, GlobalSettings } from "@/components/finance/editor/types";

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
    let pdfBuffer: Buffer;
    let displayId = "Invoice";
    let invoiceIdForStorage: string | undefined;

    // Moneta-Canvas v2: block-based rendering
    if (body.blocks && body.workspace) {
      const blocks = body.blocks as InvoiceBlock[];
      const settings = (body.globalSettings || {
        brandColor: "#10B981",
        fontFamily: "Inter",
        currency: "AUD",
        taxInclusive: false,
        taxRate: 10,
        discountType: null,
        discountValue: 0,
      }) as GlobalSettings;
      const workspace = body.workspace as WorkspaceBrand;
      const metaBlock = blocks.find((b) => b.type === "meta");
      if (metaBlock) displayId = (metaBlock.content as any).displayId || displayId;

      const element = createElement(BlockInvoiceDocument, { blocks, settings, workspace });
      pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
    }
    // Legacy v1: full data + workspace payload
    else if (body.data && body.workspace) {
      const invoiceData = body.data as InvoiceData;
      const workspaceData = body.workspace as WorkspaceBrand;
      displayId = invoiceData.display_id;
      const element = createElement(InvoiceDocument, { data: invoiceData, workspace: workspaceData });
      pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
    }
    // Legacy: fetch by invoice_id
    else if (body.invoice_id) {
      invoiceIdForStorage = body.invoice_id;
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await fetchInvoicePayload(body.invoice_id);
      if (!payload) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      displayId = payload.data.display_id;

      // Check if invoice has v2 blocks
      const supabase2 = (await createServerSupabaseClient()) as any;
      const { data: inv } = await supabase2
        .from("invoices")
        .select("blocks_json, editor_version")
        .eq("id", body.invoice_id)
        .single();

      if (inv?.editor_version === 2 && inv?.blocks_json) {
        const blocks = inv.blocks_json as InvoiceBlock[];
        const settings: GlobalSettings = {
          brandColor: payload.workspace.brand_color_hex || "#10B981",
          fontFamily: "Inter",
          currency: "AUD",
          taxInclusive: false,
          taxRate: Number(payload.data.tax_rate) || 10,
          discountType: payload.data.discount_type,
          discountValue: payload.data.discount_value,
        };
        const element = createElement(BlockInvoiceDocument, { blocks, settings, workspace: payload.workspace });
        pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
      } else {
        const element = createElement(InvoiceDocument, { data: payload.data, workspace: payload.workspace });
        pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
      }
    } else {
      return NextResponse.json(
        { error: "Provide invoice_id, {data, workspace}, or {blocks, workspace}" },
        { status: 400 },
      );
    }

    if (body.save_to_storage && (body.invoice_id || invoiceIdForStorage)) {
      const targetId = body.invoice_id || invoiceIdForStorage;
      const supabase = (await createServerSupabaseClient()) as any;
      const storagePath = `${displayId.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

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
        .eq("id", targetId);

      return NextResponse.json({ url: publicUrl });
    }

    const pdfBody = new Uint8Array(
      typeof pdfBuffer === "object" && "length" in pdfBuffer
        ? (pdfBuffer as ArrayLike<number>)
        : (pdfBuffer as ArrayBuffer),
    );
    return new NextResponse(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${displayId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[invoices/generate-pdf] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
