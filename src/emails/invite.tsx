import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface InviteEmailProps {
  inviteeName?: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
}

export default function InviteEmail({
  inviteeName,
  inviterName = "Someone",
  companyName = "a team",
  role = "Technician",
  inviteUrl = "https://iworkrapp.com/auth",
}: InviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} drafted you to ${companyName} on iWorkr`}>
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
          🤝 Team Invite
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {inviterName} drafted you. 🚀
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {inviteeName ? `Hey ${inviteeName}, ` : ""}
        <strong style={{ color: colors.white }}>{companyName}</strong> uses iWorkr to move fast and break nothing.
      </Text>

      <Text style={{ ...styles.paragraph, textAlign: "center" as const }}>
        {inviterName} has assigned you a seat in the workspace. Accept the
        invite to sync your schedule, jobs, and earnings.
      </Text>

      {/* Invite details card */}
      <Section style={styles.infoCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={detailLabel}>Organization</td>
            <td style={detailValue}>{companyName}</td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={detailLabel}>Your Role</td>
            <td style={detailValue}>
              <span style={{
                ...styles.badge,
                backgroundColor: colors.greenBg,
                color: colors.green,
                border: `1px solid ${colors.greenBorder}`,
                fontSize: "10px",
                padding: "3px 8px",
              }}>
                {role}
              </span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={detailLabel}>Invited by</td>
            <td style={detailValue}>{inviterName}</td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={inviteUrl} style={styles.buttonLarge}>
          Join the Team →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        This invite was sent by {inviterName} at {companyName}. If you don&apos;t recognize
        this, you can safely ignore it. The link expires in 7 days.
      </Text>
    </EmailLayout>
  );
}

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  verticalAlign: "middle",
  whiteSpace: "nowrap" as const,
};

const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  fontWeight: 500,
  textAlign: "right" as const,
  verticalAlign: "middle",
};
