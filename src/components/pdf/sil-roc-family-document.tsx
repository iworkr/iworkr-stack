import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type SilFamilyLine = {
  ndis_line_item_code: string;
  total_hours_per_week: number;
  weekly_cost: number;
  annual_cost: number;
};

export function SilRocFamilyDocument({
  participantName,
  facilityName,
  quoteName,
  lines,
  annualTotal,
}: {
  participantName: string;
  facilityName: string;
  quoteName: string;
  lines: SilFamilyLine[];
  annualTotal: number;
}) {
  const styles = StyleSheet.create({
    page: {
      padding: 32,
      fontSize: 10,
      color: "#111827",
    },
    heading: {
      fontSize: 18,
      marginBottom: 4,
    },
    sub: {
      color: "#6b7280",
      marginBottom: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: "#e5e7eb",
      borderRadius: 6,
      padding: 10,
      marginBottom: 10,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: "#f3f4f6",
    },
    mono: {
      fontFamily: "Courier",
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>SIL Roster of Care Summary</Text>
        <Text style={styles.sub}>{quoteName}</Text>
        <View style={styles.card}>
          <Text>Participant: {participantName}</Text>
          <Text>Facility: {facilityName}</Text>
        </View>

        <View style={styles.card}>
          {lines.map((line, idx) => (
            <View key={`${line.ndis_line_item_code}-${idx}`} style={styles.row}>
              <Text>{line.ndis_line_item_code}</Text>
              <Text style={styles.mono}>
                {line.total_hours_per_week.toFixed(2)}h/wk | ${line.weekly_cost.toFixed(2)}/wk
              </Text>
            </View>
          ))}
          <View style={{ ...styles.row, borderBottomWidth: 0 }}>
            <Text>Total annual projected cost</Text>
            <Text style={styles.mono}>${annualTotal.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sub}>
          This summary is generated from the approved SIL quote matrix and is published for family review and digital signature.
        </Text>
      </Page>
    </Document>
  );
}

