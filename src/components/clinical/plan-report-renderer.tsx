"use client";

// Plan Report PDF Renderer — uses @react-pdf/renderer to generate NDIS evidence PDFs
// Called dynamically from the GoalMatrix page

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
  Image,
} from "@react-pdf/renderer";
import { saveAs } from "file-saver";

// ── Types ──────────────────────────────────────────────────
interface ReportParticipant {
  id: string;
  name: string;
  ndis_number?: string | null;
}

interface ReportOrg {
  name: string;
  logo_url?: string | null;
  abn?: string | null;
}

interface GoalEvidence {
  date: string;
  rating: string;
  observation: string | null;
  worker_name: string;
}

interface ReportGoal {
  goal_id: string;
  title: string;
  domain: string;
  description?: string | null;
  status: string;
  stats: {
    total: number;
    progressed: number;
    maintained: number;
    regressed: number;
  };
  evidence: GoalEvidence[];
  ai_synthesis?: string | null;
}

interface PlanReportData {
  participant: ReportParticipant;
  organization: ReportOrg;
  date_range: { from: string; to: string };
  shift_stats: { total_shifts: number; total_hours: number };
  goals: ReportGoal[];
  generated_at: string;
}

// ── Styles ─────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111111",
    paddingVertical: 48,
    paddingHorizontal: 56,
  },
  coverPage: {
    backgroundColor: "#0A0A0A",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  coverContent: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 56,
    justifyContent: "space-between",
  },
  coverTitle: {
    fontSize: 28,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 12,
    color: "#10B981",
    marginTop: 12,
    fontFamily: "Helvetica",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  coverMeta: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 8,
  },
  coverFooter: {
    paddingBottom: 48,
    paddingHorizontal: 56,
    borderTop: "1px solid #1F1F1F",
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverFooterText: {
    fontSize: 8,
    color: "#52525B",
    fontFamily: "Helvetica",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "1px solid #E4E4E7",
    paddingBottom: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
    letterSpacing: 0.3,
  },
  statGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    backgroundColor: "#F9F9FB",
    borderRadius: 8,
    padding: 16,
    border: "1px solid #E4E4E7",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  statLabel: {
    fontSize: 8,
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 3,
    textAlign: "center",
  },
  goalCard: {
    marginBottom: 24,
    border: "1px solid #E4E4E7",
    borderRadius: 8,
    overflow: "hidden",
  },
  goalCardHeader: {
    backgroundColor: "#F4F4F5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111111",
  },
  goalDomain: {
    fontSize: 8,
    color: "#10B981",
    textTransform: "uppercase",
    letterSpacing: 1,
    backgroundColor: "#10B98118",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goalBody: {
    padding: 14,
  },
  goalStatsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #F4F4F5",
  },
  goalStatPill: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontFamily: "Helvetica-Bold",
  },
  aiBox: {
    backgroundColor: "#F0FDF4",
    border: "1px solid #10B98130",
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  aiLabel: {
    fontSize: 8,
    color: "#10B981",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  aiText: {
    fontSize: 9,
    color: "#1A1A1A",
    lineHeight: 1.6,
  },
  evidenceItem: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #F4F4F5",
  },
  evidenceMeta: {
    fontSize: 8,
    color: "#71717A",
    marginBottom: 2,
  },
  evidenceText: {
    fontSize: 9,
    color: "#111111",
    lineHeight: 1.5,
  },
  progressBadge: {
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #E4E4E7",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#A1A1AA",
  },
  pageNumber: {
    fontSize: 7,
    color: "#A1A1AA",
    fontFamily: "Helvetica",
  },
});

function ratingColor(rating: string): { color: string; bg: string } {
  if (rating === "PROGRESSED") return { color: "#065F46", bg: "#D1FAE5" };
  if (rating === "REGRESSED") return { color: "#9B1C1C", bg: "#FEE2E2" };
  return { color: "#3F3F46", bg: "#F4F4F5" };
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function domainLabel(domain: string): string {
  const MAP: Record<string, string> = {
    DAILY_LIVING: "Daily Living",
    SOCIAL_COMMUNITY: "Social & Community",
    HEALTH_WELLBEING: "Health & Wellbeing",
    EMPLOYMENT: "Employment",
    LIFELONG_LEARNING: "Lifelong Learning",
    HOME_LIVING: "Home Living",
    CHOICE_CONTROL: "Choice & Control",
  };
  return MAP[domain] ?? domain;
}

// ── PDF Document Component ─────────────────────────────────
function PlanReportDocument({ data }: { data: PlanReportData }) {
  const { participant, organization, date_range, shift_stats, goals, generated_at } = data;

  const coveredGoals = goals.filter((g) => (g.stats?.total ?? 0) > 0);
  const totalProgressed = goals.reduce((s, g) => s + (g.stats?.progressed ?? 0), 0);
  const totalMaintained = goals.reduce((s, g) => s + (g.stats?.maintained ?? 0), 0);
  const totalRegressed = goals.reduce((s, g) => s + (g.stats?.regressed ?? 0), 0);

  return (
    <Document
      title={`NDIS Plan Evidence Report — ${participant.name}`}
      author={organization.name}
      creator="iWorkr"
    >
      {/* ── COVER PAGE ─────────────────────────────────── */}
      <Page size="A4" style={[S.page, S.coverPage]}>
        <View style={S.coverContent}>
          <View>
            {organization.logo_url && (
              <Image src={organization.logo_url} style={{ width: 120, height: 36, objectFit: "contain", marginBottom: 32 }} />
            )}
            <Text style={S.coverSubtitle}>NDIS Support Plan Evidence Report</Text>
            <Text style={S.coverTitle}>{participant.name}</Text>
            {participant.ndis_number && (
              <Text style={[S.coverMeta, { marginTop: 8 }]}>NDIS Number: {participant.ndis_number}</Text>
            )}
            <Text style={S.coverMeta}>
              Plan Period: {formatDateShort(date_range.from)} — {formatDateShort(date_range.to)}
            </Text>
            <Text style={S.coverMeta}>Provider: {organization.name}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 24, marginTop: 48 }}>
            <View>
              <Text style={{ fontSize: 28, color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>
                {shift_stats?.total_shifts ?? 0}
              </Text>
              <Text style={{ fontSize: 9, color: "#52525B", textTransform: "uppercase", letterSpacing: 1 }}>Shifts</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#1F1F1F" }} />
            <View>
              <Text style={{ fontSize: 28, color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>
                {shift_stats?.total_hours ?? 0}
              </Text>
              <Text style={{ fontSize: 9, color: "#52525B", textTransform: "uppercase", letterSpacing: 1 }}>Hours</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#1F1F1F" }} />
            <View>
              <Text style={{ fontSize: 28, color: "#10B981", fontFamily: "Helvetica-Bold" }}>{coveredGoals.length}</Text>
              <Text style={{ fontSize: 9, color: "#52525B", textTransform: "uppercase", letterSpacing: 1 }}>Goals Tracked</Text>
            </View>
          </View>
        </View>

        <View style={S.coverFooter}>
          <Text style={S.coverFooterText}>Generated by iWorkr · {formatDateShort(generated_at)}</Text>
          <Text style={S.coverFooterText}>Confidential — NDIS Participant Record</Text>
        </View>
      </Page>

      {/* ── STATISTICAL SUMMARY ──────────────────────── */}
      <Page size="A4" style={S.page}>
        <View style={S.sectionHeader}>
          <View style={S.sectionDot} />
          <Text style={S.sectionTitle}>Section 1 — Support Summary</Text>
        </View>

        <Text style={{ fontSize: 10, color: "#52525B", marginBottom: 16, lineHeight: 1.6 }}>
          During the plan period from {formatDateShort(date_range.from)} to {formatDateShort(date_range.to)},{" "}
          {organization.name} provided {shift_stats?.total_hours ?? 0} hours of support across{" "}
          {shift_stats?.total_shifts ?? 0} shifts for {participant.name}.
        </Text>

        <View style={S.statGrid}>
          <View style={S.statBox}>
            <Text style={S.statValue}>{goals.length}</Text>
            <Text style={S.statLabel}>Goals Tracked</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: "#10B981" }]}>{totalProgressed}</Text>
            <Text style={S.statLabel}>Progressed</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: "#71717A" }]}>{totalMaintained}</Text>
            <Text style={S.statLabel}>Maintained</Text>
          </View>
          <View style={S.statBox}>
            <Text style={[S.statValue, { color: "#F43F5E" }]}>{totalRegressed}</Text>
            <Text style={S.statLabel}>Regressed</Text>
          </View>
        </View>

        {/* Goal summary table */}
        <View style={S.sectionHeader}>
          <View style={[S.sectionDot, { backgroundColor: "#8B5CF6" }]} />
          <Text style={S.sectionTitle}>Goal Outcome Summary</Text>
        </View>

        {goals.map((g) => (
          <View key={g.goal_id} style={{ flexDirection: "row", marginBottom: 6, alignItems: "center" }}>
            <Text style={{ flex: 1, fontSize: 9, color: "#111111" }}>{g.title}</Text>
            <Text style={{ width: 100, fontSize: 8, color: "#71717A" }}>{domainLabel(g.domain)}</Text>
            <Text style={{ width: 48, fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center" }}>
              {g.stats?.total ?? 0}
            </Text>
            <View
              style={[
                S.progressBadge,
                {
                  backgroundColor: (g.stats?.progressed ?? 0) > (g.stats?.regressed ?? 0) ? "#D1FAE5" : "#F4F4F5",
                  color: (g.stats?.progressed ?? 0) > (g.stats?.regressed ?? 0) ? "#065F46" : "#52525B",
                  width: 64,
                  textAlign: "center",
                },
              ]}
            >
              <Text>
                {(g.stats?.progressed ?? 0) > (g.stats?.regressed ?? 0)
                  ? "▲ Positive"
                  : (g.stats?.regressed ?? 0) > (g.stats?.progressed ?? 0)
                  ? "▼ Review"
                  : "― Stable"}
              </Text>
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            {participant.name} · {organization.name}
          </Text>
          <Text style={S.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </View>
      </Page>

      {/* ── GOAL EVIDENCE PAGES ─────────────────────── */}
      {coveredGoals.map((goal) => {
        const filteredEvidence = (goal.evidence ?? []).filter((e) => e.observation);
        return (
          <Page key={goal.goal_id} size="A4" style={S.page}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionDot, { backgroundColor: "#8B5CF6" }]} />
              <Text style={S.sectionTitle}>Section 2 — Goal Evidence Log</Text>
            </View>

            <View style={S.goalCard}>
              <View style={S.goalCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={S.goalTitle}>{goal.title}</Text>
                  {goal.description && (
                    <Text style={{ fontSize: 8, color: "#71717A", marginTop: 2 }}>{goal.description}</Text>
                  )}
                </View>
                <Text style={S.goalDomain}>{domainLabel(goal.domain)}</Text>
              </View>

              <View style={S.goalBody}>
                {/* Stats */}
                <View style={S.goalStatsRow}>
                  <View style={[S.goalStatPill, { backgroundColor: "#D1FAE5", color: "#065F46" }]}>
                    <Text>▲ {goal.stats?.progressed ?? 0} Progressed</Text>
                  </View>
                  <View style={[S.goalStatPill, { backgroundColor: "#F4F4F5", color: "#3F3F46" }]}>
                    <Text>― {goal.stats?.maintained ?? 0} Maintained</Text>
                  </View>
                  <View style={[S.goalStatPill, { backgroundColor: "#FEE2E2", color: "#9B1C1C" }]}>
                    <Text>▼ {goal.stats?.regressed ?? 0} Regressed</Text>
                  </View>
                  <Text style={{ marginLeft: "auto", fontSize: 8, color: "#71717A" }}>
                    {goal.stats?.total ?? 0} total observations
                  </Text>
                </View>

                {/* AI Synthesis */}
                {goal.ai_synthesis && (
                  <View style={S.aiBox}>
                    <Text style={S.aiLabel}>Clinical Synthesis</Text>
                    <Text style={S.aiText}>{goal.ai_synthesis}</Text>
                  </View>
                )}

                {/* Evidence log */}
                {filteredEvidence.length === 0 ? (
                  <Text style={{ fontSize: 9, color: "#A1A1AA", fontStyle: "italic" }}>
                    No detailed observations recorded for this period.
                  </Text>
                ) : (
                  filteredEvidence.slice(0, 20).map((e, idx) => {
                    const rc = ratingColor(e.rating);
                    return (
                      <View key={idx} style={S.evidenceItem}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <Text style={S.evidenceMeta}>
                              {e.worker_name} · {formatDateShort(e.date)}
                            </Text>
                            <View style={[S.progressBadge, { backgroundColor: rc.bg, color: rc.color }]}>
                              <Text>{e.rating}</Text>
                            </View>
                          </View>
                          <Text style={S.evidenceText}>{e.observation}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            <View style={S.footer} fixed>
              <Text style={S.footerText}>
                {participant.name} · {organization.name}
              </Text>
              <Text style={S.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

// ── Public export ─────────────────────────────────────────
export async function renderPlanReport(data: PlanReportData, participantName: string): Promise<void> {
  const blob = await pdf(<PlanReportDocument data={data} />).toBlob();
  const filename = `NDIS-Plan-Report-${participantName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
  saveAs(blob, filename);
}
