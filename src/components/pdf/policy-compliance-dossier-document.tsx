/**
 * @component PolicyComplianceDossierDocument
 * @status COMPLETE
 * @description PDF document rendering a policy compliance dossier with worker acknowledgement records
 * @lastAudit 2026-03-22
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type AckRow = {
  worker_name: string;
  worker_email: string;
  status: string;
  acknowledged_at: string | null;
  ip_address: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, color: "#111" },
  title: { fontSize: 16, marginBottom: 6 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 12 },
  watermark: {
    position: "absolute",
    top: "45%",
    left: 70,
    transform: "rotate(-25deg)",
    fontSize: 42,
    opacity: 0.08,
    color: "#777",
  },
  section: { marginBottom: 10 },
  heading: { fontSize: 11, marginBottom: 4 },
  body: { fontSize: 9, lineHeight: 1.4 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 4,
  },
  cellA: { width: "32%" },
  cellB: { width: "22%" },
  cellC: { width: "20%" },
  cellD: { width: "26%" },
});

export function PolicyComplianceDossierDocument({
  title,
  version,
  policyText,
  rows,
}: {
  title: string;
  version: string;
  policyText: string;
  rows: AckRow[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>AUDIT COPY</Text>
        <Text style={styles.title}>Policy Compliance Dossier</Text>
        <Text style={styles.subtitle}>
          {title} — Version {version} — Generated {new Date().toLocaleString("en-AU")}
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Policy Text</Text>
          <Text style={styles.body}>{policyText || "No inline policy text available. Refer attached document URL."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Acknowledgement Ledger</Text>
          <View style={styles.row}>
            <Text style={styles.cellA}>Worker</Text>
            <Text style={styles.cellB}>Status</Text>
            <Text style={styles.cellC}>Timestamp</Text>
            <Text style={styles.cellD}>IP Address</Text>
          </View>
          {rows.map((row, idx) => (
            <View key={`${row.worker_email}-${idx}`} style={styles.row}>
              <Text style={styles.cellA}>{row.worker_name || row.worker_email}</Text>
              <Text style={styles.cellB}>{row.status}</Text>
              <Text style={styles.cellC}>{row.acknowledged_at ? new Date(row.acknowledged_at).toLocaleString("en-AU") : "—"}</Text>
              <Text style={styles.cellD}>{row.ip_address || "—"}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

