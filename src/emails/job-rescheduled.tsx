import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface JobRescheduledEmailProps {
  technicianName: string;
  jobTitle: string;
  clientName?: string;
  jobAddress: string;
  oldDate: string;
  oldTime?: string;
  newDate: string;
  newTime?: string;
  jobId: string;
}

export default function JobRescheduledEmail({
  technicianName = "there",
  jobTitle = "Service Call",
  clientName,
  jobAddress = "42 Oak Avenue, Suite 100",
  oldDate = "Monday, Feb 17",
  oldTime,
  newDate = "Wednesday, Feb 19",
  newTime,
  jobId = "JOB-001",
}: JobRescheduledEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobAddress)}`;

  return (
    <EmailLayout preview={`Rescheduled: ${jobTitle} — now ${newDate}`}>
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ ...styles.accentLine, background: `linear-gradient(90deg, transparent, ${colors.warning}, transparent)` }} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.warningBg,
          color: colors.warning,
          border: `1px solid rgba(245,158,11,0.15)`,
        }}>
          📅 Rescheduled
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        Schedule Changed
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {technicianName}, your job has been moved.
      </Text>

      {/* Schedule change card */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px", letterSpacing: "0.02em", textTransform: "uppercase" as const }}>
          Schedule Update
        </Text>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={iconCell}>📋</td>
            <td style={labelCell}>Job</td>
            <td style={valueCell}>{jobTitle}</td>
          </tr>
          {clientName && (
            <>
              <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
              <tr>
                <td style={iconCell}>👤</td>
                <td style={labelCell}>Client</td>
                <td style={valueCell}>{clientName}</td>
              </tr>
            </>
          )}
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>📍</td>
            <td style={labelCell}>Address</td>
            <td style={valueCell}>
              <a href={mapsUrl} style={styles.link}>{jobAddress}</a>
            </td>
          </tr>
        </table>
      </Section>

      {/* Old → New schedule comparison */}
      <Section style={{
        backgroundColor: colors.surfaceSubtle,
        borderRadius: "12px",
        border: `1px solid ${colors.cardBorder}`,
        padding: "20px 24px",
        margin: "0 0 24px",
      }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ width: "50%", verticalAlign: "top", paddingRight: "12px" }}>
              <Text style={{ fontSize: "11px", color: colors.muted, margin: "0 0 6px", textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 600 }}>
                Previous
              </Text>
              <Text style={{ fontSize: "15px", color: colors.muted, margin: "0", textDecoration: "line-through", fontWeight: 500 }}>
                {oldDate}
              </Text>
              {oldTime && (
                <Text style={{ fontSize: "13px", color: colors.subtle, margin: "2px 0 0", textDecoration: "line-through" }}>
                  {oldTime}
                </Text>
              )}
            </td>
            <td style={{ width: "50%", verticalAlign: "top", paddingLeft: "12px", borderLeft: `1px solid ${colors.cardBorder}` }}>
              <Text style={{ fontSize: "11px", color: colors.green, margin: "0 0 6px", textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 600 }}>
                New Schedule
              </Text>
              <Text style={{ fontSize: "15px", color: colors.green, margin: "0", fontWeight: 600 }}>
                {newDate}
              </Text>
              {newTime && (
                <Text style={{ fontSize: "13px", color: colors.green, margin: "2px 0 0", fontWeight: 500 }}>
                  {newTime}
                </Text>
              )}
            </td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Button href={`${BASE_URL}/dashboard/jobs/${jobId}`} style={styles.button}>
          View Updated Schedule →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        All your jobs live in the{" "}
        <a href={`${BASE_URL}/dashboard/schedule`} style={styles.link}>schedule</a>.
        Stay sharp out there.
      </Text>
    </EmailLayout>
  );
}

const iconCell: React.CSSProperties = {
  width: "24px",
  fontSize: "14px",
  verticalAlign: "top",
  paddingTop: "1px",
};

const labelCell: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  paddingRight: "16px",
  verticalAlign: "top",
  whiteSpace: "nowrap" as const,
};

const valueCell: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  fontWeight: 500,
  textAlign: "right" as const,
  verticalAlign: "top",
};
