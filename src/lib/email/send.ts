/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resend } from "resend";
import type { ReactElement } from "react";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) throw new Error("RESEND_API_KEY environment variable is required");
    _resend = new Resend(resendApiKey);
  }
  return _resend;
}

const DEFAULT_FROM_ADDRESS = "iWorkr <noreply@iworkrapp.com>";
const REPLY_TO = process.env.ADMIN_EMAIL || "admin@iworkrapp.com";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  /** Custom from address for whitelabel — uses workspace custom domain if verified */
  from?: string;
}

/**
 * Resolve the FROM address for a workspace.
 * If the workspace has a verified custom domain, sends from dispatch@theirdomain.com.
 * Otherwise, sends from the default iWorkr address.
 */
export function resolveFromAddress(branding?: {
  dns_status?: string;
  custom_email_domain?: string;
} | null, workspaceName?: string): string {
  if (
    branding?.dns_status === "verified" &&
    branding.custom_email_domain
  ) {
    const name = workspaceName || "Dispatch";
    return `${name} <dispatch@${branding.custom_email_domain}>`;
  }
  return DEFAULT_FROM_ADDRESS;
}

export async function sendEmail({
  to,
  subject,
  react,
  replyTo = REPLY_TO,
  tags,
  from,
}: SendEmailOptions) {
  try {
    const { data, error } = await getResend().emails.send({
      from: from || DEFAULT_FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      react,
      replyTo,
      tags,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent "${subject}" to ${to} — ID: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
