import { Button, Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface MagicLinkEmailProps {
  magicLink: string;
  email?: string;
}

export default function MagicLinkEmail({
  magicLink = "https://iworkrapp.com/auth",
  email,
}: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your sign-in link — tap to enter iWorkr">
      {/* Green accent line */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={styles.accentLine} />
        </tr>
      </table>

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        You&apos;re in. 🔑
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        No password needed — just tap below to enter your workspace.
        {email ? <><br /><span style={{ color: colors.subtle }}>Requested for {email}</span></> : ""}
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "32px 0" }}>
        <Button href={magicLink} style={styles.buttonLarge}>
          Enter Dashboard →
        </Button>
      </Section>

      {/* Security notice */}
      <Section style={{
        ...styles.infoCard,
        backgroundColor: colors.surfaceSubtle,
      }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "12px", paddingTop: "2px" }}>
              <span style={{ fontSize: "14px" }}>🔒</span>
            </td>
            <td>
              <Text style={{ fontSize: "12px", color: colors.muted, lineHeight: "18px", margin: 0 }}>
                This link expires in <strong style={{ color: colors.text }}>10 minutes</strong> and
                can only be used once. If you didn&apos;t request this, ignore it.
              </Text>
            </td>
          </tr>
        </table>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        If the button doesn&apos;t work, copy and paste this URL:
      </Text>
      <Text style={{
        fontSize: "11px",
        color: colors.subtle,
        wordBreak: "break-all" as const,
        margin: "8px 0 0",
        padding: "12px",
        backgroundColor: colors.surfaceSubtle,
        borderRadius: "8px",
        border: `1px solid ${colors.cardBorder}`,
        fontFamily: "monospace",
      }}>
        {magicLink}
      </Text>
    </EmailLayout>
  );
}
