/**
 * @module resend-webhook
 * @status COMPLETE
 * @auth SECURED — Svix HMAC signature verification on webhook payloads
 * @description Handles Resend email event webhooks (delivered, bounced, complained, opened) with signature verification, bounce flagging, email log updates, and DLQ routing on failure.
 * @dependencies Resend (Svix webhooks), Supabase
 * @lastAudit 2026-03-22
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, resend-signature, svix-id, svix-timestamp, svix-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function verifyResendSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = `${svixId}.${svixTimestamp}.${body}`;
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computedSig = btoa(String.fromCharCode(...new Uint8Array(signed)));

  const expectedSignatures = svixSignature
    .split(" ")
    .map((s) => s.replace(/^v1,/, ""));

  return expectedSignatures.includes(computedSig);
}

function extractTag(tags: { name: string; value: string }[] | undefined, tagName: string): string | null {
  if (!tags) return null;
  const tag = tags.find((t) => t.name === tagName);
  return tag?.value ?? null;
}

const ResendWebhookSchema = z.object({
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.opened",
  ]),
  created_at: z.string().datetime().optional(),
  data: z.object({
    email_id: z.string().optional(),
    to: z.array(z.string().email()).optional(),
    tags: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
    reason: z.string().optional(),
  }),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(req) });
  }

  const body = await req.text();
  let parsedBody: unknown = {};
  try {
    parsedBody = body ? JSON.parse(body) : {};
  } catch {
    return new Response(
      JSON.stringify({
        error: "Malformed Payload",
        details: [{ message: "Request body must be valid JSON" }],
      }),
      {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }

  const validation = ResendWebhookSchema.safeParse(parsedBody);
  if (!validation.success) {
    return new Response(
      JSON.stringify({
        error: "Malformed Payload",
        details: validation.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      }),
      {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }

  if (!RESEND_WEBHOOK_SECRET) {
    console.error("RESEND_WEBHOOK_SECRET is not set");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const valid = await verifyResendSignature(body, svixId, svixTimestamp, svixSignature, RESEND_WEBHOOK_SECRET);
    if (!valid) {
      console.error("Invalid Resend webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Signature verification error:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const webhook = validation.data;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { type, data } = webhook;
  const emailLogId = extractTag(data.tags, "email_log_id");
  const bouncedEmails = data.to ?? [];

  try {
    switch (type) {
      case "email.delivered": {
        if (emailLogId) {
          await supabase
            .from("email_logs")
            .update({ status: "delivered" })
            .eq("id", emailLogId);
        }
        break;
      }

      case "email.bounced": {
        if (emailLogId) {
          await supabase
            .from("email_logs")
            .update({ status: "bounced" })
            .eq("id", emailLogId);
        }

        for (const email of bouncedEmails) {
          await flagBouncedProfile(supabase, email, "email_bounce", `Email bounced: ${email}`);
        }
        break;
      }

      case "email.complained": {
        if (emailLogId) {
          await supabase
            .from("email_logs")
            .update({ status: "complained" })
            .eq("id", emailLogId);
        }

        for (const email of bouncedEmails) {
          await flagBouncedProfile(supabase, email, "email_complaint", `Email complaint: ${email}`);
        }
        break;
      }

      case "email.opened": {
        if (emailLogId) {
          const { data: existing } = await supabase
            .from("email_logs")
            .select("metadata")
            .eq("id", emailLogId)
            .single();
          const meta = (existing?.metadata as Record<string, unknown>) ?? {};
          await supabase
            .from("email_logs")
            .update({ metadata: { ...meta, opened_at: new Date().toISOString() } })
            .eq("id", emailLogId);
        }
        break;
      }

      default:
        console.log(`Unhandled Resend event: ${type}`);
    }
  } catch (err) {
    console.error(`Resend webhook error [${type}]:`, err);

    // ── DLQ: Route failed event to dead letter queue ──
    try {
      await supabase.from("webhook_dead_letters").insert({
        provider: "resend",
        event_type: type,
        payload: webhook,
        error_message: (err as Error).message || String(err),
        status: "DEAD",
      });
    } catch (dlqErr) {
      console.error("DLQ insert also failed:", dlqErr);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});

async function flagBouncedProfile(
  supabase: ReturnType<typeof createClient>,
  email: string,
  eventType: string,
  description: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) return;

  await supabase
    .from("profiles")
    .update({ email_bounced: true })
    .eq("id", profile.id);

  await supabase.from("audit_log").insert({
    action: `email.${eventType}`,
    entity_type: "profile",
    entity_id: profile.id,
    new_data: { email, description },
  });
}
