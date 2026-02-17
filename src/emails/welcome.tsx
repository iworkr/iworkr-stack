import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface WelcomeEmailProps {
  name: string;
  companyName?: string;
}

export default function WelcomeEmail({
  name = "there",
  companyName,
}: WelcomeEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`You're in${companyName ? ` — ${companyName} is live` : ""}`}>
      {/* Green accent line */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={styles.accentLine} />
        </tr>
      </table>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        You&apos;re in. 🔓
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Welcome to iWorkr{companyName ? `, ${name}` : ""}. The old way of managing fieldwork ends now.
      </Text>

      <Text style={styles.paragraph}>
        We&apos;ve prepared your command center — scheduling, dispatching, invoicing,
        and team management. No passwords to remember, just speed.
        {companyName && (
          <>
            <br /><br />
            <strong style={{ color: colors.white }}>{companyName}</strong> is all set up and ready to roll.
          </>
        )}
      </Text>

      {/* Quick start steps */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px", fontSize: "13px" }}>
          Your first 3 moves:
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={stepNumber}>1</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Draft your roster</strong>
              <br />
              <span style={{ color: colors.muted }}>Invite techs and assign roles</span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={stepNumber}>2</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Drop your first mission</strong>
              <br />
              <span style={{ color: colors.muted }}>Create a job and schedule it</span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={stepNumber}>3</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Wire up payments</strong>
              <br />
              <span style={{ color: colors.muted }}>Connect Xero, Stripe, or QuickBooks</span>
            </td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0 0" }}>
        <Button href={`${BASE_URL}/dashboard`} style={styles.buttonLarge}>
          Enter Dashboard →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        Need a hand? Reply to this email — a human will get back to you.
      </Text>
    </EmailLayout>
  );
}

const stepNumber: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  backgroundColor: colors.greenBg,
  color: colors.green,
  fontSize: "12px",
  fontWeight: 600,
  textAlign: "center" as const,
  verticalAlign: "top",
  lineHeight: "28px",
  border: `1px solid ${colors.greenBorder}`,
};

const stepText: React.CSSProperties = {
  paddingLeft: "14px",
  fontSize: "13px",
  lineHeight: "18px",
  verticalAlign: "top",
};
