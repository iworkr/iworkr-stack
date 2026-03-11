"use server";

import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";

const SendAppLinkSchema = z.object({
  phone: z.string().min(8).max(20).regex(/^\+?[\d\s()-]+$/, "Invalid phone number"),
});

export async function sendAppDownloadLink(phone: string): Promise<{ error?: string }> {
  const parsed = SendAppLinkSchema.safeParse({ phone });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return { error: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER." };
  }

  const appUrl = getAppUrl();
  const message = `Download iWorkr for your team:\niOS: https://apps.apple.com/app/iworkr\nAndroid: https://play.google.com/store/apps/details?id=com.iworkr.app\nDesktop: ${appUrl}/download`;

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
}
