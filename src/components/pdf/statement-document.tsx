/**
 * Client Statement PDF — @react-pdf/renderer
 *
 * Generates a statement listing all invoices and payments for a client.
 * Uses the same brand identity and font registration as invoice-document.tsx.
 */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import type { WorkspaceBrand } from "./invoice-types";
import { formatCurrency, formatDate } from "./invoice-types";

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

export interface StatementInvoice {
  display_id: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance: number;
}

export interface StatementData {
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  generated_at: string;
  invoices: StatementInvoice[];
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
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
    brandDivider: {
      height: 2,
      backgroundColor: hexToRgb(brandColor),
      marginBottom: 20,
      opacity: 0.3,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 24,
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
    statementLabel: {
      fontFamily: "JetBrains Mono",
      fontSize: 10,
      color: "#aaaaaa",
      letterSpacing: 2,
      marginBottom: 4,
    },
    statementTitle: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 20,
      color: hexToRgb(brandColor),
      marginBottom: 8,
    },
    dateText: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      color: "#666666",
    },
    /* Client section */
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
    divider: {
      height: 1,
      backgroundColor: "#e5e5e5",
      marginVertical: 16,
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
    colInvoice: { width: 90 },
    colDate: { width: 80 },
    colDue: { width: 80 },
    colStatus: { width: 60 },
    colTotal: { width: 80, textAlign: "right" as const },
    colPaid: { width: 80, textAlign: "right" as const },
    colBalance: { flex: 1, textAlign: "right" as const },
    thText: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      color: "#999999",
      letterSpacing: 1.5,
    },
    cellText: {
      fontFamily: "Inter",
      fontSize: 9,
      color: "#333333",
    },
    cellMono: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      color: "#444444",
    },
    cellBold: {
      fontFamily: "JetBrains Mono",
      fontSize: 9,
      fontWeight: 700,
      color: "#222222",
    },
    statusPaid: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      fontWeight: 700,
      color: "#1b5e20",
      backgroundColor: "#e8f5e9",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 3,
    },
    statusOverdue: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      fontWeight: 700,
      color: "#c62828",
      backgroundColor: "#fbe9e7",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 3,
    },
    statusDefault: {
      fontFamily: "JetBrains Mono",
      fontSize: 7,
      fontWeight: 700,
      color: "#888888",
      backgroundColor: "#f0f0f0",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 3,
    },
    /* Summary */
    summaryBlock: {
      marginTop: 20,
      alignSelf: "flex-end" as const,
      width: 240,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    summaryLabel: {
      fontFamily: "Inter",
      fontSize: 9,
      color: "#888888",
    },
    summaryValue: {
      fontFamily: "JetBrains Mono",
      fontSize: 10,
      color: "#333333",
    },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderTopWidth: 2,
      borderTopColor: hexToRgb(brandColor),
      marginTop: 4,
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
  });

function getStatusStyle(status: string, styles: ReturnType<typeof createStyles>) {
  if (status === "paid") return styles.statusPaid;
  if (status === "overdue") return styles.statusOverdue;
  return styles.statusDefault;
}

interface StatementDocumentProps {
  data: StatementData;
  workspace: WorkspaceBrand;
}

export function StatementDocument({ data, workspace }: StatementDocumentProps) {
  const brandColor = workspace.brand_color_hex || "#10B981";
  const styles = createStyles(brandColor);

  return (
    <Document title={`Statement — ${data.client_name}`} author={workspace.name}>
      <Page size="A4" style={styles.page}>
        {/* Brand accent */}
        <View style={styles.brandDivider} />

        {/* Header */}
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
            <Text style={styles.statementLabel}>STATEMENT</Text>
            <Text style={styles.statementTitle}>Account Statement</Text>
            <Text style={styles.dateText}>
              Generated {formatDate(data.generated_at)}
            </Text>
          </View>
        </View>

        {/* Client */}
        <Text style={styles.sectionLabel}>STATEMENT FOR</Text>
        <Text style={styles.clientName}>{data.client_name}</Text>
        {data.client_address && (
          <Text style={styles.clientDetail}>{data.client_address}</Text>
        )}
        {data.client_email && (
          <Text style={styles.clientDetail}>{data.client_email}</Text>
        )}

        <View style={styles.divider} />

        {/* Invoice table */}
        <View style={styles.tableHeader}>
          <View style={styles.colInvoice}>
            <Text style={styles.thText}>INVOICE</Text>
          </View>
          <View style={styles.colDate}>
            <Text style={styles.thText}>ISSUED</Text>
          </View>
          <View style={styles.colDue}>
            <Text style={styles.thText}>DUE</Text>
          </View>
          <View style={styles.colStatus}>
            <Text style={styles.thText}>STATUS</Text>
          </View>
          <View style={styles.colTotal}>
            <Text style={styles.thText}>TOTAL</Text>
          </View>
          <View style={styles.colPaid}>
            <Text style={styles.thText}>PAID</Text>
          </View>
          <View style={styles.colBalance}>
            <Text style={styles.thText}>BALANCE</Text>
          </View>
        </View>

        {data.invoices.map((inv) => (
          <View key={inv.display_id} style={styles.tableRow} wrap={false}>
            <View style={styles.colInvoice}>
              <Text style={styles.cellBold}>{inv.display_id}</Text>
            </View>
            <View style={styles.colDate}>
              <Text style={styles.cellMono}>{formatDate(inv.issue_date)}</Text>
            </View>
            <View style={styles.colDue}>
              <Text style={styles.cellMono}>{formatDate(inv.due_date)}</Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={getStatusStyle(inv.status, styles)}>
                {inv.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.cellMono}>{formatCurrency(inv.total)}</Text>
            </View>
            <View style={styles.colPaid}>
              <Text style={styles.cellMono}>{formatCurrency(inv.amount_paid)}</Text>
            </View>
            <View style={styles.colBalance}>
              <Text style={inv.balance > 0 ? styles.cellBold : styles.cellMono}>
                {formatCurrency(inv.balance)}
              </Text>
            </View>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Invoiced</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.total_invoiced)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.total_paid)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Outstanding</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(data.total_outstanding)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {workspace.name} — Statement for {data.client_name}
          </Text>
          <Text style={styles.footerText}>Powered by iWorkr</Text>
        </View>
      </Page>
    </Document>
  );
}

export default StatementDocument;
