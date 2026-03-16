import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

type DossierSection = {
  title: string;
  lines: string[];
};

export type AuditDossierPayload = {
  title: string;
  generatedAt: string;
  generatedBy: string;
  sections: DossierSection[];
  sha256Hash?: string;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, color: "#111111", fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 6, fontWeight: 700 },
  subtitle: { fontSize: 9, color: "#444444", marginBottom: 12 },
  section: { marginBottom: 10, borderTop: "1px solid #E5E7EB", paddingTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  line: { fontSize: 9, marginBottom: 2, lineHeight: 1.3 },
  sealBox: {
    marginTop: 14,
    padding: 8,
    border: "1px solid #111111",
    backgroundColor: "#F5F5F5",
  },
  sealTitle: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  sealValue: { fontSize: 8, fontFamily: "Courier", lineHeight: 1.2 },
});

export function AuditDossierDocument({ payload }: { payload: AuditDossierPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{payload.title}</Text>
        <Text style={styles.subtitle}>
          Generated: {new Date(payload.generatedAt).toLocaleString("en-AU")} · By: {payload.generatedBy}
        </Text>

        {payload.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lines.length === 0 ? (
              <Text style={styles.line}>No records available in selected range.</Text>
            ) : (
              section.lines.map((line, idx) => (
                <Text key={`${section.title}-${idx}`} style={styles.line}>
                  {line}
                </Text>
              ))
            )}
          </View>
        ))}

        <View style={styles.sealBox}>
          <Text style={styles.sealTitle}>Cryptographic Seal</Text>
          <Text style={styles.sealValue}>
            SHA-256: {payload.sha256Hash || "PENDING"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
