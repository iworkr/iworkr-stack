import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface JobReminderEmailProps {
  technicianName: string;
  jobTitle: string;
  clientName?: string;
  jobAddress: string;
  scheduledDate: string;
  scheduledTime?: string;
  reminderType: "24h" | "1h";
  jobId: string;
}

export default function JobReminderEmail({
  technicianName = "there",
  jobTitle = "Service Call",
  clientName,
  jobAddress = "42 Oak Avenue, Suite 100",
  scheduledDate = "Monday, Feb 17",
  scheduledTime,
  reminderType = "24h",
  jobId = "JOB-001",
}: JobReminderEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobAddress)}`;
  const is1h = reminderType === "1h";

  const badgeLabel = is1h ? "🚀 Today" : "⏰ Tomorrow";
  const badgeBg = is1h ? colors.warningBg : colors.greenBg;
  const badgeColor = is1h ? colors.warning : colors.green;
  const badgeBorder = is1h ? `1px solid rgba(245,158,11,0.15)` : `1px solid ${colors.greenBorder}`;
  const timeWord = is1h ? "today" : "tomorrow";

  return (
    <EmailLayout preview={`Reminder: ${jobTitle} — ${jobAddress} ${timeWord}`}>
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={styles.accentLine} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: badgeBg,
          color: badgeColor,
          border: badgeBorder,
        }}>
          {badgeLabel}
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {jobAddress.split(",")[0]}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {technicianName}, you have a job {timeWord}.
      </Text>

      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px", letterSpacing: "0.02em", textTransform: "uppercase" as const }}>
          Job Details
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
          <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={iconCell}>📅</td>
            <td style={labelCell}>Date</td>
            <td style={valueCell}>{scheduledDate}</td>
          </tr>
          {scheduledTime && (
            <>
              <tr><td colSpan={3} style={{ height: "12px" }} /></tr>
              <tr>
                <td style={iconCell}>⏰</td>
                <td style={labelCell}>Time</td>
                <td style={{ ...valueCell, color: colors.green, fontWeight: 600 }}>{scheduledTime}</td>
              </tr>
            </>
          )}
        </table>
      </Section>

      {is1h && (
        <Section style={{ textAlign: "center" as const, marginBottom: "8px" }}>
          <Text style={{ ...styles.paragraph, color: colors.warning, fontWeight: 600, textAlign: "center" as const, margin: "0 0 20px" }}>
            Your job begins shortly. Update your status to En Route.
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: "0 auto" }}>
          <tr>
            <td style={{ paddingRight: is1h ? "8px" : "0" }}>
              <Button href={`${BASE_URL}/dashboard/jobs/${jobId}`} style={styles.button}>
                View Job Details →
              </Button>
            </td>
            {is1h && (
              <td style={{ paddingLeft: "8px" }}>
                <Button href={mapsUrl} style={styles.buttonOutline}>
                  Start Navigation
                </Button>
              </td>
            )}
          </tr>
        </table>
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
