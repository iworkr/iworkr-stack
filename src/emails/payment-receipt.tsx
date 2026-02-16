import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface PaymentReceiptEmailProps {
  name: string;
  companyName: string;
  invoiceNumber: string;
  amount: string;
  planName: string;
  billingPeriod: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceUrl?: string;
}

export default function PaymentReceiptEmail({
  name = "there",
  companyName = "your workspace",
  invoiceNumber = "INV-0001",
  amount = "$97.00",
  planName = "Standard",
  billingPeriod = "Feb 16, 2026 — Mar 16, 2026",
  paymentDate = "February 16, 2026",
  paymentMethod = "Visa •••• 4242",
  invoiceUrl,
}: PaymentReceiptEmailProps) {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  return (
    <EmailLayout preview={`Payment of ${amount} received — ${invoiceNumber}`}>
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
          ✓ Payment Received
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {amount}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hey {name}, your payment for {companyName} has been processed.
      </Text>

      {/* Receipt card */}
      <Section style={{
        ...styles.infoCard,
        padding: "0",
        overflow: "hidden",
      }}>
        {/* Receipt header */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{
              padding: "20px 24px",
              borderBottom: `1px solid ${colors.cardBorder}`,
              backgroundColor: "rgba(255,255,255,0.02)",
            }}>
              <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
                <tr>
                  <td>
                    <Text style={{ fontSize: "11px", fontWeight: 600, color: colors.muted, letterSpacing: "0.05em", textTransform: "uppercase" as const, margin: 0 }}>
                      Invoice
                    </Text>
                    <Text style={{ fontSize: "15px", fontWeight: 600, color: colors.white, margin: "4px 0 0" }}>
                      {invoiceNumber}
                    </Text>
                  </td>
                  <td style={{ textAlign: "right" as const, verticalAlign: "top" }}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: colors.successBg,
                      color: colors.success,
                      border: `1px solid rgba(34,197,94,0.15)`,
                    }}>
                      Paid
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        {/* Receipt body */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", padding: "20px 24px" }}>
          <tr>
            <td style={{ padding: "20px 24px" }}>
              <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
                <tr>
                  <td style={receiptLabel}>Plan</td>
                  <td style={receiptValue}>{planName}</td>
                </tr>
                <tr><td colSpan={2} style={{ height: "10px" }} /></tr>
                <tr>
                  <td style={receiptLabel}>Period</td>
                  <td style={receiptValue}>{billingPeriod}</td>
                </tr>
                <tr><td colSpan={2} style={{ height: "10px" }} /></tr>
                <tr>
                  <td style={receiptLabel}>Payment date</td>
                  <td style={receiptValue}>{paymentDate}</td>
                </tr>
                <tr><td colSpan={2} style={{ height: "10px" }} /></tr>
                <tr>
                  <td style={receiptLabel}>Payment method</td>
                  <td style={receiptValue}>{paymentMethod}</td>
                </tr>
              </table>

              <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "16px 0" }} />

              <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
                <tr>
                  <td style={{ fontSize: "14px", fontWeight: 600, color: colors.white }}>Total</td>
                  <td style={{ fontSize: "14px", fontWeight: 600, color: colors.white, textAlign: "right" as const }}>{amount}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </Section>

      {/* Actions */}
      <Section style={{ textAlign: "center" as const, margin: "24px 0 0" }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: "0 auto" }}>
          <tr>
            {invoiceUrl && (
              <td style={{ paddingRight: "8px" }}>
                <Button href={invoiceUrl} style={styles.button}>
                  Download Invoice
                </Button>
              </td>
            )}
            <td style={invoiceUrl ? { paddingLeft: "8px" } : undefined}>
              <Button href={`${BASE_URL}/settings/billing`} style={styles.buttonOutline}>
                Billing Settings
              </Button>
            </td>
          </tr>
        </table>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "28px 0 20px" }} />

      <Text style={styles.smallText}>
        This is an automated receipt for your iWorkr subscription. 
        If you have any questions about this charge, reply to this email.
      </Text>
    </EmailLayout>
  );
}

const receiptLabel: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
};

const receiptValue: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  fontWeight: 500,
  textAlign: "right" as const,
};
