/**
 * @module SMS Server Actions
 * @status COMPLETE
 * @description SMS messaging — app download link delivery via Twilio with phone validation. All functions auth-gated via withAuth. Download links route to /download landing page.
 * @exports sendAppDownloadLink
 * @lastAudit 2026-03-22
 */
"use server";

import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { withAuth } from "@/lib/safe-action";

const SendAppLinkSchema = z.object({
  phone: z.string().min(8).max(20).regex(/^\+?[\d\s()-]+$/, "Invalid phone number"),
});

export async function sendAppDownloadLink(phone: string): Promise<{ error?: string }> {
  return withAuth(async (_user) => {
    try {
      const parsed = SendAppLinkSchema.safeParse({ phone });
      if (!parsed.success) return { error: parsed.error.issues[0].message };

      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioSid || !twilioToken || !twilioFrom) {
        return { error: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER." };
      }

      const appUrl = getAppUrl();
      // App store links redirect via the web download page until native apps are published
      const downloadUrl = `${appUrl}/download`;
      const message = `Download iWorkr for your team: ${downloadUrl}\n\nAvailable for iOS, Android, and Desktop.`;

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: twilioFrom, Body: message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: err.message || `SMS delivery failed (${res.status})` };
      }

      return {};
    } catch (err) {
      console.error("[sms] sendAppDownloadLink error:", err);
      return { error: (err as Error).message || "An unexpected error occurred" };
    }
  });
}
