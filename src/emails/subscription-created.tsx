import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface SubscriptionCreatedEmailProps {
  name: string;
  companyName: string;
  planName: string;
  price: string;
  billingCycle: string;
  trialDays?: number;
  nextBillingDate?: string;
}

export default function SubscriptionCreatedEmail({
  name = "there",
  companyName = "your workspace",
  planName = "Standard",
  price = "$97",
  billingCycle = "monthly",
  trialDays = 14,
  nextBillingDate,
}: SubscriptionCreatedEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";
  const isTrial = trialDays > 0;

  return (
    <EmailLayout
      preview={
        isTrial
          ? `Your ${trialDays}-day free trial of ${planName} has started`
          : `${companyName} is now on the ${planName} plan`
      }
    >
      {/* Success accent */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{ height: "2px", background: `linear-gradient(90deg, transparent, ${colors.success}, transparent)` }} />
        </tr>
      </table>

      <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
        <span style={{
          ...styles.badge,
          backgroundColor: colors.successBg,
          color: colors.success,
          border: `1px solid rgba(34,197,94,0.15)`,
        }}>
          {isTrial ? "Trial Started" : "Subscription Active"}
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {isTrial
          ? `Your free trial is live`
          : `You're on the ${planName} plan`}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {isTrial
          ? `Hey ${name}, enjoy ${trialDays} days of full access to ${planName}.`
          : `Hey ${name}, ${companyName} is now upgraded.`}
      </Text>

      {/* Plan details card */}
      <Section style={styles.infoCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ textAlign: "center" as const, paddingBottom: "16px" }}>
              <Text style={{ fontSize: "11px", fontWeight: 600, color: colors.muted, letterSpacing: "0.05em", textTransform: "uppercase" as const, margin: "0 0 8px" }}>
                Your Plan
              </Text>
              <Text style={{ fontSize: "28px", fontWeight: 600, color: colors.white, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                {planName}
              </Text>
              <Text style={{ fontSize: "14px", color: colors.muted, margin: 0 }}>
                {price}/{billingCycle === "yearly" ? "yr" : "mo"}
              </Text>
            </td>
          </tr>
        </table>

        <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "0 0 16px" }} />

        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={detailLabel}>Organization</td>
            <td style={detailValue}>{companyName}</td>
          </tr>
          <tr><td colSpan={2} style={{ height: "8px" }} /></tr>
          <tr>
            <td style={detailLabel}>Billing</td>
            <td style={detailValue}>{billingCycle === "yearly" ? "Annual" : "Monthly"}</td>
          </tr>
          {isTrial && (
            <>
              <tr><td colSpan={2} style={{ height: "8px" }} /></tr>
              <tr>
                <td style={detailLabel}>Trial ends</td>
                <td style={detailValue}>
                  {nextBillingDate || `In ${trialDays} days`}
                </td>
              </tr>
            </>
          )}
          {!isTrial && nextBillingDate && (
            <>
              <tr><td colSpan={2} style={{ height: "8px" }} /></tr>
              <tr>
                <td style={detailLabel}>Next billing</td>
                <td style={detailValue}>{nextBillingDate}</td>
              </tr>
            </>
          )}
        </table>
      </Section>

      {isTrial && (
        <Text style={{ ...styles.paragraph, textAlign: "center" as const }}>
          No charge today. Your card will be billed {price}/{billingCycle === "yearly" ? "yr" : "mo"} after the 
          trial ends. Cancel anytime from your billing settings.
        </Text>
      )}

      <Section style={{ textAlign: "center" as const, margin: "24px 0 0" }}>
        <Button href={`${BASE_URL}/settings/billing`} style={styles.button}>
          Manage Subscription →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        You can manage your subscription, update payment methods, and view invoices 
        from your{" "}
        <a href={`${BASE_URL}/settings/billing`} style={styles.link}>billing settings</a>.
      </Text>
    </EmailLayout>
  );
}

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  paddingRight: "16px",
};

const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  fontWeight: 500,
  textAlign: "right" as const,
};
