"use client";

// NDIS-compliant invoice PDF template using @react-pdf/renderer
// Rendered on-the-fly in browser. Contains:
//   - Provider ABN + NDIS Registration Number
//   - Participant NDIS Number
//   - Line items with 15-character support item codes
//   - Strict NDIS formatting requirements

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  BlobProvider,
} from "@react-pdf/renderer";
import type { BillingInvoice, InvoiceLineItem } from "@/app/actions/billing";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 40,
    backgroundColor: "#FFFFFF",
    color: "#111111",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    paddingBottom: 20,
  },
  providerBlock: { maxWidth: 260 },
  providerName: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  providerMeta: { fontSize: 8, color: "#666666", lineHeight: 1.4 },
  invoiceTitle: { textAlign: "right" },
  invoiceTitleText: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: "#10B981" },
  invoiceNumber: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 4 },
  invoiceDate: { fontSize: 8, color: "#666666", marginTop: 4 },
  // Party block (participant / plan manager)
  partyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  partyBlock: { maxWidth: "48%", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 4 },
  partyLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#999999",
    marginBottom: 6,
  },
  partyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyMeta: { fontSize: 8, color: "#555555", lineHeight: 1.5 },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#111111",
    color: "#FFFFFF",
    paddingVertical: 7,
    paddingHorizontal: 6,
    marginTop: 16,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableRowAlt: { backgroundColor: "#FAFAFA" },
  colDate: { width: "8%", fontFamily: "Courier" },
  colCode: { width: "22%", fontFamily: "Courier" },
  colDesc: { width: "30%" },
  colHours: { width: "10%", textAlign: "right", fontFamily: "Courier" },
  colRate: { width: "14%", textAlign: "right", fontFamily: "Courier" },
  colTotal: { width: "16%", textAlign: "right", fontFamily: "Courier-Bold" },
  cellText: { fontSize: 8, color: "#333333" },
  cellMono: { fontSize: 8, fontFamily: "Courier", color: "#333333" },
  // Totals
  totalsBlock: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  totalLabel: { fontSize: 9, color: "#666666" },
  totalValue: { fontSize: 9, fontFamily: "Courier", color: "#333333" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#111111",
    marginTop: 4,
    borderRadius: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  grandValue: { fontSize: 11, fontFamily: "Courier-Bold", color: "#10B981" },
  // Notes
  notesBlock: { marginTop: 20, padding: 12, backgroundColor: "#F8F9FA", borderRadius: 4 },
  notesLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#999999", marginBottom: 6 },
  notesText: { fontSize: 8, color: "#555555", lineHeight: 1.6 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#AAAAAA" },
  ndisTag: {
    fontSize: 7,
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NdisInvoicePdfProps {
  invoice: BillingInvoice;
  lineItems: InvoiceLineItem[];
  orgMeta: {
    name: string;
    abn: string;
    ndis_reg: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

function formatAUD(val: number | null | undefined): string {
  return `$${(Number(val ?? 0)).toFixed(2)}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fundingTypeLabel(ft: string): string {
  const labels: Record<string, string> = {
    plan_managed: "Plan Managed",
    self_managed: "Self Managed",
    ndia_managed: "NDIA Managed (Agency)",
  };
  return labels[ft] || ft;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function NdisInvoiceDocument({
  invoice,
  lineItems,
  orgMeta,
}: NdisInvoicePdfProps) {
  const subtotal = lineItems.reduce(
    (sum, li) => sum + Number(li.line_total != null ? li.line_total : li.quantity * li.unit_price),
    0,
  );
  const gstNote = "GST does not apply to NDIS supports (GST-free supply under Div 38-S GSTA99)";

  return (
    <Document
      title={`${invoice.display_id} — ${invoice.participant_name}`}
      author={orgMeta.name}
      subject="NDIS Support Services Invoice"
      creator="iWorkr Billing Engine"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.providerBlock}>
            <Text style={styles.providerName}>{orgMeta.name}</Text>
            {orgMeta.abn && (
              <Text style={styles.providerMeta}>ABN: {orgMeta.abn}</Text>
            )}
            {orgMeta.ndis_reg && (
              <Text style={styles.providerMeta}>
                NDIS Registration: {orgMeta.ndis_reg}
              </Text>
            )}
            {orgMeta.address && (
              <Text style={styles.providerMeta}>{orgMeta.address}</Text>
            )}
            {orgMeta.phone && (
              <Text style={styles.providerMeta}>P: {orgMeta.phone}</Text>
            )}
            {orgMeta.email && (
              <Text style={styles.providerMeta}>E: {orgMeta.email}</Text>
            )}
          </View>
          <View style={styles.invoiceTitle}>
            <Text style={styles.invoiceTitleText}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.display_id}</Text>
            <Text style={styles.invoiceDate}>
              Issued: {formatDate(invoice.issue_date)}
            </Text>
            <Text style={styles.invoiceDate}>
              Due: {formatDate(invoice.due_date)}
            </Text>
            <Text style={[styles.invoiceDate, { marginTop: 6, color: "#10B981", fontFamily: "Helvetica-Bold" }]}>
              {fundingTypeLabel(invoice.funding_type)}
            </Text>
          </View>
        </View>

        {/* ── Party Details ── */}
        <View style={styles.partyRow}>
          {/* Participant */}
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Participant Details</Text>
            <Text style={styles.partyName}>{invoice.participant_name}</Text>
            {invoice.ndis_participant_number && (
              <Text style={styles.partyMeta}>
                NDIS Number: {invoice.ndis_participant_number}
              </Text>
            )}
            {invoice.billing_period_start && (
              <Text style={styles.partyMeta}>
                Service Period:{" "}
                {formatDate(invoice.billing_period_start)}
                {invoice.billing_period_end
                  ? ` – ${formatDate(invoice.billing_period_end)}`
                  : ""}
              </Text>
            )}
          </View>
          {/* Plan Manager / Billing To */}
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill To</Text>
            {invoice.funding_type === "plan_managed" && invoice.plan_manager_name ? (
              <>
                <Text style={styles.partyName}>{invoice.plan_manager_name}</Text>
                {invoice.plan_manager_email && (
                  <Text style={styles.partyMeta}>{invoice.plan_manager_email}</Text>
                )}
                <Text style={[styles.partyMeta, { marginTop: 4, color: "#10B981" }]}>
                  Plan Manager
                </Text>
              </>
            ) : invoice.funding_type === "self_managed" ? (
              <>
                <Text style={styles.partyName}>{invoice.participant_name}</Text>
                {invoice.client_email && (
                  <Text style={styles.partyMeta}>{invoice.client_email}</Text>
                )}
                <Text style={[styles.partyMeta, { marginTop: 4 }]}>
                  Self Managed — Payable by Participant
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.partyName}>National Disability Insurance Agency</Text>
                <Text style={styles.partyMeta}>ndia.gov.au</Text>
                <Text style={[styles.partyMeta, { marginTop: 4, color: "#3B82F6" }]}>
                  PRODA / PACE Claim
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ── Line Items Table ── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
          <Text style={[styles.tableHeaderText, styles.colCode]}>Support Item #</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.colHours]}>Hrs</Text>
          <Text style={[styles.tableHeaderText, styles.colRate]}>Rate/Hr</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>

        {lineItems
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((li, idx) => {
            const hours = Number(li.hours != null ? li.hours : li.quantity);
            const rate = Number(li.rate != null ? li.rate : li.unit_price);
            const total = Number(li.line_total != null ? li.line_total : hours * rate);

            return (
              <View
                key={li.id}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.cellMono, styles.colDate]}>
                  {li.shift_date
                    ? new Date(li.shift_date).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit" })
                    : ""}
                </Text>
                <Text style={[styles.cellMono, styles.colCode, { fontSize: 7 }]}>
                  {li.ndis_support_item_number || "—"}
                </Text>
                <Text style={[styles.cellText, styles.colDesc]}>
                  {li.description || "Support Services"}
                  {li.is_override ? " *" : ""}
                </Text>
                <Text style={[styles.cellMono, styles.colHours]}>
                  {hours.toFixed(2)}
                </Text>
                <Text style={[styles.cellMono, styles.colRate]}>
                  {formatAUD(rate)}
                </Text>
                <Text style={[styles.cellMono, styles.colTotal]}>
                  {formatAUD(total)}
                </Text>
              </View>
            );
          })}

        {/* ── Totals ── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatAUD(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (0%)</Text>
            <Text style={styles.totalValue}>$0.00</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandLabel}>TOTAL DUE (AUD)</Text>
            <Text style={styles.grandValue}>{formatAUD(invoice.total || subtotal)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>Important Notes</Text>
          <Text style={styles.notesText}>
            {gstNote}{"\n"}
            Please quote invoice number {invoice.display_id} in all correspondence and payments.
            {invoice.funding_type === "plan_managed"
              ? "\nThis invoice is payable by the Plan Manager. Participant funds will be used for payment."
              : invoice.funding_type === "self_managed"
              ? "\nThis invoice is payable directly by the participant or their nominee."
              : "\nThis claim is to be submitted via the PRODA/PACE portal."}
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {orgMeta.name}
            {orgMeta.abn ? ` | ABN ${orgMeta.abn}` : ""}
            {orgMeta.ndis_reg ? ` | NDIS Reg ${orgMeta.ndis_reg}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={styles.ndisTag}>NDIS</Text>
            <Text style={styles.footerText}>{invoice.display_id}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Preview Component (renders inside a fixed-height container) ──────────────

export function NdisInvoicePdfPreview({
  invoice,
  lineItems,
  orgMeta,
}: NdisInvoicePdfProps) {
  return (
    <PDFViewer
      width="100%"
      height="300"
      style={{ border: "none", borderRadius: 6 }}
      showToolbar={false}
    >
      <NdisInvoiceDocument
        invoice={invoice}
        lineItems={lineItems}
        orgMeta={orgMeta}
      />
    </PDFViewer>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function NdisInvoiceDownloadButton({
  invoice,
  lineItems,
  orgMeta,
}: NdisInvoicePdfProps) {
  return (
    <BlobProvider
      document={
        <NdisInvoiceDocument
          invoice={invoice}
          lineItems={lineItems}
          orgMeta={orgMeta}
        />
      }
    >
      {({ url, loading }) => (
        <a
          href={url || "#"}
          download={`${invoice.display_id}.pdf`}
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {loading ? "Generating PDF..." : "Download PDF"}
        </a>
      )}
    </BlobProvider>
  );
}
