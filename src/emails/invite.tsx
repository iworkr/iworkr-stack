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
    <EmailLayout preview={`${inviterName} invited you to join ${companyName} on iWorkr`}>
      {/* Accent badge */}
      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.accentBg,
          color: colors.accentLight,
          border: `1px solid rgba(139,92,246,0.15)`,
        }}>
          Team Invite
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {inviteeName ? `Hey ${inviteeName}, you're` : "You've been"} invited
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {inviterName} has invited you to join <strong style={{ color: colors.text }}>{companyName}</strong> on iWorkr.
      </Text>

      {/* Invite details card */}
      <Section style={styles.infoCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={styles.infoRow}>
              Organization
              <br />
              <span style={styles.infoValue}>{companyName}</span>
            </td>
          </tr>
          <tr>
            <td style={styles.infoRow}>
              Your Role
              <br />
              <span style={styles.infoValue}>{role}</span>
            </td>
          </tr>
          <tr>
            <td style={styles.infoRow}>
              Invited by
              <br />
              <span style={styles.infoValue}>{inviterName}</span>
            </td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={inviteUrl} style={styles.button}>
          Accept Invite →
        </Button>
      </Section>

      <Text style={{ ...styles.paragraph, textAlign: "center" as const }}>
        Once you accept, you'll have access to scheduling, jobs, clients, and everything
        your team uses on iWorkr.
      </Text>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        This invite was sent to you by {inviterName} at {companyName}. 
        If you don't recognize this, you can safely ignore this email.
        The invite link will expire in 7 days.
      </Text>
    </EmailLayout>
  );
}
