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
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ── Header ── */}
          <Section style={header}>
            <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
              <tr>
                <td style={{ paddingTop: "32px", paddingBottom: "24px", textAlign: "center" as const }}>
                  <Img
                    src={`${BASE_URL}/logo-email.png`}
                    width="36"
                    height="36"
                    alt="iWorkr"
                    style={logoImage}
                  />
                  <Text style={logoText}>iWorkr</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Content ── */}
          <Section style={content}>
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
              © {new Date().getFullYear()} iWorkr. All rights reserved.
            </Text>
            <Text style={footerAddress}>
              The operating system for service work.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ── Brand Tokens ── */
export const colors = {
  bg: "#050505",
  card: "#0a0a0a",
  cardBorder: "rgba(255,255,255,0.06)",
  text: "#e4e4e7",
  muted: "#71717a",
  subtle: "#3f3f46",
  white: "#fafafa",
  accent: "#8b5cf6",
  accentLight: "#a78bfa",
  accentBg: "rgba(139,92,246,0.08)",
  success: "#22c55e",
  successBg: "rgba(34,197,94,0.08)",
  warning: "#f59e0b",
  warningBg: "rgba(245,158,11,0.08)",
  error: "#ef4444",
} as const;

/* ── Shared Styles ── */
const body: React.CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "0 16px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
};

const logoImage: React.CSSProperties = {
  borderRadius: "8px",
  display: "inline-block",
};

const logoText: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: colors.white,
  margin: "8px 0 0",
  letterSpacing: "-0.02em",
};

const content: React.CSSProperties = {
  backgroundColor: colors.card,
  borderRadius: "16px",
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
  margin: "0 0 4px",
};

const footerAddress: React.CSSProperties = {
  fontSize: "11px",
  color: colors.subtle,
  fontStyle: "italic",
  margin: 0,
};

/* ── Reusable Component Styles (exported for templates) ── */
export const styles = {
  heading: {
    fontSize: "24px",
    fontWeight: 600,
    color: colors.white,
    lineHeight: "32px",
    margin: "0 0 8px",
    letterSpacing: "-0.025em",
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
  button: {
    display: "inline-block",
    backgroundColor: colors.white,
    color: "#000000",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 28px",
    borderRadius: "10px",
    textAlign: "center" as const,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  buttonAccent: {
    display: "inline-block",
    backgroundColor: colors.accent,
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "12px 28px",
    borderRadius: "10px",
    textAlign: "center" as const,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
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
  badge: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "100px",
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
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
    color: colors.accentLight,
    textDecoration: "none",
  } as React.CSSProperties,
};
