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

const FROM_ADDRESS = "iWorkr <noreply@iworkrapp.com>";
const REPLY_TO = process.env.ADMIN_EMAIL || "admin@iworkrapp.com";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail({
  to,
  subject,
  react,
  replyTo = REPLY_TO,
  tags,
}: SendEmailOptions) {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
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
