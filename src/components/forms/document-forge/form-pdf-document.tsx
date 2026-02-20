"use client";

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormBlock } from "@/lib/forms-data";

/* ── PDF: High-contrast print/light (PRD 58.0). Inter/Mono via built-in Helvetica/Courier ────────────── */

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerLeft: {
    fontSize: 10,
    color: "#666",
  },
  headerRight: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#333",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#000",
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: "#000",
    marginBottom: 4,
  },
  value: {
    fontSize: 10,
    fontFamily: "Courier",
    color: "#333333",
    marginBottom: 12,
  },
  signatureBox: {
    height: 60,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    marginBottom: 12,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
  },
});

interface FormPdfDocumentProps {
  title: string;
  blocks: FormBlock[];
  jobId?: string;
  generatedAt?: string;
}

export function FormPdfDocument({
  title,
  blocks,
  jobId = "—",
  generatedAt,
}: FormPdfDocumentProps) {
  const date = generatedAt || new Date().toISOString().slice(0, 10);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerLeft}>iWorkr</Text>
          <Text style={styles.headerRight}>
            {jobId} · {date}
          </Text>
        </View>

        <Text style={styles.title}>{title}</Text>

        {blocks.map((block) => {
          if (block.type === "heading") {
            return (
              <Text key={block.id} style={[styles.label, { marginTop: 12, marginBottom: 6 }]}>
                {block.label}
              </Text>
            );
          }
          if (block.type === "signature") {
            return (
              <View key={block.id}>
                <Text style={styles.label}>
                  {block.label}
                  {block.required ? " *" : ""}
                </Text>
                <View style={styles.signatureBox} />
              </View>
            );
          }
          return (
            <View key={block.id}>
              <Text style={styles.label}>
                {block.label}
                {block.required ? " *" : ""}
              </Text>
              <Text style={styles.value}>—</Text>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text>Page 1 of 1</Text>
          <Text>Generated securely by iWorkr</Text>
        </View>
      </Page>
    </Document>
  );
}
