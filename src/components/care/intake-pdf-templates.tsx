"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { IntakeFormData } from "@/lib/stores/participant-intake-store";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiA.woff2", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Inter", fontSize: 10, color: "#1a1a1a", lineHeight: 1.5 },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: "#10B981", paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, color: "#050505", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b7280" },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "#050505", marginBottom: 8, marginTop: 20 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 160, fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  value: { flex: 1, fontSize: 10, color: "#1a1a1a" },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", padding: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", padding: 8 },
  tableCell: { fontSize: 9, color: "#374151" },
  tableCellBold: { fontSize: 9, fontWeight: 600, color: "#1a1a1a" },
  totalRow: { flexDirection: "row", padding: 8, backgroundColor: "#ecfdf5" },
  footer: { position: "absolute" as const, bottom: 32, left: 48, right: 48, fontSize: 8, color: "#9ca3af", textAlign: "center" as const, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  badge: { backgroundColor: "#10B981", color: "#fff", fontSize: 8, fontWeight: 600, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});

const MGMT_LABELS: Record<string, string> = {
  ndia_managed: "NDIA Managed",
  plan_managed: "Plan Managed",
  self_managed: "Self Managed",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value || "—"}</Text>
    </View>
  );
}

export function ServiceAgreementPDF({ data, orgName }: { data: IntakeFormData; orgName?: string }) {
  const total = (data.sa_line_items || []).reduce((sum, li) => sum + (li.allocated_budget || 0), 0);
  const fullName = `${data.first_name} ${data.last_name}`.trim();
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>NDIS Service Agreement</Text>
          <Text style={s.subtitle}>{orgName || "iWorkr"} — Generated {today}</Text>
        </View>

        <Text style={s.sectionTitle}>Participant Details</Text>
        <InfoRow label="Name" value={fullName} />
        <InfoRow label="NDIS Number" value={data.ndis_number} />
        <InfoRow label="Date of Birth" value={data.date_of_birth} />
        <InfoRow label="Email" value={data.email} />
        <InfoRow label="Phone" value={data.phone} />
        <InfoRow label="Plan Management" value={MGMT_LABELS[data.funding_type] || data.funding_type} />
        {data.funding_type === "plan_managed" && data.plan_manager_email && (
          <InfoRow label="Plan Manager Email" value={data.plan_manager_email} />
        )}

        <Text style={s.sectionTitle}>Agreement Period</Text>
        <InfoRow label="Start Date" value={data.sa_start_date} />
        <InfoRow label="End Date" value={data.sa_end_date} />

        {(data.sa_line_items?.length ?? 0) > 0 && (
          <>
            <Text style={s.sectionTitle}>Support Items & Budget</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableCellBold, { width: 80 }]}>NDIS Code</Text>
                <Text style={[s.tableCellBold, { flex: 1 }]}>Description</Text>
                <Text style={[s.tableCellBold, { width: 70, textAlign: "right" as const }]}>Rate</Text>
                <Text style={[s.tableCellBold, { width: 90, textAlign: "right" as const }]}>Budget</Text>
              </View>
              {data.sa_line_items.map((li, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={[s.tableCell, { width: 80 }]}>{li.ndis_code}</Text>
                  <Text style={[s.tableCell, { flex: 1 }]}>{li.ndis_name}</Text>
                  <Text style={[s.tableCell, { width: 70, textAlign: "right" as const }]}>${li.unit_rate.toFixed(2)}/hr</Text>
                  <Text style={[s.tableCell, { width: 90, textAlign: "right" as const }]}>${li.allocated_budget.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</Text>
                </View>
              ))}
              <View style={s.totalRow}>
                <Text style={[s.tableCellBold, { flex: 1 }]}>Total Agreement Value</Text>
                <Text style={[s.tableCellBold, { width: 90, textAlign: "right" as const, color: "#059669" }]}>${total.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ marginTop: 40 }}>
          <Text style={s.sectionTitle}>Signatures</Text>
          <View style={[s.row, { marginTop: 24 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4, height: 32 }} />
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Participant / Nominee Signature</Text>
            </View>
            <View style={{ width: 32 }} />
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4, height: 32 }} />
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Provider Representative Signature</Text>
            </View>
          </View>
          <View style={[s.row, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4, height: 20 }} />
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Date</Text>
            </View>
            <View style={{ width: 32 }} />
            <View style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginBottom: 4, height: 20 }} />
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Date</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer}>
          This Service Agreement is made between the participant and the service provider in accordance with the National Disability Insurance Scheme Act 2013.
        </Text>
      </Page>
    </Document>
  );
}

export function CareplanPDF({ data, orgName }: { data: IntakeFormData; orgName?: string }) {
  const fullName = `${data.first_name} ${data.last_name}`.trim();
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const alerts = (data.critical_alerts || "").split("\n").map((a) => a.trim()).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Clinical Care Plan</Text>
          <Text style={s.subtitle}>{orgName || "iWorkr"} — Generated {today}</Text>
        </View>

        <Text style={s.sectionTitle}>Participant Information</Text>
        <InfoRow label="Name" value={fullName} />
        <InfoRow label="Preferred Name" value={data.preferred_name} />
        <InfoRow label="NDIS Number" value={data.ndis_number} />
        <InfoRow label="Date of Birth" value={data.date_of_birth} />
        <InfoRow label="Email" value={data.email} />
        <InfoRow label="Phone" value={data.phone} />

        <Text style={s.sectionTitle}>Clinical Baseline</Text>
        <InfoRow label="Primary Diagnosis" value={data.primary_diagnosis} />
        <InfoRow label="Mobility" value={data.mobility_status ? data.mobility_status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : undefined} />
        <InfoRow label="Communication" value={data.communication_type ? data.communication_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : undefined} />

        {alerts.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Critical Medical Alerts</Text>
            <View style={{ backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 4, padding: 12, marginTop: 4 }}>
              {alerts.map((alert, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: i < alerts.length - 1 ? 4 : 0 }}>
                  <Text style={{ fontSize: 10, color: "#dc2626", marginRight: 6 }}>!</Text>
                  <Text style={{ fontSize: 10, color: "#991b1b", flex: 1 }}>{alert}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.sectionTitle}>Support Schedule Summary</Text>
        {(data.roster_entries?.length ?? 0) > 0 ? (
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableCellBold, { flex: 1 }]}>Days</Text>
              <Text style={[s.tableCellBold, { width: 80 }]}>Start</Text>
              <Text style={[s.tableCellBold, { width: 80 }]}>End</Text>
              <Text style={[s.tableCellBold, { width: 90 }]}>NDIS Item</Text>
            </View>
            {data.roster_entries.map((entry, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.tableCell, { flex: 1 }]}>{entry.days.join(", ")}</Text>
                <Text style={[s.tableCell, { width: 80 }]}>{entry.start_time}</Text>
                <Text style={[s.tableCell, { width: 80 }]}>{entry.end_time}</Text>
                <Text style={[s.tableCell, { width: 90 }]}>{entry.linked_item_number || "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" as const }}>No schedule blocks configured during intake.</Text>
        )}

        <View style={{ marginTop: 32 }}>
          <Text style={s.sectionTitle}>Notes & Observations</Text>
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, height: 100, padding: 8 }}>
            <Text style={{ fontSize: 9, color: "#d1d5db" }}>Staff notes and observations will be recorded here.</Text>
          </View>
        </View>

        <Text style={s.footer}>
          This Care Plan is a living document and must be reviewed within 90 days or upon any significant change in the participant&apos;s circumstances.
        </Text>
      </Page>
    </Document>
  );
}
