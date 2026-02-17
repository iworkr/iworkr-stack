import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Font,
} from "@react-email/components";
import * as React from "react";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

/* ── Brand Tokens: "Inbox Noir" Design System ── */
export const colors = {
  /** Pure black outer body */
  bg: "#000000",
  /** Zinc-950 card surface */
  card: "#09090b",
  /** Subtle card border */
  cardBorder: "rgba(255,255,255,0.1)",
  /** Inner section backgrounds */
  surfaceSubtle: "rgba(255,255,255,0.03)",
  /** Primary text — high contrast white */
  text: "#ededed",
  /** Muted text */
  muted: "#a1a1aa",
  /** Very subtle text */
  subtle: "#52525b",
  /** Pure white */
  white: "#fafafa",
  /** Neon Green — primary accent */
  green: "#00E676",
  /** Darker green for gradients / hover */
  greenDark: "#00C853",
  /** Green tinted backgrounds */
  greenBg: "rgba(0,230,118,0.08)",
  /** Green tinted borders */
  greenBorder: "rgba(0,230,118,0.15)",
  /** Success green (same as brand) */
  success: "#00E676",
  /** Warning amber */
  warning: "#f59e0b",
  warningBg: "rgba(245,158,11,0.08)",
  /** Error red */
  error: "#ef4444",
  errorBg: "rgba(239,68,68,0.08)",
} as const;

/* ── Layout ── */
export interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ── Green Glow Header ── */}
          <Section style={glowHeader}>
            <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
              <tr>
                <td style={{
                  height: "120px",
                  background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,230,118,0.12) 0%, transparent 70%)",
                }} />
              </tr>
            </table>
          </Section>

          {/* ── Logo ── */}
          <Section style={logoSection}>
            <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
              <tr>
                <td style={{ textAlign: "center" as const, paddingBottom: "8px" }}>
                  <Img
                    src={`${BASE_URL}/logos/logo-dark-streamline.png`}
                    width="36"
                    height="36"
                    alt="iWorkr"
                    style={{ display: "inline-block", borderRadius: "8px" }}
                  />
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Card ── */}
          <Section style={card}>
            {children}
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Hr style={divider} />
            <Text style={footerLinks}>
              <Link href={BASE_URL} style={footerLink}>Website</Link>
              {" · "}
              <Link href={`${BASE_URL}/privacy`} style={footerLink}>Privacy</Link>
              {" · "}
              <Link href={`${BASE_URL}/terms`} style={footerLink}>Terms</Link>
              {" · "}
              <Link href="mailto:admin@iworkrapp.com" style={footerLink}>Support</Link>
            </Text>
            <Text style={footerCopy}>
              © {new Date().getFullYear()} iWorkr · The operating system for service work.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ── Layout Styles ── */
const body: React.CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "0 16px",
};

const glowHeader: React.CSSProperties = {
  marginTop: "-1px",
};

const logoSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginTop: "-80px",
  marginBottom: "16px",
};

const card: React.CSSProperties = {
  backgroundColor: colors.card,
  borderRadius: "12px",
  border: `1px solid ${colors.cardBorder}`,
  padding: "40px 36px",
  marginBottom: "24px",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "0 20px 40px",
};

const divider: React.CSSProperties = {
  borderTop: `1px solid ${colors.cardBorder}`,
  margin: "0 0 20px",
};

const footerLinks: React.CSSProperties = {
  fontSize: "12px",
  color: colors.muted,
  margin: "0 0 8px",
};

const footerLink: React.CSSProperties = {
  color: colors.muted,
  textDecoration: "none",
};

const footerCopy: React.CSSProperties = {
  fontSize: "11px",
  color: colors.subtle,
  margin: 0,
};

/* ── Reusable Component Styles (exported for templates) ── */
export const styles = {
  heading: {
    fontSize: "26px",
    fontWeight: 700,
    color: colors.white,
    lineHeight: "34px",
    margin: "0 0 8px",
    letterSpacing: "-0.03em",
  } as React.CSSProperties,
  subheading: {
    fontSize: "14px",
    color: colors.muted,
    lineHeight: "22px",
    margin: "0 0 28px",
  } as React.CSSProperties,
  paragraph: {
    fontSize: "14px",
    color: colors.text,
    lineHeight: "24px",
    margin: "0 0 20px",
  } as React.CSSProperties,
  /** Primary CTA — Neon Green, Black text */
  button: {
    display: "inline-block",
    backgroundColor: colors.green,
    color: "#000000",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 32px",
    borderRadius: "10px",
    textAlign: "center" as const,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  /** Secondary CTA — Ghost/Outline */
  buttonOutline: {
    display: "inline-block",
    backgroundColor: "transparent",
    color: colors.text,
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
    padding: "10px 24px",
    borderRadius: "10px",
    textAlign: "center" as const,
    border: `1px solid ${colors.cardBorder}`,
  } as React.CSSProperties,
  /** Large full-width CTA */
  buttonLarge: {
    display: "block",
    backgroundColor: colors.green,
    color: "#000000",
    fontSize: "16px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "16px 32px",
    borderRadius: "12px",
    textAlign: "center" as const,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  /** Accent badge / pill */
  badge: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 12px",
    borderRadius: "100px",
    letterSpacing: "0.03em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  /** Info card container */
  infoCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: "12px",
    border: `1px solid ${colors.cardBorder}`,
    padding: "20px 24px",
    margin: "24px 0",
  } as React.CSSProperties,
  infoRow: {
    fontSize: "13px",
    color: colors.muted,
    margin: "0 0 10px",
    lineHeight: "20px",
  } as React.CSSProperties,
  infoValue: {
    color: colors.text,
    fontWeight: 500,
  } as React.CSSProperties,
  smallText: {
    fontSize: "12px",
    color: colors.subtle,
    lineHeight: "18px",
    margin: "20px 0 0",
  } as React.CSSProperties,
  link: {
    color: colors.green,
    textDecoration: "none",
  } as React.CSSProperties,
  /** Green accent line (horizontal rule) */
  accentLine: {
    height: "2px",
    border: "none",
    background: `linear-gradient(90deg, transparent, ${colors.green}, transparent)`,
    margin: "0 0 28px",
  } as React.CSSProperties,
};
