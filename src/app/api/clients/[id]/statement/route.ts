/**
 * GET /api/clients/[id]/statement
 *
 * Generates a PDF statement for a client listing all their invoices and payments.
 * Uses @react-pdf/renderer with the same pattern as /api/invoices/generate-pdf.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatementDocument } from "@/components/pdf/statement-document";
import type { StatementData, StatementInvoice } from "@/components/pdf/statement-document";
import type { WorkspaceBrand } from "@/components/pdf/invoice-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clientId } = await params;

    const supabase = (await createServerSupabaseClient()) as any;

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch client with org info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select(`
        id,
        name,
        email,
        address,
        organization_id,
        organizations!inner(
          name,
          logo_url,
          brand_color_hex,
          brand_logo_url,
          settings
        )
      `)
      .eq("id", clientId)
      .is("deleted_at", null)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", client.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all invoices for this client
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("id, display_id, status, issue_date, due_date, total")
      .eq("client_id", clientId)
      .eq("organization_id", client.organization_id)
      .order("issue_date", { ascending: false });

    if (invoicesError) {
      return NextResponse.json(
        { error: invoicesError.message },
        { status: 500 },
      );
    }

    // Fetch payments for these invoices
    const invoiceIds = (invoices || []).map((inv: any) => inv.id);
    const paymentsByInvoice: Record<string, number> = {};

    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
        .eq("status", "completed");

      if (payments) {
        for (const p of payments) {
          paymentsByInvoice[p.invoice_id] =
            (paymentsByInvoice[p.invoice_id] || 0) + (Number(p.amount) || 0);
        }
      }
    }

    // Build statement data
    const org = client.organizations;
    const settings = (org.settings || {}) as Record<string, any>;

    const workspace: WorkspaceBrand = {
      name: org.name,
      logo_url: org.brand_logo_url || org.logo_url || null,
      brand_color_hex: org.brand_color_hex || "#10B981",
      tax_id: settings.tax_id || null,
      address: settings.address || null,
      email: settings.email || null,
      phone: settings.phone || null,
    };

    let totalInvoiced = 0;
    let totalPaid = 0;

    const statementInvoices: StatementInvoice[] = (invoices || []).map((inv: any) => {
      const total = Number(inv.total) || 0;
      const amountPaid = inv.status === "paid"
        ? total
        : (paymentsByInvoice[inv.id] || 0);
      const balance = Math.max(0, Math.round((total - amountPaid) * 100) / 100);

      totalInvoiced += total;
      totalPaid += amountPaid;

      return {
        display_id: inv.display_id,
        status: inv.status,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        total,
        amount_paid: amountPaid,
        balance,
      };
    });

    const statementData: StatementData = {
      client_name: client.name,
      client_email: client.email || null,
      client_address: client.address || null,
      generated_at: new Date().toISOString(),
      invoices: statementInvoices,
      total_invoiced: Math.round(totalInvoiced * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
    };

    // Generate PDF
    const element = createElement(StatementDocument, {
      data: statementData,
      workspace,
    });
    const pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

    const pdfBody = new Uint8Array(
      typeof pdfBuffer === "object" && "length" in pdfBuffer
        ? (pdfBuffer as ArrayLike<number>)
        : (pdfBuffer as ArrayBuffer),
    );

    const safeClientName = client.name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_");

    return new NextResponse(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Statement_${safeClientName}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("Statement PDF generation error:", err);
    return NextResponse.json(
      { error: err.message || "Statement generation failed" },
      { status: 500 },
    );
  }
}
