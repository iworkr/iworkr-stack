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
    <EmailLayout preview="Your sign-in link for iWorkr">
      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        Sign in to iWorkr
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        Click the button below to securely sign in.
        {email ? ` This link was requested for ${email}.` : ""}
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "32px 0" }}>
        <Button href={magicLink} style={styles.button}>
          Sign In →
        </Button>
      </Section>

      {/* Security notice */}
      <Section style={{
        ...styles.infoCard,
        backgroundColor: "rgba(255,255,255,0.02)",
      }}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={{ verticalAlign: "top", paddingRight: "12px", paddingTop: "2px" }}>
              <span style={{ fontSize: "14px" }}>🔒</span>
            </td>
            <td>
              <Text style={{ fontSize: "12px", color: colors.muted, lineHeight: "18px", margin: 0 }}>
                This link expires in 10 minutes and can only be used once. 
                If you didn't request this, you can safely ignore this email.
              </Text>
            </td>
          </tr>
        </table>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        If the button doesn't work, copy and paste this URL into your browser:
      </Text>
      <Text style={{
        fontSize: "11px",
        color: colors.subtle,
        wordBreak: "break-all" as const,
        margin: "8px 0 0",
        padding: "12px",
        backgroundColor: "rgba(255,255,255,0.02)",
        borderRadius: "8px",
        border: `1px solid ${colors.cardBorder}`,
      }}>
        {magicLink}
      </Text>
    </EmailLayout>
  );
}
