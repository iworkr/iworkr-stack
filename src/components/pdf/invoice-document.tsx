/**
 * Isomorphic Invoice PDF Template — @react-pdf/renderer
 *
 * This single component is the source of truth for both:
 *  1. The live <PDFViewer> in the web split-pane builder
 *  2. Server-side renderToStream() in the Edge Function / API route
 *
 * Dynamic branding is injected via the `workspace` prop.
 * All monetary values are pre-calculated and passed in — no math here,
 * only layout and formatting.
 */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceData, WorkspaceBrand } from "./invoice-types";
import { formatCurrency, formatDate, calcLineTotal } from "./invoice-types";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "JetBrains Mono",
  src: "https://fonts.gstatic.com/s/jetbrainsmono/v20/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf",
});

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function lightenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(h.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(h.substring(4, 6), 16) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

const createStyles = (brandColor: string) =>
  StyleSheet.create({
    page: {
      fontFamily: "Inter",
      fontSize: 10,
      color: "#1a1a1a",
      paddingTop: 40,
      paddingBottom: 60,
      paddingHorizontal: 40,
      backgroundColor: "#ffffff",
    },
    /* Header */
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 30,
    },
    headerLeft: {
      flexDirection: "column",
      maxWidth: "55%",
    },
    logo: {
      maxHeight: 48,
      maxWidth: 160,
      objectFit: "contain" as const,
      marginBottom: 8,
    },
    orgName: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 18,
      color: "#111111",
      marginBottom: 4,
    },
    orgDetail: {
      fontSize: 8,
      color: "#888888",
      lineHeight: 1.5,
    },
    headerRight: {
      alignItems: "flex-end" as const,
    },
    invoiceLabel: {
      fontFamily: "JetBrains Mono",
      fontSize: 10,
      color: "#aaaaaa",
      letterSpacing: 2,
      marginBottom: 4,
    },
    invoiceNumber: {
      fontFamily: "JetBrains Mono",
      fontWeight: 700,
      fontSize: 20,
      color: hexToRgb(brandColor),
      marginBottom: 8,
    },
    dateRow: {
      flexDirection: "row",
      gap: 4,
      marginBottom: 2,
    },
    dateLabel: {
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 8,
      color: "#999999",
      width: 50,
    },
    dateValue: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      color: "#333333",
    },
    statusBadge: {
      marginTop: 8,
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 4,
      alignSelf: "flex-end" as const,
    },
    statusText: {
      fontFamily: "JetBrains Mono",
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 1.5,
    },
    /* Divider */
    divider: {
      height: 1,
      backgroundColor: "#e5e5e5",
      marginVertical: 16,
    },
    brandDivider: {
      height: 2,
      backgroundColor: hexToRgb(brandColor),
      marginBottom: 20,
      opacity: 0.3,
    },
    /* Bill To */
    sectionLabel: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      color: "#bbbbbb",
      letterSpacing: 2,
      marginBottom: 6,
    },
    clientName: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 13,
      color: "#111111",
      marginBottom: 2,
    },
    clientDetail: {
      fontSize: 9,
      color: "#666666",
      lineHeight: 1.5,
    },
    /* Table */
    tableHeader: {
      flexDirection: "row",
      borderBottomWidth: 2,
      borderBottomColor: hexToRgb(brandColor),
      paddingBottom: 6,
      marginBottom: 8,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 7,
      borderBottomWidth: 0.5,
      borderBottomColor: "#eeeeee",
    },
    colDesc: { flex: 1, paddingRight: 10 },
    colQty: { width: 50, textAlign: "right" as const },
    colPrice: { width: 80, textAlign: "right" as const },
    colAmount: { width: 80, textAlign: "right" as const },
    thText: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      color: "#999999",
      letterSpacing: 1.5,
    },
    cellDesc: {
      fontFamily: "Inter",
      fontSize: 10,
      color: "#333333",
    },
    cellMono: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      color: "#444444",
    },
    cellAmountBold: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      fontWeight: 700,
      color: "#222222",
    },
    /* Totals */
    totalsBlock: {
      marginTop: 16,
      alignSelf: "flex-end" as const,
      width: 220,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    totalsLabel: {
      fontFamily: "Inter",
      fontSize: 9,
      color: "#888888",
    },
    totalsValue: {
      fontFamily: "JetBrains Mono",
      fontSize: 10,
      color: "#333333",
    },
    totalsDivider: {
      height: 1,
      backgroundColor: "#dddddd",
      marginVertical: 6,
    },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderTopWidth: 2,
      borderTopColor: hexToRgb(brandColor),
    },
    grandTotalLabel: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 13,
      color: "#111111",
    },
    grandTotalValue: {
      fontFamily: "JetBrains Mono",
      fontWeight: 700,
      fontSize: 14,
      color: hexToRgb(brandColor),
    },
    /* Notes */
    notesSection: {
      marginTop: 24,
      paddingTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: "#eeeeee",
    },
    notesText: {
      fontSize: 9,
      color: "#666666",
      lineHeight: 1.6,
    },
    /* Payment CTA */
    paymentSection: {
      marginTop: 24,
      padding: 16,
      backgroundColor: lightenHex(brandColor, 200),
      borderRadius: 8,
      borderWidth: 1,
      borderColor: lightenHex(brandColor, 180),
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center" as const,
    },
    paymentText: {
      fontSize: 10,
      color: "#333333",
      maxWidth: "65%",
    },
    paymentButton: {
      backgroundColor: hexToRgb(brandColor),
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 6,
    },
    paymentButtonText: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      fontWeight: 700,
      color: "#ffffff",
      letterSpacing: 1,
    },
    /* Footer */
    footer: {
      position: "absolute" as const,
      bottom: 24,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center" as const,
    },
    footerText: {
      fontSize: 7,
      color: "#cccccc",
    },
    footerBrand: {
      fontSize: 7,
      color: "#cccccc",
    },
  });

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:   { bg: "#f0f0f0", color: "#888888", label: "DRAFT" },
  sent:    { bg: "#e8f5e9", color: "#2e7d32", label: "SENT" },
  paid:    { bg: "#e8f5e9", color: "#1b5e20", label: "PAID" },
  overdue: { bg: "#fbe9e7", color: "#c62828", label: "OVERDUE" },
  voided:  { bg: "#f0f0f0", color: "#999999", label: "VOIDED" },
};

interface InvoiceDocumentProps {
  data: InvoiceData;
  workspace: WorkspaceBrand;
}

export function InvoiceDocument({ data, workspace }: InvoiceDocumentProps) {
  const brandColor = workspace.brand_color_hex || "#10B981";
  const styles = createStyles(brandColor);
  const status = STATUS_STYLES[data.status] || STATUS_STYLES.draft;

  return (
    <Document title={`Invoice ${data.display_id}`} author={workspace.name}>
      <Page size="A4" style={styles.page}>
        {/* ── Brand Accent Line ──────────────────────── */}
        <View style={styles.brandDivider} />

        {/* ── Header ────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {workspace.logo_url && (
              <Image src={workspace.logo_url} style={styles.logo} />
            )}
            {!workspace.logo_url && (
              <Text style={styles.orgName}>{workspace.name}</Text>
            )}
            {workspace.tax_id && (
              <Text style={styles.orgDetail}>ABN: {workspace.tax_id}</Text>
            )}
            {workspace.address && (
              <Text style={styles.orgDetail}>{workspace.address}</Text>
            )}
            {workspace.email && (
              <Text style={styles.orgDetail}>{workspace.email}</Text>
            )}
            {workspace.phone && (
              <Text style={styles.orgDetail}>{workspace.phone}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.display_id}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Issued</Text>
              <Text style={styles.dateValue}>{formatDate(data.issue_date)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Due</Text>
              <Text style={styles.dateValue}>{formatDate(data.due_date)}</Text>
            </View>
            {data.paid_date && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Paid</Text>
                <Text style={styles.dateValue}>{formatDate(data.paid_date)}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Bill To ───────────────────────────────── */}
        <Text style={styles.sectionLabel}>BILL TO</Text>
        <Text style={styles.clientName}>{data.client_name || "—"}</Text>
        {data.client_address && (
          <Text style={styles.clientDetail}>{data.client_address}</Text>
        )}
        {data.client_email && (
          <Text style={styles.clientDetail}>{data.client_email}</Text>
        )}

        <View style={styles.divider} />

        {/* ── Line Items Table ──────────────────────── */}
        <View style={styles.tableHeader}>
          <View style={styles.colDesc}>
            <Text style={styles.thText}>DESCRIPTION</Text>
          </View>
          <View style={styles.colQty}>
            <Text style={styles.thText}>QTY</Text>
          </View>
          <View style={styles.colPrice}>
            <Text style={styles.thText}>UNIT PRICE</Text>
          </View>
          <View style={styles.colAmount}>
            <Text style={styles.thText}>AMOUNT</Text>
          </View>
        </View>

        {data.line_items.map((item) => {
          const lineTotal = calcLineTotal(item.quantity, item.unit_price);
          return (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={styles.cellDesc}>{item.description}</Text>
              </View>
              <View style={styles.colQty}>
                <Text style={styles.cellMono}>{item.quantity}</Text>
              </View>
              <View style={styles.colPrice}>
                <Text style={styles.cellMono}>
                  {formatCurrency(item.unit_price)}
                </Text>
              </View>
              <View style={styles.colAmount}>
                <Text style={styles.cellAmountBold}>
                  {formatCurrency(lineTotal)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* ── Totals ────────────────────────────────── */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(data.subtotal)}
            </Text>
          </View>
          {data.discount_total > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Discount
                {data.discount_type === "percent"
                  ? ` (${data.discount_value}%)`
                  : ""}
              </Text>
              <Text style={[styles.totalsValue, { color: "#e53e3e" }]}>
                -{formatCurrency(data.discount_total)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              GST ({data.tax_rate}%)
            </Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(data.tax)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(data.total)}
            </Text>
          </View>
        </View>

        {/* ── Notes ─────────────────────────────────── */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Payment CTA ───────────────────────────── */}
        {data.payment_link && data.status !== "paid" && data.status !== "voided" && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentText}>
              Pay this invoice securely online using credit card, debit card, or
              bank transfer.
            </Text>
            <Link src={data.payment_link} style={{ textDecoration: "none" }}>
              <View style={styles.paymentButton}>
                <Text style={styles.paymentButtonText}>PAY NOW</Text>
              </View>
            </Link>
          </View>
        )}

        {/* ── Footer ────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {workspace.name} • {data.display_id}
          </Text>
          <Text style={styles.footerBrand}>Powered by iWorkr</Text>
        </View>
      </Page>
    </Document>
  );
}

export default InvoiceDocument;
