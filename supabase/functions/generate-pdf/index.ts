/**
 * Supabase Edge Function: generate-pdf
 *
 * Receives an invoice_id, fetches the data from the database, generates
 * a PDF using the jsPDF approach (server-side compatible), uploads it to
 * Supabase Storage, and returns the signed URL.
 *
 * This is called by the Flutter mobile app and backend cron jobs.
 *
 * POST body: { invoice_id: string }
 * Response: { url: string, display_id: string }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Fetch invoice with line items and org branding
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_line_items(*)
      `)
      .eq("id", invoice_id)
      .single();

    if (fetchError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_color_hex, brand_logo_url, logo_url, settings")
      .eq("id", invoice.organization_id)
      .single();

    const orgName = org?.name || "Business";
    const brandColor = hexToRgb(org?.brand_color_hex || "#10B981");
    const settings = org?.settings || {};
    const lineItems = (invoice.invoice_line_items || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    );

    // Generate PDF with jsPDF
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 16;

    // Brand accent line
    doc.setFillColor(...brandColor);
    doc.rect(margin, y, pw - margin * 2, 2, "F");
    y += 12;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(17, 17, 17);
    doc.text(orgName, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    y += 6;
    if (settings.tax_id) {
      doc.text(`ABN: ${settings.tax_id}`, margin, y);
      y += 4;
    }
    if (settings.address) {
      doc.text(settings.address, margin, y);
      y += 4;
    }
    if (settings.email) {
      doc.text(settings.email, margin, y);
      y += 4;
    }

    // Invoice number (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    doc.text("INVOICE", pw - margin, 28, { align: "right" });

    doc.setFontSize(20);
    doc.setTextColor(...brandColor);
    doc.text(invoice.display_id || "—", pw - margin, 36, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 51, 51);
    doc.text(`Issued: ${formatDate(invoice.issue_date)}`, pw - margin, 44, { align: "right" });
    doc.text(`Due: ${formatDate(invoice.due_date)}`, pw - margin, 49, { align: "right" });

    y = Math.max(y, 58);

    // Divider
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    // Bill To
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(187, 187, 187);
    doc.text("BILL TO", margin, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 17, 17);
    doc.text(invoice.client_name || "—", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    if (invoice.client_address) {
      doc.text(invoice.client_address, margin, y);
      y += 4;
    }
    if (invoice.client_email) {
      doc.text(invoice.client_email, margin, y);
      y += 4;
    }

    y += 6;
    doc.setDrawColor(229, 229, 229);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    // Table header
    const colDesc = margin;
    const colQty = pw - margin - 70;
    const colPrice = pw - margin - 42;
    const colAmt = pw - margin;

    doc.setFillColor(...brandColor);
    doc.rect(margin, y - 3, pw - margin * 2, 0.8, "F");
    y += 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(153, 153, 153);
    doc.text("DESCRIPTION", colDesc, y);
    doc.text("QTY", colQty, y, { align: "right" });
    doc.text("UNIT PRICE", colPrice, y, { align: "right" });
    doc.text("AMOUNT", colAmt, y, { align: "right" });
    y += 8;

    // Line items
    for (const item of lineItems) {
      const lineTotal = Math.round(item.quantity * item.unit_price * 100) / 100;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(item.description || "—", colDesc, y);

      doc.setFontSize(9);
      doc.setTextColor(68, 68, 68);
      doc.text(String(item.quantity), colQty, y, { align: "right" });
      doc.text(formatCurrency(item.unit_price), colPrice, y, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 34, 34);
      doc.text(formatCurrency(lineTotal), colAmt, y, { align: "right" });

      y += 7;

      doc.setDrawColor(238, 238, 238);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 1, pw - margin, y - 1);

      if (y > 260) {
        doc.addPage();
        y = 25;
      }
    }

    y += 8;

    // Totals
    const totX = pw - margin - 50;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(136, 136, 136);
    doc.text("Subtotal", totX, y);
    doc.setTextColor(51, 51, 51);
    doc.text(formatCurrency(Number(invoice.subtotal) || 0), colAmt, y, { align: "right" });
    y += 6;

    doc.setTextColor(136, 136, 136);
    doc.text(`GST (${Number(invoice.tax_rate) || 10}%)`, totX, y);
    doc.setTextColor(51, 51, 51);
    doc.text(formatCurrency(Number(invoice.tax) || 0), colAmt, y, { align: "right" });
    y += 4;

    doc.setFillColor(...brandColor);
    doc.rect(totX - 5, y, pw - margin - totX + 5, 0.8, "F");
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text("Total", totX, y);
    doc.setTextColor(...brandColor);
    doc.text(formatCurrency(Number(invoice.total) || 0), colAmt, y, { align: "right" });

    // Notes
    if (invoice.notes) {
      y += 14;
      doc.setDrawColor(238, 238, 238);
      doc.line(margin, y, pw - margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(187, 187, 187);
      doc.text("NOTES", margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      const lines = doc.splitTextToSize(invoice.notes, pw - margin * 2);
      doc.text(lines, margin, y);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(204, 204, 204);
    doc.text(
      `${orgName} • ${invoice.display_id}`,
      margin,
      footerY,
    );
    doc.text("Powered by iWorkr", pw - margin, footerY, { align: "right" });

    // Convert to buffer and upload
    const pdfOutput = doc.output("arraybuffer");
    const pdfBytes = new Uint8Array(pdfOutput);

    const storagePath = `${(invoice.display_id || invoice.id).replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(storagePath);

    // Update invoice with PDF URL
    await supabase
      .from("invoices")
      .update({ pdf_url: urlData.publicUrl })
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({
        url: urlData.publicUrl,
        display_id: invoice.display_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
