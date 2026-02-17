import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface JobAssignedEmailProps {
  technicianName: string;
  jobTitle: string;
  clientName: string;
  clientAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  assignedBy: string;
  jobId: string;
}

export default function JobAssignedEmail({
  technicianName = "there",
  jobTitle = "Service Call",
  clientName = "John Smith",
  clientAddress = "42 Oak Avenue",
  scheduledDate = "Monday, Feb 17",
  scheduledTime = "9:00 AM",
  notes,
  assignedBy = "Your manager",
  jobId = "JOB-001",
}: JobAssignedEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}`;

  return (
    <EmailLayout preview={`New mission: ${jobTitle} — ${clientAddress} at ${scheduledTime}`}>
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
          📍 New Mission
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {clientAddress.split(",")[0]}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {technicianName}, {assignedBy} just assigned you a job.
      </Text>

      {/* Briefing card */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px", letterSpacing: "0.02em", textTransform: "uppercase" as const }}>
          Mission Briefing
        </Text>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={iconCell}>📋</td>
            <td style={labelCell}>Job</td>
            <td style={valueCell}>{jobTitle}</td>
          </tr>
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>👤</td>
            <td style={labelCell}>Client</td>
            <td style={valueCell}>{clientName}</td>
          </tr>
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>📍</td>
            <td style={labelCell}>Address</td>
            <td style={valueCell}>
              <a href={mapsUrl} style={styles.link}>{clientAddress}</a>
            </td>
          </tr>
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>📅</td>
            <td style={labelCell}>Date</td>
            <td style={valueCell}>{scheduledDate}</td>
          </tr>
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>⏰</td>
            <td style={labelCell}>Time</td>
            <td style={{ ...valueCell, color: colors.green, fontWeight: 600 }}>{scheduledTime}</td>
          </tr>
          {notes && (
            <>
              <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
              <tr>
                <td style={iconCell}>📝</td>
                <td style={labelCell}>Notes</td>
                <td style={valueCell}>{notes}</td>
              </tr>
            </>
          )}
        </table>
      </Section>

      {/* Action buttons */}
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: "0 auto" }}>
          <tr>
            <td style={{ paddingRight: "8px" }}>
              <Button href={`${BASE_URL}/dashboard/jobs/${jobId}`} style={styles.button}>
                View Mission Control →
              </Button>
            </td>
            <td style={{ paddingLeft: "8px" }}>
              <Button href={mapsUrl} style={styles.buttonOutline}>
                Open Maps
              </Button>
            </td>
          </tr>
        </table>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        All your missions live in the{" "}
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
