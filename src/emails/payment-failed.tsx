import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface PaymentFailedEmailProps {
  name: string;
  companyName: string;
  planName: string;
  amount: string;
  retryDate?: string;
  attemptsLeft?: number;
}

export default function PaymentFailedEmail({
  name = "there",
  companyName = "your workspace",
  planName = "Standard",
  amount = "$97.00",
  retryDate = "in 3 days",
  attemptsLeft = 2,
}: PaymentFailedEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`Heads up: ${amount} payment failed for ${companyName} — action needed`}>
      {/* Error accent */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ height: "2px", border: "none", background: `linear-gradient(90deg, transparent, ${colors.error}, transparent)` }} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.errorBg,
          color: colors.error,
          border: "1px solid rgba(239,68,68,0.15)",
        }}>
          ⚠️ Action Required
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        Payment didn&apos;t go through
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {name}, we couldn&apos;t process your {amount} payment for {companyName}.
      </Text>

      {/* Alert card */}
      <Section style={{
        ...styles.infoCard,
        borderColor: "rgba(239,68,68,0.15)",
        backgroundColor: colors.errorBg,
      }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "12px", paddingTop: "2px" }}>
              <span style={{ fontSize: "16px" }}>🚨</span>
            </td>
            <td>
              <Text style={{ fontSize: "13px", color: colors.text, lineHeight: "20px", margin: "0 0 8px", fontWeight: 500 }}>
                Your {planName} plan is at risk
              </Text>
              <Text style={{ fontSize: "12px", color: colors.muted, lineHeight: "18px", margin: 0 }}>
                We&apos;ll automatically retry {retryDate}. After {attemptsLeft} failed
                {attemptsLeft === 1 ? " attempt" : " attempts"}, your plan will be downgraded to Free.
              </Text>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={styles.paragraph}>
        This usually happens when a card expires, has insufficient funds, or your bank
        blocks the charge. Update your payment method to keep everything running.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0 0" }}>
        <Button href={`${BASE_URL}/settings/billing`} style={{
          ...styles.button,
          backgroundColor: colors.error,
          color: "#ffffff",
        }}>
          Update Payment Method →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        If you believe this is a mistake, reply to this email and
        we&apos;ll help resolve it immediately.
      </Text>
    </EmailLayout>
  );
}
