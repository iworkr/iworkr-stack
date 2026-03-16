import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type FacilityCleaningLogRow = {
  id: string;
  target_date: string;
  title: string;
  status: "pending" | "completed" | "exempted" | "missed";
  completed_at?: string | null;
  exemption_reason?: string | null;
  exemption_note?: string | null;
  evidence_data?: { photo_url?: string; value?: string; exemption_reason?: string };
  worker_name?: string;
};

export type FacilityCleaningLogPayload = {
  facilityName: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  generatedBy: string;
  rows: FacilityCleaningLogRow[];
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, color: "#111111", fontFamily: "Helvetica" },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#4B5563", marginBottom: 8 },
  watermark: {
    position: "absolute",
    top: "50%",
    left: "18%",
    fontSize: 46,
    color: "#6B7280",
    opacity: 0.08,
    transform: "rotate(-24deg)",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #D1D5DB",
    borderTop: "1px solid #D1D5DB",
    paddingVertical: 4,
    marginTop: 6,
    backgroundColor: "#F9FAFB",
  },
  cellHead: { fontSize: 8, fontWeight: 700 },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #E5E7EB",
    paddingVertical: 5,
    alignItems: "center",
    minHeight: 30,
  },
  cDate: { width: "14%" },
  cTask: { width: "26%", paddingRight: 4 },
  cStatus: { width: "10%" },
  cWorker: { width: "20%", paddingRight: 4 },
  cNotes: { width: "18%", paddingRight: 4 },
  cPhoto: { width: "12%" },
  photo: { width: 44, height: 28, objectFit: "cover", border: "1px solid #D1D5DB" },
  mono: { fontFamily: "Courier", fontSize: 8, marginTop: 10, color: "#374151" },
});

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "exempted") return "Exempted";
  if (status === "missed") return "Missed";
  return "Pending";
}

export function FacilityCleaningLogDocument({ payload }: { payload: FacilityCleaningLogPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>iWorkr Audit Copy</Text>
        <Text style={styles.title}>Facility Cleaning & Task Log</Text>
        <Text style={styles.subtitle}>
          {payload.facilityName} · {payload.startDate} to {payload.endDate}
        </Text>
        <Text style={styles.subtitle}>
          Generated {new Date(payload.generatedAt).toLocaleString("en-AU")} by {payload.generatedBy}
        </Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.cellHead, styles.cDate]}>Date</Text>
          <Text style={[styles.cellHead, styles.cTask]}>Task</Text>
          <Text style={[styles.cellHead, styles.cStatus]}>Status</Text>
          <Text style={[styles.cellHead, styles.cWorker]}>Completed By</Text>
          <Text style={[styles.cellHead, styles.cNotes]}>Evidence / Notes</Text>
          <Text style={[styles.cellHead, styles.cPhoto]}>Photo</Text>
        </View>

        {payload.rows.length === 0 ? (
          <View style={styles.row}>
            <Text>No records found for selected period.</Text>
          </View>
        ) : (
          payload.rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <Text style={styles.cDate}>{row.target_date}</Text>
              <Text style={styles.cTask}>{row.title}</Text>
              <Text style={styles.cStatus}>{statusLabel(row.status)}</Text>
              <Text style={styles.cWorker}>
                {row.worker_name || "—"}
                {row.completed_at ? `\n${new Date(row.completed_at).toLocaleString("en-AU")}` : ""}
              </Text>
              <Text style={styles.cNotes}>
                {row.evidence_data?.value ? `Value: ${row.evidence_data.value}\n` : ""}
                {row.exemption_reason || row.evidence_data?.exemption_reason
                  ? `Exempt: ${row.exemption_reason || row.evidence_data?.exemption_reason}\n`
                  : ""}
                {row.exemption_note || "—"}
              </Text>
              <View style={styles.cPhoto}>
                {row.evidence_data?.photo_url ? (
                  <Image src={row.evidence_data.photo_url} style={styles.photo} />
                ) : (
                  <Text>—</Text>
                )}
              </View>
            </View>
          ))
        )}

        <Text style={styles.mono}>Immutable export generated via Project Choreography.</Text>
      </Page>
    </Document>
  );
}
