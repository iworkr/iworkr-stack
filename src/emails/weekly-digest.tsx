import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface WeeklyDigestEmailProps {
  name: string;
  companyName: string;
  weekLabel: string;
  revenue: number;
  revenueChange: number;
  jobsCompleted: number;
  jobsCompletedChange: number;
  avgRating: number;
  openJobs: number;
  topTechnician?: string;
  topTechnicianJobs?: number;
  overdueInvoices?: number;
  overdueAmount?: number;
  currency?: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(change)}%`;
}

export default function WeeklyDigestEmail({
  name = "Boss",
  companyName = "Apex Plumbing",
  weekLabel = "Feb 10 – Feb 16",
  revenue = 12400,
  revenueChange = 12,
  jobsCompleted = 14,
  jobsCompletedChange = 8,
  avgRating = 4.9,
  openJobs = 6,
  topTechnician = "Mike T.",
  topTechnicianJobs = 7,
  overdueInvoices = 2,
  overdueAmount = 1800,
  currency = "USD",
}: WeeklyDigestEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`${companyName} weekly: ${formatCurrency(revenue, currency)} revenue, ${jobsCompleted} jobs closed`}>
      {/* Green accent line */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={styles.accentLine} />
        </tr>
      </table>

      {/* Badge */}
      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.greenBg,
          color: colors.green,
          border: `1px solid ${colors.greenBorder}`,
        }}>
          📊 Weekly Scoreboard
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        The numbers are up. 📈
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {companyName} · {weekLabel}
      </Text>

      {/* Big stats grid */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "24px" }}>
        <tr>
          <td style={{ width: "50%", paddingRight: "6px" }}>
            <div style={statCard}>
              <Text style={statLabel}>Revenue</Text>
              <Text style={statValue}>{formatCurrency(revenue, currency)}</Text>
              <Text style={{
                ...statChange,
                color: revenueChange >= 0 ? colors.green : colors.error,
              }}>
                {formatChange(revenueChange)} vs last week
              </Text>
            </div>
          </td>
          <td style={{ width: "50%", paddingLeft: "6px" }}>
            <div style={statCard}>
              <Text style={statLabel}>Jobs Completed</Text>
              <Text style={statValue}>{jobsCompleted}</Text>
              <Text style={{
                ...statChange,
                color: jobsCompletedChange >= 0 ? colors.green : colors.error,
              }}>
                {formatChange(jobsCompletedChange)} vs last week
              </Text>
            </div>
          </td>
        </tr>
        <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
        <tr>
          <td style={{ width: "50%", paddingRight: "6px" }}>
            <div style={statCard}>
              <Text style={statLabel}>Avg Rating</Text>
              <Text style={statValue}>{avgRating.toFixed(1)} ⭐</Text>
              <Text style={{ ...statChange, color: colors.muted }}>
                Customer satisfaction
              </Text>
            </div>
          </td>
          <td style={{ width: "50%", paddingLeft: "6px" }}>
            <div style={statCard}>
              <Text style={statLabel}>Open Jobs</Text>
              <Text style={statValue}>{openJobs}</Text>
              <Text style={{ ...statChange, color: colors.muted }}>
                In pipeline
              </Text>
            </div>
          </td>
        </tr>
      </table>

      {/* Highlights */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px" }}>
          Highlights
        </Text>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          {topTechnician && (
            <>
              <tr>
                <td style={highlightIcon}>🏆</td>
                <td style={highlightText}>
                  <strong style={{ color: colors.text }}>{topTechnician}</strong> crushed it with{" "}
                  <strong style={{ color: colors.green }}>{topTechnicianJobs} jobs</strong> this week
                </td>
              </tr>
              <tr><td colSpan={2} style={{ height: "10px" }} /></tr>
            </>
          )}
          {overdueInvoices && overdueInvoices > 0 && (
            <tr>
              <td style={highlightIcon}>⚠️</td>
              <td style={highlightText}>
                <strong style={{ color: colors.warning }}>{overdueInvoices} invoices</strong> overdue
                totaling <strong style={{ color: colors.text }}>{formatCurrency(overdueAmount || 0, currency)}</strong>
              </td>
            </tr>
          )}
          {(!topTechnician && (!overdueInvoices || overdueInvoices === 0)) && (
            <tr>
              <td style={highlightIcon}>✅</td>
              <td style={highlightText}>
                Everything&apos;s running smooth. Keep it up, {name}.
              </td>
            </tr>
          )}
        </table>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={`${BASE_URL}/dashboard`} style={styles.buttonOutline}>
          Full Analysis →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        You&apos;re receiving this because you&apos;re an admin of {companyName}.
        {" "}
        <a href={`${BASE_URL}/settings/notifications`} style={styles.link}>
          Manage email preferences
        </a>
      </Text>
    </EmailLayout>
  );
}

const statCard: React.CSSProperties = {
  backgroundColor: colors.surfaceSubtle,
  borderRadius: "12px",
  border: `1px solid ${colors.cardBorder}`,
  padding: "16px 20px",
  textAlign: "center" as const,
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  margin: "0 0 4px",
};

const statValue: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: colors.white,
  letterSpacing: "-0.03em",
  margin: "0 0 4px",
  lineHeight: "32px",
};

const statChange: React.CSSProperties = {
  fontSize: "11px",
  margin: 0,
  lineHeight: "16px",
};

const highlightIcon: React.CSSProperties = {
  width: "24px",
  fontSize: "14px",
  verticalAlign: "top",
  paddingTop: "1px",
};

const highlightText: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  lineHeight: "20px",
  paddingLeft: "8px",
};
