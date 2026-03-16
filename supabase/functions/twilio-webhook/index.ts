import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

// ─── Twilio signature validation ─────────────────────────────────────────
async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): Promise<boolean> {
  if (!authToken || !signature) return false;

  try {
    // Build the data string: URL + sorted params concatenated
    const sortedKeys = Object.keys(params).sort();
    let dataStr = url;
    for (const key of sortedKeys) {
      dataStr += key + params[key];
    }

    // HMAC-SHA1
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(authToken),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataStr));

    // Base64 encode
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === signature;
  } catch (err) {
    console.error("Signature validation error:", err);
    return false;
  }
}

// ─── Opt-out keywords ────────────────────────────────────────────────────
const OPT_OUT_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
const OPT_IN_KEYWORDS = ["start", "yes", "unstop", "subscribe"];

// ─── Parse form-urlencoded body ──────────────────────────────────────────
function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split("&");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(
        valueParts.join("=").replace(/\+/g, " ")
      );
    }
  }
  return params;
}

// ─── Empty TwiML response ────────────────────────────────────────────────
function twimlResponse(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// ─── Lookup user by phone number ─────────────────────────────────────────
async function findUserByPhone(
  supabase: any,
  phone: string
): Promise<{ id: string; full_name: string } | null> {
  // Normalize phone: strip spaces, ensure + prefix
  let normalized = phone.replace(/\s+/g, "").replace(/[^+\d]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }

  // Try exact match first
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("phone", normalized)
    .maybeSingle();

  if (data) return data;

  // Try without leading +
  const withoutPlus = normalized.replace(/^\+/, "");
  const { data: data2 } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("phone", withoutPlus)
    .maybeSingle();

  return data2 || null;
}

// ─── Update opt-out status ───────────────────────────────────────────────
async function setOptOutStatus(
  supabase: any,
  userId: string,
  optOut: boolean
): Promise<void> {
  const now = new Date().toISOString();

  // Update profiles table
  const profileUpdate: Record<string, unknown> = {
    sms_opt_out: optOut,
  };
  if (optOut) {
    profileUpdate.sms_opt_out_at = now;
  } else {
    profileUpdate.sms_opt_out_at = null;
  }

  await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  // Update user_notification_preferences table
  const prefsUpdate: Record<string, unknown> = {
    sms_opt_out: optOut,
    sms_enabled: !optOut,
  };
  if (optOut) {
    prefsUpdate.sms_opt_out_at = now;
  } else {
    prefsUpdate.sms_opt_out_at = null;
  }

  await supabase
    .from("user_notification_preferences")
    .update(prefsUpdate)
    .eq("user_id", userId);

  // Mark any pending SMS in the queue as opted_out
  if (optOut) {
    await supabase
      .from("outbound_queue")
      .update({ status: "opted_out" })
      .eq("user_id", userId)
      .eq("channel", "sms")
      .in("status", ["pending", "processing"]);
  }

  console.log(
    `SMS opt-${optOut ? "out" : "in"} updated for user ${userId}`
  );
}

// ─── Main Handler ────────────────────────────────────────────────────────
serve(async (req) => {
  // Twilio sends POST with form-urlencoded body
  if (req.method !== "POST") {
    return twimlResponse();
  }

  try {
    const bodyText = await req.text();
    const params = parseFormBody(bodyText);

    // Validate Twilio signature in production
    if (TWILIO_AUTH_TOKEN) {
      const twilioSig = req.headers.get("X-Twilio-Signature") || "";
      const requestUrl = `${SUPABASE_URL}/functions/v1/twilio-webhook`;
      const valid = await validateTwilioSignature(
        requestUrl,
        params,
        twilioSig,
        TWILIO_AUTH_TOKEN
      );

      if (!valid) {
        console.warn("Invalid Twilio signature — rejecting request");
        return new Response("Forbidden", { status: 403 });
      }
    }

    const from = params.From || "";
    const messageBody = (params.Body || "").trim().toLowerCase();

    if (!from || !messageBody) {
      return twimlResponse();
    }

    // Determine intent
    const isOptOut = OPT_OUT_KEYWORDS.includes(messageBody);
    const isOptIn = OPT_IN_KEYWORDS.includes(messageBody);

    if (!isOptOut && !isOptIn) {
      // Not an opt-out/in keyword — ignore silently
      return twimlResponse();
    }

    // Find the user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const user = await findUserByPhone(supabase, from);

    if (!user) {
      console.warn(`No user found for phone: ${from}`);
      // Return empty TwiML — don't reveal user existence
      return twimlResponse();
    }

    // Process opt-out or opt-in
    if (isOptOut) {
      await setOptOutStatus(supabase, user.id, true);
      console.log(`User ${user.id} (${user.full_name}) opted OUT of SMS`);
      return twimlResponse(
        "You have been unsubscribed from iWorkr SMS notifications. Reply START to re-subscribe."
      );
    }

    if (isOptIn) {
      await setOptOutStatus(supabase, user.id, false);
      console.log(`User ${user.id} (${user.full_name}) opted IN to SMS`);
      return twimlResponse(
        "You have been re-subscribed to iWorkr SMS notifications. Reply STOP to unsubscribe."
      );
    }

    return twimlResponse();
  } catch (err: any) {
    console.error("Twilio webhook error:", err);
    // Always return valid TwiML even on error
    return twimlResponse();
  }
});
