import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface InvoiceSentEmailProps {
  recipientName: string;
  companyName: string;
  companyLogo?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  projectName: string;
  lineItems: { description: string; quantity: number; rate: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentUrl: string;
  currency?: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function InvoiceSentEmail({
  recipientName = "David",
  companyName = "Apex Plumbing",
  invoiceNumber = "INV-1024",
  invoiceDate = "Feb 17, 2026",
  dueDate = "Mar 3, 2026",
  projectName = "Kitchen Repipe",
  lineItems = [
    { description: "Kitchen Repipe — Labour", quantity: 1, rate: 3200, total: 3200 },
    { description: "Materials (PEX-A)", quantity: 1, rate: 1850, total: 1850 },
    { description: "Permit Fee", quantity: 1, rate: 285, total: 285 },
  ],
  subtotal = 5335,
  tax = 0,
  total = 5335,
  paymentUrl = "https://iworkrapp.com/pay",
  currency = "USD",
}: InvoiceSentEmailProps) {
  return (
    <EmailLayout preview={`Invoice ${invoiceNumber} from ${companyName} — ${formatCurrency(total, currency)}`}>
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
          💸 Invoice
        </span>
      </Section>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        Invoice from {companyName}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Hi {recipientName}, thanks for letting us handle the{" "}
        <strong style={{ color: colors.text }}>{projectName}</strong> project.
        You can settle this securely in seconds.
      </Text>

      {/* Invoice summary card */}
      <Section style={styles.infoCard}>
        {/* Header row */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "16px" }}>
          <tr>
            <td style={{ fontSize: "12px", color: colors.muted }}>
              {invoiceNumber}
            </td>
            <td style={{ fontSize: "12px", color: colors.muted, textAlign: "right" as const }}>
              Issued {invoiceDate}
            </td>
          </tr>
        </table>

        {/* Line items */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", borderCollapse: "collapse" }}>
          {/* Header */}
          <tr>
            <td style={tableHeader}>Description</td>
            <td style={{ ...tableHeader, textAlign: "center" as const, width: "50px" }}>Qty</td>
            <td style={{ ...tableHeader, textAlign: "right" as const, width: "80px" }}>Amount</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ height: "1px", backgroundColor: colors.cardBorder }} />
          </tr>

          {/* Items */}
          {lineItems.map((item, i) => (
            <React.Fragment key={i}>
              <tr>
                <td style={tableCell}>{item.description}</td>
                <td style={{ ...tableCell, textAlign: "center" as const }}>{item.quantity}</td>
                <td style={{ ...tableCell, textAlign: "right" as const, fontWeight: 500 }}>
                  {formatCurrency(item.total, currency)}
                </td>
              </tr>
            </React.Fragment>
          ))}

          {/* Divider */}
          <tr>
            <td colSpan={3} style={{ height: "1px", backgroundColor: colors.cardBorder, paddingTop: "8px" }} />
          </tr>

          {/* Subtotal */}
          {tax > 0 && (
            <>
              <tr>
                <td colSpan={2} style={{ ...totalLabel }}>Subtotal</td>
                <td style={{ ...totalValue }}>{formatCurrency(subtotal, currency)}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ ...totalLabel }}>Tax</td>
                <td style={{ ...totalValue }}>{formatCurrency(tax, currency)}</td>
              </tr>
            </>
          )}

          {/* Total */}
          <tr>
            <td colSpan={2} style={{ ...totalLabel, color: colors.white, fontWeight: 600, fontSize: "15px", paddingTop: "12px" }}>
              Total Due
            </td>
            <td style={{ ...totalValue, color: colors.green, fontWeight: 700, fontSize: "18px", paddingTop: "12px" }}>
              {formatCurrency(total, currency)}
            </td>
          </tr>
        </table>

        {/* Due date */}
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginTop: "16px" }}>
          <tr>
            <td style={{ fontSize: "11px", color: colors.muted }}>
              Due by <strong style={{ color: colors.text }}>{dueDate}</strong>
            </td>
          </tr>
        </table>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={paymentUrl} style={styles.buttonLarge}>
          Pay {formatCurrency(total, currency)} →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        This invoice was sent by {companyName} via iWorkr. If you have
        questions about this invoice, reply to this email or contact {companyName} directly.
      </Text>
    </EmailLayout>
  );
}

const tableHeader: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: colors.muted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  padding: "0 0 8px",
};

const tableCell: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  padding: "10px 0",
  verticalAlign: "top",
  lineHeight: "18px",
};

const totalLabel: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  padding: "6px 0 0",
  textAlign: "right" as const,
  paddingRight: "16px",
};

const totalValue: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  padding: "6px 0 0",
  textAlign: "right" as const,
  fontWeight: 500,
};
