"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { IntakeFormData } from "@/lib/stores/participant-intake-store";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#111", lineHeight: 1.6 },
  h1: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  h2: { fontSize: 12, fontWeight: "bold", color: "#111", marginTop: 20, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 4 },
  org: { fontSize: 10, color: "#666", marginBottom: 20 },
  row: { flexDirection: "row", marginBottom: 3 },
  lbl: { width: 140, fontSize: 9, color: "#666" },
  val: { flex: 1, fontSize: 10, color: "#111" },
  tHead: { flexDirection: "row", backgroundColor: "#f5f5f5", padding: 6, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  tRow: { flexDirection: "row", padding: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  tTotal: { flexDirection: "row", padding: 6, backgroundColor: "#f0fdf4" },
  tCell: { fontSize: 9, color: "#333" },
  tBold: { fontSize: 9, fontWeight: "bold", color: "#111" },
  alert: { backgroundColor: "#fef2f2", padding: 8, borderRadius: 3, marginTop: 4, marginBottom: 4 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#ccc", height: 28, marginBottom: 3 },
  sigLabel: { fontSize: 8, color: "#999" },
  small: { fontSize: 8, color: "#999", marginTop: 16 },
  footer: { position: "absolute" as const, bottom: 28, left: 40, right: 40, fontSize: 7, color: "#bbb", textAlign: "center" as const, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 6 },
  pill: { backgroundColor: "#f0f0f0", borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, fontSize: 8, color: "#555" },
});

const MGMT: Record<string, string> = { ndia_managed: "NDIA Managed", plan_managed: "Plan Managed", self_managed: "Self Managed" };

const FREQ_LABELS: Record<string, string> = {
  once_daily: "Once daily", twice_daily: "Twice daily", three_times_daily: "3× daily",
  four_times_daily: "4× daily", every_morning: "Morning", every_night: "Night",
  weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", prn: "PRN (as needed)", other: "Other",
};

const ROUTE_LABELS: Record<string, string> = {
  oral: "Oral", topical: "Topical", inhaled: "Inhaled", sublingual: "Sublingual",
  subcutaneous: "Subcutaneous", intramuscular: "IM", other: "Other",
};

function R({ label, value }: { label: string; value?: string | null }) {
  return <View style={s.row}><Text style={s.lbl}>{label}</Text><Text style={s.val}>{value || "—"}</Text></View>;
}

function fmt(n: number) { return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }); } catch { return d; }
}

/* ═══════════════════════════════════════════════════════════════
   SERVICE AGREEMENT
   ═══════════════════════════════════════════════════════════════ */

export function ServiceAgreementPDF({ data, orgName }: { data: IntakeFormData; orgName?: string }) {
  const total = (data.sa_line_items || []).reduce((sum, li) => sum + (li.allocated_budget || 0), 0);
  const name = `${data.first_name} ${data.last_name}`.trim();
  const provider = orgName || "iWorkr";
  const today = fmtDate(new Date().toISOString().split("T")[0]);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Service Agreement</Text>
        <Text style={s.org}>{provider} — {today}</Text>

        <Text style={s.h2}>1. Parties</Text>
        <R label="Participant" value={name} />
        <R label="NDIS Number" value={data.ndis_number} />
        <R label="Date of Birth" value={fmtDate(data.date_of_birth)} />
        <R label="Phone" value={data.phone} />
        <R label="Email" value={data.email} />
        <R label="Provider" value={provider} />

        <Text style={s.h2}>2. Plan & Funding</Text>
        <R label="Plan Management" value={MGMT[data.funding_type] || data.funding_type} />
        {data.funding_type === "plan_managed" && data.plan_manager_email && (
          <R label="Plan Manager Email" value={data.plan_manager_email} />
        )}
        <R label="Agreement Start" value={fmtDate(data.sa_start_date)} />
        <R label="Agreement End" value={fmtDate(data.sa_end_date)} />

        {(data.sa_line_items?.length ?? 0) > 0 && (
          <>
            <Text style={s.h2}>3. Supports & Budget</Text>
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, marginTop: 4 }}>
              <View style={s.tHead}>
                <Text style={[s.tBold, { width: 75 }]}>Code</Text>
                <Text style={[s.tBold, { flex: 1 }]}>Support Item</Text>
                <Text style={[s.tBold, { width: 60, textAlign: "right" as const }]}>Rate</Text>
                <Text style={[s.tBold, { width: 80, textAlign: "right" as const }]}>Budget</Text>
              </View>
              {data.sa_line_items.map((li, i) => (
                <View key={i} style={s.tRow}>
                  <Text style={[s.tCell, { width: 75 }]}>{li.ndis_code || "—"}</Text>
                  <Text style={[s.tCell, { flex: 1 }]}>{li.ndis_name || "—"}</Text>
                  <Text style={[s.tCell, { width: 60, textAlign: "right" as const }]}>${fmt(li.unit_rate || 0)}</Text>
                  <Text style={[s.tCell, { width: 80, textAlign: "right" as const }]}>${fmt(li.allocated_budget || 0)}</Text>
                </View>
              ))}
              <View style={s.tTotal}>
                <Text style={[s.tBold, { flex: 1 }]}>Total</Text>
                <Text style={[s.tBold, { width: 80, textAlign: "right" as const }]}>${fmt(total)}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={s.h2}>{(data.sa_line_items?.length ?? 0) > 0 ? "4" : "3"}. Cancellation Policy</Text>
        <Text style={{ fontSize: 9, color: "#444", lineHeight: 1.5 }}>
          The participant may cancel or reduce a scheduled support at any time. However, the provider may charge a cancellation fee if the participant does not give at least 2 clear business days notice. Short notice cancellations will be charged at 100% of the agreed rate in accordance with the NDIS Pricing Arrangements.
        </Text>

        <Text style={s.h2}>{(data.sa_line_items?.length ?? 0) > 0 ? "5" : "4"}. Participant Rights</Text>
        <Text style={{ fontSize: 9, color: "#444", lineHeight: 1.5 }}>
          The participant has the right to: be treated with dignity and respect; have their privacy protected; access an advocate or support person; provide feedback or make a complaint; end this agreement at any time with reasonable notice.
        </Text>

        <Text style={s.h2}>{(data.sa_line_items?.length ?? 0) > 0 ? "6" : "5"}. Agreement</Text>
        <Text style={[s.small, { marginBottom: 16, marginTop: 4 }]}>By signing below, both parties agree to the terms outlined in this Service Agreement.</Text>

        <View style={[s.row, { marginTop: 8 }]}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Participant / Nominee</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Provider Representative</Text>
          </View>
        </View>
        <View style={[s.row, { marginTop: 8 }]}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Date</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.sigLine} />
            <Text style={s.sigLabel}>Date</Text>
          </View>
        </View>

        <Text style={s.footer}>
          This agreement is made under the National Disability Insurance Scheme Act 2013. Generated by {provider}.
        </Text>
      </Page>
    </Document>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARE PLAN
   ═══════════════════════════════════════════════════════════════ */

export function CareplanPDF({ data, orgName }: { data: IntakeFormData; orgName?: string }) {
  const name = `${data.first_name} ${data.last_name}`.trim();
  const provider = orgName || "iWorkr";
  const today = fmtDate(new Date().toISOString().split("T")[0]);
  const alerts = (data.critical_alerts || "").split("\n").map((a) => a.trim()).filter(Boolean);
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 90);
  const mobility = data.mobility_status ? data.mobility_status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : null;
  const comms = data.communication_type ? data.communication_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : null;
  const meds = (data.medications || []).filter((m) => m.medication_name?.trim());
  const goals = (data.goals || []).filter((g) => g.title?.trim());

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Care Plan</Text>
        <Text style={s.org}>{provider} — {today}</Text>

        <Text style={s.h2}>Participant</Text>
        <R label="Name" value={name} />
        {data.preferred_name && <R label="Preferred Name" value={data.preferred_name} />}
        <R label="NDIS Number" value={data.ndis_number} />
        <R label="Date of Birth" value={fmtDate(data.date_of_birth)} />
        <R label="Phone" value={data.phone} />

        <Text style={s.h2}>Disability & Clinical</Text>
        <R label="Primary Diagnosis" value={data.primary_diagnosis} />
        {mobility && <R label="Mobility" value={mobility} />}
        {comms && <R label="Communication" value={comms} />}

        {alerts.length > 0 && (
          <View style={s.alert}>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#b91c1c", marginBottom: 4 }}>Medical Alerts</Text>
            {alerts.map((a, i) => (
              <Text key={i} style={{ fontSize: 9, color: "#7f1d1d" }}>• {a}</Text>
            ))}
          </View>
        )}

        {/* Medications */}
        <Text style={s.h2}>Current Medications</Text>
        {meds.length > 0 ? (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, marginTop: 4 }}>
            <View style={s.tHead}>
              <Text style={[s.tBold, { flex: 1 }]}>Medication</Text>
              <Text style={[s.tBold, { width: 65 }]}>Dosage</Text>
              <Text style={[s.tBold, { width: 55 }]}>Route</Text>
              <Text style={[s.tBold, { width: 70 }]}>Frequency</Text>
              <Text style={[s.tBold, { width: 30, textAlign: "center" as const }]}>PRN</Text>
            </View>
            {meds.map((m, i) => (
              <View key={i} style={s.tRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tCell}>{m.medication_name || "—"}</Text>
                  {m.prescribing_doctor ? <Text style={{ fontSize: 7, color: "#999" }}>Dr {m.prescribing_doctor}</Text> : null}
                </View>
                <Text style={[s.tCell, { width: 65 }]}>{m.dosage || "—"}</Text>
                <Text style={[s.tCell, { width: 55 }]}>{(m.route && ROUTE_LABELS[m.route]) || m.route || "—"}</Text>
                <Text style={[s.tCell, { width: 70 }]}>{(m.frequency && FREQ_LABELS[m.frequency]) || m.frequency || "—"}</Text>
                <Text style={[s.tCell, { width: 30, textAlign: "center" as const }]}>{m.is_prn ? "Yes" : "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: "#999", fontStyle: "italic" as const }}>No medications recorded at intake.</Text>
        )}

        {/* Goals */}
        <Text style={s.h2}>Goals</Text>
        {goals.length > 0 ? (
          <View style={{ marginTop: 4 }}>
            {goals.map((g, i) => (
              <View key={i} style={{ marginBottom: 8, paddingLeft: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "bold", color: "#111" }}>{i + 1}. {g.title || "Untitled Goal"}</Text>
                  {g.support_category ? (
                    <Text style={[s.pill, { marginLeft: 6 }]}>{g.support_category.replace(/_/g, " ")}</Text>
                  ) : null}
                </View>
                {g.target_outcome ? (
                  <Text style={{ fontSize: 9, color: "#555", marginLeft: 12 }}>Target: {g.target_outcome}</Text>
                ) : null}
                {g.description ? (
                  <Text style={{ fontSize: 8, color: "#888", marginLeft: 12, marginTop: 1 }}>{g.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 9, color: "#666", lineHeight: 1.5, marginBottom: 4 }}>
              Goals will be developed collaboratively with {data.first_name} and their support network during the first 2 weeks of service delivery.
            </Text>
            <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 8, minHeight: 40 }}>
              <Text style={{ fontSize: 8, color: "#ccc" }}>1. {"\n"}2. {"\n"}3.</Text>
            </View>
          </>
        )}

        {/* Schedule */}
        <Text style={s.h2}>Support Schedule</Text>
        {(data.roster_entries?.length ?? 0) > 0 ? (
          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, marginTop: 4 }}>
            <View style={s.tHead}>
              <Text style={[s.tBold, { flex: 1 }]}>Days</Text>
              <Text style={[s.tBold, { width: 60 }]}>Start</Text>
              <Text style={[s.tBold, { width: 60 }]}>End</Text>
              <Text style={[s.tBold, { width: 80 }]}>Item</Text>
            </View>
            {data.roster_entries.map((e, i) => (
              <View key={i} style={s.tRow}>
                <Text style={[s.tCell, { flex: 1 }]}>{e.days.join(", ")}</Text>
                <Text style={[s.tCell, { width: 60 }]}>{e.start_time}</Text>
                <Text style={[s.tCell, { width: 60 }]}>{e.end_time}</Text>
                <Text style={[s.tCell, { width: 80 }]}>{e.linked_item_number || "—"}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: "#999", fontStyle: "italic" as const }}>Schedule to be confirmed.</Text>
        )}

        <Text style={s.h2}>Risk Assessment</Text>
        <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 8, minHeight: 30 }}>
          <Text style={{ fontSize: 8, color: "#ccc" }}>To be completed by the support coordinator during initial assessment.</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <R label="Review Due" value={fmtDate(reviewDate.toISOString().split("T")[0])} />
        </View>

        <Text style={s.footer}>
          This Care Plan must be reviewed within 90 days or upon any change in circumstances. Generated by {provider}.
        </Text>
      </Page>
    </Document>
  );
}
