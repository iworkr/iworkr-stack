/**
 * @component components/finance/editor/blocks/pdf/PdfBlocks.tsx
 * @status STABLE
 * @description Moneta invoice canvas — PdfBlocks
 * @lastReview 2026-03-28
 */
import {
  View,
  Text,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  InvoiceBlock,
  GlobalSettings,
  WorkspaceBrand,
  HeaderContent,
  ClientDetailsContent,
  MetaContent,
  LineItemsContent,
  TotalsContent,
  NotesContent,
  PaymentButtonContent,
  SignatureContent,
  TextContent,
  SpacerContent,
  DividerContent,
  ProgressClaimContent,
  NdisLineItemsContent,
} from "../../types";
import { calcLineTotal } from "../../math";
import { calcTotals } from "../../math";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 40 },
  brandLine: { height: 2, opacity: 0.3, marginBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  headerLeft: { maxWidth: "55%" },
  logo: { maxHeight: 48, maxWidth: 160, objectFit: "contain" as const, marginBottom: 8 },
  orgName: { fontFamily: "Inter", fontWeight: 700, fontSize: 18, color: "#111111", marginBottom: 4 },
  orgDetail: { fontSize: 8, color: "#888888", lineHeight: 1.5 },
  invoiceLabel: { fontFamily: "JetBrains Mono", fontSize: 10, color: "#aaaaaa", letterSpacing: 2, marginBottom: 4 },
  invoiceNumber: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 20, marginBottom: 8 },
  dateRow: { flexDirection: "row", gap: 4, marginBottom: 2 },
  dateLabel: { fontFamily: "Inter", fontWeight: 600, fontSize: 8, color: "#999999", width: 50 },
  dateValue: { fontFamily: "JetBrains Mono", fontSize: 9, color: "#333333" },
  statusBadge: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 4, alignSelf: "flex-end" as const },
  statusText: { fontFamily: "JetBrains Mono", fontSize: 8, fontWeight: 700, letterSpacing: 1.5 },
  sectionLabel: { fontFamily: "JetBrains Mono", fontSize: 7, color: "#bbbbbb", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" as const },
  clientName: { fontFamily: "Inter", fontWeight: 700, fontSize: 13, color: "#111111", marginBottom: 2 },
  clientDetail: { fontSize: 9, color: "#666666", lineHeight: 1.5 },
  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 16 },
  thRow: { flexDirection: "row", paddingBottom: 6, marginBottom: 8, borderBottomWidth: 2 },
  thText: { fontFamily: "JetBrains Mono", fontSize: 7, color: "#999999", letterSpacing: 1.5 },
  tableRow: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: "#eeeeee" },
  colDesc: { flex: 1, paddingRight: 10 },
  colQty: { width: 50, textAlign: "right" as const },
  colPrice: { width: 80, textAlign: "right" as const },
  colAmount: { width: 80, textAlign: "right" as const },
  cellDesc: { fontFamily: "Inter", fontSize: 10, color: "#333333" },
  cellMono: { fontFamily: "JetBrains Mono", fontSize: 9, color: "#444444" },
  cellBold: { fontFamily: "JetBrains Mono", fontSize: 9, fontWeight: 700, color: "#222222" },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end" as const, width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsLabel: { fontFamily: "Inter", fontSize: 9, color: "#888888" },
  totalsValue: { fontFamily: "JetBrains Mono", fontSize: 10, color: "#333333" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 2 },
  grandTotalLabel: { fontFamily: "Inter", fontWeight: 700, fontSize: 13, color: "#111111" },
  grandTotalValue: { fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14 },
  notesSection: { marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#eeeeee" },
  notesText: { fontSize: 9, color: "#666666", lineHeight: 1.6 },
  paymentBox: { marginTop: 24, padding: 16, borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" as const },
  paymentText: { fontSize: 10, color: "#333333", maxWidth: "65%" },
  paymentButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6 },
  paymentButtonText: { fontFamily: "JetBrains Mono", fontSize: 9, fontWeight: 700, color: "#ffffff", letterSpacing: 1 },
  signatureBox: { marginTop: 16, height: 60, borderWidth: 2, borderStyle: "dashed", borderColor: "#cccccc", borderRadius: 4, alignItems: "center" as const, justifyContent: "center" as const },
  signatureLabel: { fontFamily: "JetBrains Mono", fontSize: 7, color: "#bbbbbb", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" as const },
  signatureHint: { fontSize: 8, color: "#cccccc" },
  textBlock: { marginVertical: 4 },
  progressTitle: { fontFamily: "JetBrains Mono", fontSize: 7, color: "#bbbbbb", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" as const },
  progressRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eeeeee" },
  progressLabel: { fontFamily: "Inter", fontSize: 10, color: "#333333" },
  progressValue: { fontFamily: "JetBrains Mono", fontSize: 10, color: "#444444" },
  ndisThRow: { flexDirection: "row", paddingBottom: 4, marginBottom: 4, borderBottomWidth: 2 },
  ndisColCode: { width: 90 },
  ndisColDesc: { flex: 1 },
  ndisColDate: { width: 70 },
  ndisColHrs: { width: 40, textAlign: "right" as const },
  ndisColRate: { width: 60, textAlign: "right" as const },
  ndisColAmt: { width: 60, textAlign: "right" as const },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:   { bg: "#f0f0f0", color: "#888888", label: "DRAFT" },
  sent:    { bg: "#e8f5e9", color: "#2e7d32", label: "SENT" },
  paid:    { bg: "#e8f5e9", color: "#1b5e20", label: "PAID" },
  overdue: { bg: "#fbe9e7", color: "#c62828", label: "OVERDUE" },
  voided:  { bg: "#f0f0f0", color: "#999999", label: "VOIDED" },
};

interface PdfBlockProps {
  block: InvoiceBlock;
  blocks: InvoiceBlock[];
  settings: GlobalSettings;
  workspace: WorkspaceBrand;
}

export function PdfHeaderBlock({ block, settings, workspace }: PdfBlockProps) {
  const c = block.content as HeaderContent;
  const accent = settings.brandColor || workspace.brand_color_hex;
  return (
    <View style={s.section}>
      <View style={[s.brandLine, { backgroundColor: hexToRgb(accent) }]} />
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          {c.showLogo && workspace.logo_url ? (
            <Image src={workspace.logo_url} style={s.logo} />
          ) : (
            <Text style={s.orgName}>{workspace.name}</Text>
          )}
          {c.showOrgDetails && (
            <>
              {workspace.tax_id && <Text style={s.orgDetail}>ABN: {workspace.tax_id}</Text>}
              {workspace.address && <Text style={s.orgDetail}>{workspace.address}</Text>}
              {workspace.email && <Text style={s.orgDetail}>{workspace.email}</Text>}
              {workspace.phone && <Text style={s.orgDetail}>{workspace.phone}</Text>}
            </>
          )}
        </View>
        <View style={{ alignItems: "flex-end" as const }}>
          <Text style={s.invoiceLabel}>{c.title}</Text>
        </View>
      </View>
    </View>
  );
}

export function PdfClientBlock({ block }: PdfBlockProps) {
  const c = block.content as ClientDetailsContent;
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>BILL TO</Text>
      <Text style={s.clientName}>{c.clientName || "—"}</Text>
      {c.clientAddress && <Text style={s.clientDetail}>{c.clientAddress}</Text>}
      {c.clientEmail && <Text style={s.clientDetail}>{c.clientEmail}</Text>}
      {c.ndisNumber && <Text style={s.clientDetail}>NDIS: {c.ndisNumber}</Text>}
    </View>
  );
}

export function PdfMetaBlock({ block, settings }: PdfBlockProps) {
  const c = block.content as MetaContent;
  const accent = hexToRgb(settings.brandColor);
  const status = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
  return (
    <View style={[s.section, { alignItems: "flex-end" as const, marginBottom: 8 }]}>
      <Text style={[s.invoiceNumber, { color: accent }]}>{c.displayId}</Text>
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>Issued</Text>
        <Text style={s.dateValue}>{fmtDate(c.issueDate)}</Text>
      </View>
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>Due</Text>
        <Text style={s.dateValue}>{fmtDate(c.dueDate)}</Text>
      </View>
      {c.paidDate && (
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Paid</Text>
          <Text style={s.dateValue}>{fmtDate(c.paidDate)}</Text>
        </View>
      )}
      <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
        <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
      </View>
    </View>
  );
}

export function PdfLineItemsBlock({ block, settings }: PdfBlockProps) {
  const c = block.content as LineItemsContent;
  const accent = hexToRgb(settings.brandColor);
  return (
    <View style={s.section}>
      <View style={s.divider} />
      <View style={[s.thRow, { borderBottomColor: accent }]}>
        <View style={s.colDesc}><Text style={s.thText}>DESCRIPTION</Text></View>
        {c.showQty && <View style={s.colQty}><Text style={s.thText}>QTY</Text></View>}
        <View style={s.colPrice}><Text style={s.thText}>UNIT PRICE</Text></View>
        <View style={s.colAmount}><Text style={s.thText}>AMOUNT</Text></View>
      </View>
      {c.items.map((item) => {
        const lt = calcLineTotal(item.quantity, item.unitPrice);
        return (
          <View key={item.id} style={s.tableRow} wrap={false}>
            <View style={s.colDesc}><Text style={s.cellDesc}>{item.description}</Text></View>
            {c.showQty && <View style={s.colQty}><Text style={s.cellMono}>{item.quantity}</Text></View>}
            <View style={s.colPrice}><Text style={s.cellMono}>{fmtCurrency(item.unitPrice)}</Text></View>
            <View style={s.colAmount}><Text style={s.cellBold}>{fmtCurrency(lt)}</Text></View>
          </View>
        );
      })}
    </View>
  );
}

export function PdfTotalsBlock({ blocks, settings }: PdfBlockProps) {
  const totals = calcTotals(blocks, settings);
  const accent = hexToRgb(settings.brandColor);
  return (
    <View style={[s.section, { paddingLeft: 40 }]}>
      <View style={s.totalsBlock}>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Subtotal</Text>
          <Text style={s.totalsValue}>{fmtCurrency(totals.subtotal)}</Text>
        </View>
        {totals.discount > 0 && (
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>
              Discount{settings.discountType === "percent" ? ` (${settings.discountValue}%)` : ""}
            </Text>
            <Text style={[s.totalsValue, { color: "#e53e3e" }]}>-{fmtCurrency(totals.discount)}</Text>
          </View>
        )}
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>GST ({settings.taxRate}%)</Text>
          <Text style={s.totalsValue}>{fmtCurrency(totals.tax)}</Text>
        </View>
        <View style={[s.grandTotalRow, { borderTopColor: accent }]}>
          <Text style={s.grandTotalLabel}>Total</Text>
          <Text style={[s.grandTotalValue, { color: accent }]}>{fmtCurrency(totals.total)}</Text>
        </View>
      </View>
    </View>
  );
}

export function PdfNotesBlock({ block }: PdfBlockProps) {
  const c = block.content as NotesContent;
  if (!c.text) return null;
  return (
    <View style={[s.section, s.notesSection]}>
      <Text style={s.sectionLabel}>NOTES</Text>
      <Text style={s.notesText}>{c.text}</Text>
    </View>
  );
}

export function PdfPaymentFallback({ block, settings }: PdfBlockProps) {
  const c = block.content as PaymentButtonContent;
  const accent = settings.brandColor;
  return (
    <View style={[s.section, s.paymentBox, { backgroundColor: `${accent}08`, borderColor: `${accent}30` }]}>
      <Text style={s.paymentText}>
        {c.fallbackText || "Pay this invoice securely online."}
      </Text>
      <View style={[s.paymentButton, { backgroundColor: hexToRgb(accent) }]}>
        <Text style={s.paymentButtonText}>{c.label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

export function PdfSignaturePlaceholder({ block }: PdfBlockProps) {
  const c = block.content as SignatureContent;
  return (
    <View style={s.section}>
      <Text style={s.signatureLabel}>{c.label}</Text>
      {c.signatureDataUrl ? (
        <Image src={c.signatureDataUrl} style={{ maxHeight: 50, objectFit: "contain" as const }} />
      ) : (
        <View style={s.signatureBox}>
          <Text style={s.signatureHint}>Sign at the online invoice link</Text>
        </View>
      )}
    </View>
  );
}

export function PdfTextBlock({ block }: PdfBlockProps) {
  const c = block.content as TextContent;
  if (!c.text) return null;
  return (
    <View style={[s.section, s.textBlock]}>
      <Text style={{ fontSize: c.fontSize, color: "#555555", lineHeight: 1.6 }}>{c.text}</Text>
    </View>
  );
}

export function PdfSpacerBlock({ block }: PdfBlockProps) {
  const c = block.content as SpacerContent;
  return <View style={{ height: c.height }} />;
}

export function PdfDividerBlock({ block }: PdfBlockProps) {
  const c = block.content as DividerContent;
  return (
    <View style={[s.section, { marginVertical: 8 }]}>
      <View style={{ height: c.thickness, backgroundColor: c.color || "#e5e5e5" }} />
    </View>
  );
}

export function PdfProgressClaimBlock({ block, settings }: PdfBlockProps) {
  const c = block.content as ProgressClaimContent;
  const accent = hexToRgb(settings.brandColor);
  const claimableTotal = c.milestones
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + r2(c.contractValue * (m.percentage / 100)), 0);
  const thisClaimAmount = r2(Math.max(0, claimableTotal - c.previouslyClaimed));

  return (
    <View style={s.section}>
      <Text style={s.progressTitle}>PROGRESS CLAIM</Text>
      <View style={s.progressRow}>
        <Text style={s.progressLabel}>Contract Value</Text>
        <Text style={[s.progressValue, { fontWeight: 700 }]}>{fmtCurrency(c.contractValue)}</Text>
      </View>
      {c.milestones.map((ms) => (
        <View key={ms.id} style={s.progressRow}>
          <Text style={s.progressLabel}>
            {ms.completed ? "✓ " : "○ "}{ms.label} ({ms.percentage}%)
          </Text>
          <Text style={s.progressValue}>{fmtCurrency(r2(c.contractValue * (ms.percentage / 100)))}</Text>
        </View>
      ))}
      <View style={[s.progressRow, { borderTopWidth: 1, borderTopColor: "#cccccc", marginTop: 4, paddingTop: 6 }]}>
        <Text style={s.progressLabel}>Previously Claimed</Text>
        <Text style={s.progressValue}>{fmtCurrency(c.previouslyClaimed)}</Text>
      </View>
      <View style={s.progressRow}>
        <Text style={[s.progressLabel, { fontWeight: 700 }]}>This Claim</Text>
        <Text style={[s.progressValue, { fontWeight: 700, color: accent }]}>{fmtCurrency(thisClaimAmount)}</Text>
      </View>
    </View>
  );
}

export function PdfNdisLineItemsBlock({ block, settings }: PdfBlockProps) {
  const c = block.content as NdisLineItemsContent;
  const accent = hexToRgb(settings.brandColor);
  return (
    <View style={s.section}>
      <View style={s.divider} />
      <View style={[s.ndisThRow, { borderBottomColor: accent }]}>
        <View style={s.ndisColCode}><Text style={s.thText}>ITEM CODE</Text></View>
        <View style={s.ndisColDesc}><Text style={s.thText}>DESCRIPTION</Text></View>
        <View style={s.ndisColDate}><Text style={s.thText}>DATE</Text></View>
        <View style={s.ndisColHrs}><Text style={s.thText}>HRS</Text></View>
        <View style={s.ndisColRate}><Text style={s.thText}>RATE</Text></View>
        <View style={s.ndisColAmt}><Text style={s.thText}>AMOUNT</Text></View>
      </View>
      {c.items.map((item) => {
        const lt = calcLineTotal(item.hours, item.rate);
        return (
          <View key={item.id} style={s.tableRow} wrap={false}>
            <View style={s.ndisColCode}><Text style={[s.cellMono, { fontSize: 7 }]}>{item.supportItemCode}</Text></View>
            <View style={s.ndisColDesc}><Text style={s.cellDesc}>{item.description}</Text></View>
            <View style={s.ndisColDate}><Text style={[s.cellMono, { fontSize: 7 }]}>{item.dateOfSupport}</Text></View>
            <View style={s.ndisColHrs}><Text style={s.cellMono}>{item.hours}</Text></View>
            <View style={s.ndisColRate}><Text style={s.cellMono}>{fmtCurrency(item.rate)}</Text></View>
            <View style={s.ndisColAmt}><Text style={s.cellBold}>{fmtCurrency(lt)}</Text></View>
          </View>
        );
      })}
    </View>
  );
}
