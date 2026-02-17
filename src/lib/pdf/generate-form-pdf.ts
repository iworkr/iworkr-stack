import jsPDF from "jspdf";
import type { FormSubmission } from "@/lib/forms-data";

interface OrgInfo {
  name?: string;
  tax_id?: string;
  logo_url?: string;
}

export function downloadFormPDF(
  submission: FormSubmission,
  org: OrgInfo = {}
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  const orgName = org.name || "iWorkr";
  const orgTaxId = org.tax_id;

  /* ── Header ─────────────────────────────────── */
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pw, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(orgName, margin, 14);

  if (orgTaxId) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`ABN: ${orgTaxId}`, margin, 20);
  }

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(submission.formTitle, pw - margin, 14, { align: "right" });

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Version ${submission.formVersion} · ${submission.submittedAt}`, pw - margin, 20, { align: "right" });

  y = 40;

  /* ── Status Badge ──────────────────────────── */
  if (submission.status === "signed") {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, y, 45, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("SIGNED & LOCKED", margin + 3, y + 5);
  } else {
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(margin, y, 42, 7, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("PENDING SIGNATURE", margin + 3, y + 5);
  }
  y += 14;

  /* ── Submission Info ──────────────────────── */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Submitted by: ${submission.submittedBy}`, margin, y);
  if (submission.jobRef) doc.text(`Job: ${submission.jobRef}`, pw / 2, y);
  if (submission.clientName) doc.text(`Client: ${submission.clientName}`, pw - margin - 50, y);
  y += 8;

  /* ── Divider ────────────────────────────────── */
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  /* ── Fields ─────────────────────────────────── */
  for (const field of submission.fields) {
    if (y > 265) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(field.label.toUpperCase(), margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(220, 220, 220);

    const val = field.value === "—" ? "Not completed" : field.value;
    const lines = doc.splitTextToSize(val, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  }

  /* ── Telemetry ──────────────────────────────── */
  if (submission.telemetry && submission.status === "signed") {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    y += 4;
    doc.setDrawColor(60, 60, 60);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text("FORENSIC AUDIT TRAIL", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);

    const tel = submission.telemetry;
    const telemetryLines = [
      `GPS: ${tel.gpsLat.toFixed(6)}, ${tel.gpsLng.toFixed(6)} — ${tel.gpsAddress}`,
      `IP: ${tel.ip}  |  Browser: ${tel.browser}  |  OS: ${tel.os}`,
      `Signed: ${tel.timestamp}`,
      `SHA-256: ${tel.sha256}`,
    ];

    for (const line of telemetryLines) {
      doc.text(line, margin, y);
      y += 5;
    }
  }

  /* ── Footer ─────────────────────────────────── */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Digitally signed by ${submission.submittedBy} at ${submission.signedAt || submission.submittedAt}`,
      margin,
      290
    );
    doc.text(`Page ${p} of ${pageCount}`, pw - margin, 290, { align: "right" });
  }

  doc.save(`${submission.formTitle.replace(/\s+/g, "-")}-${submission.id.slice(0, 8)}.pdf`);
}
