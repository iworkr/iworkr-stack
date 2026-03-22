/**
 * @component PlanReviewReportDocument
 * @status COMPLETE
 * @description PDF document rendering an NDIS plan review report with goals, ratings, and recommendations
 * @lastAudit 2026-03-22
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

type GoalSection = {
  goal_statement: string;
  ndis_goal_category?: string;
  summary_narrative?: string;
  identified_barriers?: string[];
  recommended_future_supports?: string[];
};

export type PlanReviewPdfPayload = {
  title: string;
  participantName: string;
  participantNdisNumber?: string | null;
  organizationName: string;
  reportDate: string;
  scopeStart: string;
  scopeEnd: string;
  executiveSummary: string;
  goals: GoalSection[];
  incidentChartBase64?: string;
  goalProgressChartBase64?: string;
  routineCompliancePercent?: number;
  utilizationPercent?: number;
  sha256Hash?: string;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, color: "#111111", fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 9, color: "#4b5563", marginBottom: 12 },
  section: { marginBottom: 12, borderTop: "1px solid #E5E7EB", paddingTop: 8 },
  heading: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  body: { fontSize: 9, lineHeight: 1.35 },
  bullet: { marginLeft: 10, fontSize: 9, lineHeight: 1.35 },
  chart: { width: "100%", height: 180, objectFit: "contain", marginTop: 6, marginBottom: 6 },
  meterWrap: { marginTop: 6, border: "1px solid #D1D5DB", height: 12, borderRadius: 6, overflow: "hidden" },
  meterFill: { height: 10, backgroundColor: "#10B981" },
  sealBox: {
    marginTop: 10,
    padding: 8,
    border: "1px solid #111111",
    backgroundColor: "#F5F5F5",
  },
  sealTitle: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  sealValue: { fontSize: 8, fontFamily: "Courier", lineHeight: 1.2 },
});

export function PlanReviewReportDocument({ payload }: { payload: PlanReviewPdfPayload }) {
  const routine = Math.max(0, Math.min(100, Number(payload.routineCompliancePercent || 0)));
  const utilization = Math.max(0, Math.min(100, Number(payload.utilizationPercent || 0)));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{payload.title}</Text>
        <Text style={styles.subtitle}>
          Participant: {payload.participantName}
          {payload.participantNdisNumber ? ` · NDIS: ${payload.participantNdisNumber}` : ""}
        </Text>
        <Text style={styles.subtitle}>
          Scope: {payload.scopeStart} to {payload.scopeEnd} · Report Date: {payload.reportDate}
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Executive Summary</Text>
          <Text style={styles.body}>{payload.executiveSummary || "No executive summary provided."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Goal Outcomes</Text>
          {payload.goals.length === 0 ? (
            <Text style={styles.body}>No goals available in this reporting scope.</Text>
          ) : (
            payload.goals.map((goal, idx) => (
              <View key={`${goal.goal_statement}-${idx}`} style={{ marginBottom: 8 }}>
                <Text style={styles.body}>
                  {idx + 1}. {goal.goal_statement}
                </Text>
                <Text style={styles.body}>{goal.summary_narrative || "No narrative available."}</Text>
                {(goal.identified_barriers || []).slice(0, 3).map((b, i) => (
                  <Text key={`${idx}-b-${i}`} style={styles.bullet}>- Barrier: {b}</Text>
                ))}
                {(goal.recommended_future_supports || []).slice(0, 3).map((s, i) => (
                  <Text key={`${idx}-s-${i}`} style={styles.bullet}>- Recommended support: {s}</Text>
                ))}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Visual Analytics</Text>
          {!!payload.incidentChartBase64 && <Image src={payload.incidentChartBase64} style={styles.chart} />}
          {!!payload.goalProgressChartBase64 && <Image src={payload.goalProgressChartBase64} style={styles.chart} />}
          <Text style={styles.body}>Routine Adherence: {routine.toFixed(1)}%</Text>
          <View style={styles.meterWrap}>
            <View style={{ ...styles.meterFill, width: `${routine}%` }} />
          </View>
          <Text style={{ ...styles.body, marginTop: 6 }}>Budget Utilization: {utilization.toFixed(1)}%</Text>
          <View style={styles.meterWrap}>
            <View style={{ ...styles.meterFill, width: `${utilization}%` }} />
          </View>
        </View>

        <View style={styles.sealBox}>
          <Text style={styles.sealTitle}>Cryptographic Seal</Text>
          <Text style={styles.sealValue}>SHA-256: {payload.sha256Hash || "PENDING"}</Text>
        </View>
      </Page>
    </Document>
  );
}
