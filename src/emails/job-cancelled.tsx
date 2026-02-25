import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface JobCancelledEmailProps {
  technicianName: string;
  jobTitle: string;
  clientName?: string;
  jobAddress: string;
  scheduledDate: string;
  cancellationReason?: string;
  jobId: string;
}

export default function JobCancelledEmail({
  technicianName = "there",
  jobTitle = "Service Call",
  clientName = "John Smith",
  jobAddress = "42 Oak Avenue, Suite 100",
  scheduledDate = "Monday, Feb 17",
  cancellationReason,
  jobId = "JOB-001",
}: JobCancelledEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`Cancelled: ${jobTitle} — ${jobAddress}`}>
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ ...styles.accentLine, background: `linear-gradient(90deg, transparent, ${colors.error}, transparent)` }} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.errorBg,
          color: colors.error,
          border: `1px solid rgba(239,68,68,0.15)`,
        }}>
          ❌ Cancelled
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        Job Cancelled
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {technicianName}, the following job has been cancelled.
      </Text>

      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px", letterSpacing: "0.02em", textTransform: "uppercase" as const }}>
          Cancelled Job
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
            <td style={valueCell}>{jobAddress}</td>
          </tr>
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>📅</td>
            <td style={labelCell}>Date</td>
            <td style={valueCell}>{scheduledDate}</td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, marginBottom: "16px" }}>
        <Text style={{ ...styles.paragraph, color: colors.error, fontWeight: 600, textAlign: "center" as const, margin: "0 0 8px" }}>
          Please do not travel to this site.
        </Text>
      </Section>

      {cancellationReason && (
        <Section style={{
          backgroundColor: colors.surfaceSubtle,
          borderRadius: "12px",
          border: `1px solid ${colors.cardBorder}`,
          padding: "16px 20px",
          marginBottom: "24px",
        }}>
          <Text style={{ ...styles.paragraph, fontSize: "12px", color: colors.muted, margin: "0 0 4px", textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 600 }}>
            Reason
          </Text>
          <Text style={{ ...styles.paragraph, margin: 0 }}>
            {cancellationReason}
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Button href={`${BASE_URL}/dashboard/jobs/${jobId}`} style={styles.buttonOutline}>
          View Details
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        Check your{" "}
        <a href={`${BASE_URL}/dashboard/schedule`} style={styles.link}>schedule</a>{" "}
        for updated assignments.
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
