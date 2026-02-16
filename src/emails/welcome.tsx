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
    <EmailLayout preview={`Welcome to iWorkr${companyName ? ` — ${companyName} is ready` : ""}`}>
      {/* Gradient accent line */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ height: "2px", background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)` }} />
        </tr>
      </table>

      <Text style={styles.heading}>
        Welcome to iWorkr{companyName ? `, ${name}` : ""}
      </Text>
      <Text style={styles.subheading}>
        {companyName
          ? `${companyName} is all set up and ready to go.`
          : "Your account is ready. Let's get your workspace set up."}
      </Text>

      <Text style={styles.paragraph}>
        You now have access to the complete operating system for service work — scheduling, 
        dispatching, invoicing, and team management, all in one place.
      </Text>

      {/* Quick start steps */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 16px" }}>
          Quick Start
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={stepNumber}>1</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Set up your team</strong>
              <br />
              <span style={{ color: colors.muted }}>Invite technicians and assign roles</span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={stepNumber}>2</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Create your first job</strong>
              <br />
              <span style={{ color: colors.muted }}>Add a job and schedule it to a team member</span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={stepNumber}>3</td>
            <td style={stepText}>
              <strong style={{ color: colors.text }}>Connect your tools</strong>
              <br />
              <span style={{ color: colors.muted }}>Link Xero, Stripe, or QuickBooks</span>
            </td>
          </tr>
        </table>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0 0" }}>
        <Button href={`${BASE_URL}/dashboard`} style={styles.button}>
          Open Dashboard →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        Need help getting started? Reply to this email or check out our{" "}
        <a href={`${BASE_URL}/docs`} style={styles.link}>documentation</a>.
        We're here to help you succeed.
      </Text>
    </EmailLayout>
  );
}

const stepNumber: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  backgroundColor: colors.accentBg,
  color: colors.accentLight,
  fontSize: "12px",
  fontWeight: 600,
  textAlign: "center" as const,
  verticalAlign: "top",
  lineHeight: "28px",
  border: `1px solid rgba(139,92,246,0.15)`,
};

const stepText: React.CSSProperties = {
  paddingLeft: "14px",
  fontSize: "13px",
  lineHeight: "18px",
  verticalAlign: "top",
};
