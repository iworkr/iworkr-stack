import jsPDF from "jspdf";
import type { Invoice } from "@/lib/data";

/**
 * Generate and download a PDF for the given invoice.
 * Uses jsPDF to create a professional invoice layout.
 */
export function downloadInvoicePDF(
  invoice: Invoice,
  orgName: string = "iWorkr",
  orgTaxId?: string,
  orgAddress: string = "",
  orgEmail: string = ""
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  /* ── Helpers ──────────────────────────────────────── */
  const setFont = (style: "normal" | "bold", size: number, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };

  const drawLine = (yPos: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pw - margin, yPos);
  };

  /* ── Header ───────────────────────────────────────── */
  setFont("bold", 22);
  doc.text(orgName, margin, y);

  setFont("normal", 9, [120, 120, 120]);
  y += 6;
  if (orgTaxId) {
    doc.text(`Tax ID: ${orgTaxId}`, margin, y);
    y += 4;
  }
  if (orgAddress) {
    doc.text(orgAddress, margin, y);
    y += 4;
  }
  if (orgEmail) {
    doc.text(orgEmail, margin, y);
    y += 4;
  }

  /* Invoice ID & Dates (right-aligned) */
  setFont("bold", 16, [30, 30, 30]);
  doc.text(invoice.id, pw - margin, 25, { align: "right" });

  setFont("normal", 9, [120, 120, 120]);
  doc.text(`Issued: ${invoice.issueDate}`, pw - margin, 33, { align: "right" });
  doc.text(`Due: ${invoice.dueDate}`, pw - margin, 37, { align: "right" });
  if (invoice.paidDate) {
    setFont("normal", 9, [34, 197, 94]);
    doc.text(`Paid: ${invoice.paidDate}`, pw - margin, 41, { align: "right" });
  }

  /* Status badge */
  const statusLabels: Record<string, string> = {
    draft: "DRAFT",
    sent: "SENT",
    paid: "PAID",
    overdue: "OVERDUE",
    voided: "VOIDED",
  };
  const statusColors: Record<string, [number, number, number]> = {
    draft: [120, 120, 120],
    sent: [59, 130, 246],
    paid: [34, 197, 94],
    overdue: [239, 68, 68],
    voided: [120, 120, 120],
  };
  setFont("bold", 10, statusColors[invoice.status] || [120, 120, 120]);
  doc.text(statusLabels[invoice.status] || invoice.status.toUpperCase(), pw - margin, 47, { align: "right" });

  y = Math.max(y, 52);
  drawLine(y);
  y += 8;

  /* ── Bill To ──────────────────────────────────────── */
  setFont("bold", 8, [120, 120, 120]);
  doc.text("BILL TO", margin, y);
  y += 5;
  setFont("bold", 11, [30, 30, 30]);
  doc.text(invoice.clientName || "—", margin, y);
  y += 5;
  setFont("normal", 9, [100, 100, 100]);
  if (invoice.clientAddress) {
    doc.text(invoice.clientAddress, margin, y);
    y += 4;
  }
  if (invoice.clientEmail) {
    doc.text(invoice.clientEmail, margin, y);
    y += 4;
  }

  y += 6;
  drawLine(y);
  y += 6;

  /* ── Line Items Table ─────────────────────────────── */
  const colDesc = margin;
  const colQty = pw - margin - 70;
  const colPrice = pw - margin - 42;
  const colAmt = pw - margin;

  // Header row
  setFont("bold", 8, [120, 120, 120]);
  doc.text("DESCRIPTION", colDesc, y);
  doc.text("QTY", colQty, y, { align: "right" });
  doc.text("UNIT PRICE", colPrice, y, { align: "right" });
  doc.text("AMOUNT", colAmt, y, { align: "right" });
  y += 3;
  drawLine(y);
  y += 6;

  // Rows
  setFont("normal", 10, [50, 50, 50]);
  for (const li of invoice.lineItems) {
    const lineTotal = li.quantity * li.unitPrice;
    doc.text(li.description || "—", colDesc, y);
    doc.text(String(li.quantity), colQty, y, { align: "right" });
    doc.text(`$${li.unitPrice.toLocaleString()}`, colPrice, y, { align: "right" });
    setFont("bold", 10, [30, 30, 30]);
    doc.text(`$${lineTotal.toLocaleString()}`, colAmt, y, { align: "right" });
    setFont("normal", 10, [50, 50, 50]);
    y += 7;

    if (y > 260) {
      doc.addPage();
      y = 25;
    }
  }

  y += 4;
  drawLine(y);
  y += 8;

  /* ── Totals ───────────────────────────────────────── */
  const totalsX = pw - margin - 40;

  setFont("normal", 10, [100, 100, 100]);
  doc.text("Subtotal", totalsX, y);
  doc.text(`$${invoice.subtotal.toLocaleString()}`, colAmt, y, { align: "right" });
  y += 6;

  doc.text("GST (10%)", totalsX, y);
  doc.text(`$${invoice.tax.toLocaleString()}`, colAmt, y, { align: "right" });
  y += 3;
  drawLine(y);
  y += 6;

  setFont("bold", 14, [20, 20, 20]);
  doc.text("Total", totalsX, y);
  doc.text(`$${invoice.total.toLocaleString()}`, colAmt, y, { align: "right" });

  /* ── Notes ────────────────────────────────────────── */
  if (invoice.notes) {
    y += 12;
    drawLine(y);
    y += 6;
    setFont("bold", 8, [120, 120, 120]);
    doc.text("NOTES", margin, y);
    y += 5;
    setFont("normal", 9, [80, 80, 80]);
    const lines = doc.splitTextToSize(invoice.notes, pw - margin * 2);
    doc.text(lines, margin, y);
  }

  /* ── Footer ───────────────────────────────────────── */
  const footerY = doc.internal.pageSize.getHeight() - 12;
  setFont("normal", 7, [180, 180, 180]);
  doc.text(`Generated by ${orgName} — ${new Date().toLocaleDateString()}`, pw / 2, footerY, { align: "center" });

  /* ── Download ─────────────────────────────────────── */
  doc.save(`${invoice.id}.pdf`);
}
