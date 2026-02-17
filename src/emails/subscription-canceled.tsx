import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface SubscriptionCanceledEmailProps {
  name: string;
  companyName: string;
  planName: string;
  endDate: string;
  isImmediate?: boolean;
}

export default function SubscriptionCanceledEmail({
  name = "there",
  companyName = "your workspace",
  planName = "Standard",
  endDate = "March 16, 2026",
  isImmediate = false,
}: SubscriptionCanceledEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout
      preview={
        isImmediate
          ? `Your ${planName} subscription has been canceled`
          : `Your ${planName} plan will end on ${endDate}`
      }
    >
      {/* Warning accent */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ height: "2px", border: "none", background: `linear-gradient(90deg, transparent, ${colors.warning}, transparent)` }} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.warningBg,
          color: colors.warning,
          border: `1px solid rgba(245,158,11,0.15)`,
        }}>
          {isImmediate ? "Subscription Canceled" : "Subscription Ending"}
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {isImmediate ? "We'll miss you" : "Your plan is ending soon"}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {isImmediate
          ? `Hey ${name}, your ${planName} subscription for ${companyName} has been canceled.`
          : `Hey ${name}, your ${planName} plan for ${companyName} will end on ${endDate}.`}
      </Text>

      {/* What happens next */}
      <Section style={styles.infoCard}>
        <Text style={{ ...styles.paragraph, fontWeight: 600, color: colors.white, margin: "0 0 14px" }}>
          What happens {isImmediate ? "now" : "next"}
        </Text>

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={bulletCell}>→</td>
            <td style={bulletText}>
              {isImmediate
                ? "Your workspace has been moved to the Free plan"
                : `You'll keep full access to ${planName} features until ${endDate}`}
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "8px" }} /></tr>
          <tr>
            <td style={bulletCell}>→</td>
            <td style={bulletText}>
              Your data, clients, and job history are safe — nothing is deleted
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "8px" }} /></tr>
          <tr>
            <td style={bulletCell}>→</td>
            <td style={bulletText}>
              Features beyond the Free plan limits will be restricted {isImmediate ? "now" : `after ${endDate}`}
            </td>
          </tr>
        </table>
      </Section>

      <Text style={{ ...styles.paragraph, textAlign: "center" as const }}>
        Changed your mind? Resubscribe anytime to restore full access instantly.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0 0" }}>
        <Button href={`${BASE_URL}/settings/billing`} style={styles.button}>
          Resubscribe →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        If you have feedback about why you canceled, reply to this email.
        Your input helps us build a better product.
      </Text>
    </EmailLayout>
  );
}

const bulletCell: React.CSSProperties = {
  width: "20px",
  fontSize: "13px",
  color: colors.green,
  verticalAlign: "top",
  paddingTop: "1px",
};

const bulletText: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  lineHeight: "20px",
};
