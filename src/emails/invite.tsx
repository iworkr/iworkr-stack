import { Button, Text, Section, Hr, Img } from "@react-email/components";
import * as React from "react";
import { EmailLayout, styles, colors } from "./components/layout";

interface InviteEmailProps {
  inviteeName?: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  /** Dynamic workspace branding (Project Genesis) */
  brandColorHex?: string;
  logoUrl?: string;
}

/**
 * Calculates whether black or white text provides better contrast
 * against the given background hex color (WCAG luminance check).
 */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default function InviteEmail({
  inviteeName,
  inviterName = "Someone",
  companyName = "a team",
  role = "Technician",
  inviteUrl = "https://iworkrapp.com/join",
  brandColorHex,
  logoUrl,
}: InviteEmailProps) {
  // Dynamic brand color — falls back to iWorkr green
  const ctaColor = brandColorHex || colors.green;
  const ctaTextColor = getContrastColor(ctaColor);

  return (
    <EmailLayout preview={`You've been invited to join ${companyName} on iWorkr`}>
      {/* Brand accent line — uses workspace brand color */}
      <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%", marginBottom: "28px" }}>
        <tr>
          <td style={{
            ...styles.accentLine,
            background: `linear-gradient(90deg, transparent, ${ctaColor}, transparent)`,
          }} />
        </tr>
      </table>

      {/* Workspace logo — if provided, replaces the badge */}
      {logoUrl ? (
        <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
          <Img
            src={logoUrl}
            alt={companyName}
            height="40"
            style={{ display: "inline-block", maxHeight: "40px", objectFit: "contain" as const }}
          />
        </Section>
      ) : (
        <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
          <span style={{
            ...styles.badge,
            backgroundColor: colors.greenBg,
            color: colors.green,
            border: `1px solid ${colors.greenBorder}`,
          }}>
            🤝 Team Invite
          </span>
        </Section>
      )}

      <Text style={{ ...styles.heading, textAlign: "center" as const }}>
        {inviterName} invited you to join {companyName}
      </Text>
      <Text style={{ ...styles.subheading, textAlign: "center" as const }}>
        {inviteeName ? `Hi ${inviteeName}, ` : "Hi there, "}
        {inviterName} has invited you to join{" "}
        <strong style={{ color: colors.white }}>{companyName}</strong> as a{" "}
        <strong style={{ color: colors.white }}>{role}</strong>.
      </Text>

      <Text style={{ ...styles.paragraph, textAlign: "center" as const }}>
        Click the button below to set up your account and access your dashboard.
      </Text>

      {/* Invite details card */}
      <Section style={styles.infoCard}>
        <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
          <tr>
            <td style={detailLabel}>Organization</td>
            <td style={detailValue}>{companyName}</td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={detailLabel}>Your Role</td>
            <td style={detailValue}>
              <span style={{
                ...styles.badge,
                backgroundColor: colors.greenBg,
                color: colors.green,
                border: `1px solid ${colors.greenBorder}`,
                fontSize: "10px",
                padding: "3px 8px",
              }}>
                {role}
              </span>
            </td>
          </tr>
          <tr><td colSpan={2} style={{ height: "12px" }} /></tr>
          <tr>
            <td style={detailLabel}>Invited by</td>
            <td style={detailValue}>{inviterName}</td>
          </tr>
        </table>
      </Section>

      {/* CTA — dynamically branded with workspace color */}
      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <Button href={inviteUrl} style={{
          ...styles.buttonLarge,
          backgroundColor: ctaColor,
          color: ctaTextColor,
        }}>
          Join the Team →
        </Button>
      </Section>

      <Hr style={{ borderTop: `1px solid ${colors.cardBorder}`, margin: "24px 0 20px" }} />

      <Text style={styles.smallText}>
        This link will expire in 7 days. If you did not expect this invitation,
        you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

const detailLabel: React.CSSProperties = {
  fontSize: "13px",
  color: colors.muted,
  verticalAlign: "middle",
  whiteSpace: "nowrap" as const,
};

const detailValue: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
  fontWeight: 500,
  textAlign: "right" as const,
  verticalAlign: "middle",
};
