import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface InviteAcceptedEmailProps {
  ownerName: string;
  memberName: string;
  memberEmail: string;
  companyName: string;
  role: string;
}

export default function InviteAcceptedEmail({
  ownerName = "there",
  memberName = "A new member",
  memberEmail = "member@example.com",
  companyName = "your team",
  role = "Technician",
}: InviteAcceptedEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`${memberName} just joined ${companyName} — roster updated`}>
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
          ✓ New Teammate
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {memberName} is on the roster. 🎯
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {ownerName}, your team just got stronger.
      </Text>

      {/* Member details */}
      <Section style={styles.infoCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ verticalAlign: "middle", paddingRight: "16px" }}>
              <div style={avatar}>
                {memberName.charAt(0).toUpperCase()}
              </div>
            </td>
            <td style={{ verticalAlign: "middle", width: "100%" }}>
              <Text style={{ fontSize: "15px", fontWeight: 600, color: colors.white, margin: "0 0 2px" }}>
                {memberName}
              </Text>
              <Text style={{ fontSize: "13px", color: colors.muted, margin: 0 }}>
                {memberEmail}
              </Text>
            </td>
            <td style={{ verticalAlign: "middle", whiteSpace: "nowrap" as const }}>
              <span style={{
                ...styles.badge,
                backgroundColor: colors.greenBg,
                color: colors.green,
                border: `1px solid ${colors.greenBorder}`,
                textTransform: "capitalize" as const,
              }}>
                {role}
              </span>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={styles.paragraph}>
        You can assign {memberName} to jobs, manage their permissions, and track
        their schedule from your dashboard.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0 0" }}>
        <Button href={`${BASE_URL}/dashboard/team`} style={styles.button}>
          View Team →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        You&apos;re receiving this because you&apos;re an owner of {companyName} on iWorkr.
      </Text>
    </EmailLayout>
  );
}

const avatar: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "12px",
  backgroundColor: colors.greenBg,
  color: colors.green,
  fontSize: "16px",
  fontWeight: 600,
  lineHeight: "42px",
  textAlign: "center" as const,
  border: `1px solid ${colors.greenBorder}`,
};
