/**
 * @module process-outbound
 * @status COMPLETE
 * @auth UNSECURED — No user auth; service_role batch processor for outbound_queue
 * @description Multi-channel outbound message processor (SMS via Twilio, email via Resend, push via notifications table) with retry and backoff
 * @dependencies Twilio, Resend, Supabase
 * @lastAudit 2026-03-22
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MockResend, isTestEnv } from "../_shared/mockClients.ts";

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "notifications@iworkrapp.com";
const MAX_RETRIES = 3;
const BATCH_SIZE = isTestEnv ? 1 : 50;

// ─── Types ───────────────────────────────────────────────────────────────
interface QueueRow {
  id: string;
  organization_id: string;
  user_id: string;
  channel: "sms" | "email" | "push";
  priority: number;
  recipient_address: string;
  payload_subject: string | null;
  payload_body: string;
  payload_metadata: Record<string, unknown>;
  event_type: string;
  status: string;
  provider_message_id: string | null;
  cost_microcents: number;
  retry_count: number;
  execute_after: string;
  created_at: string;
  processed_at: string | null;
}

interface SendResult {
  success: boolean;
  provider_message_id?: string;
  cost_microcents?: number;
  error?: string;
}

// ─── Twilio SMS Sender ──────────────────────────────────────────────────
async function sendSms(
  to: string,
  body: string,
  senderId?: string
): Promise<SendResult> {
  if (isTestEnv) {
    return {
      success: true,
      provider_message_id: "SM_TEST_123",
      cost_microcents: 0,
    };
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: "Twilio not configured" };
  }

  // Truncate to 160 chars for single SMS segment
  const truncatedBody = body.length > 160 ? body.substring(0, 157) + "..." : body;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const formData = new URLSearchParams();
  formData.set("To", to);
  formData.set("Body", truncatedBody);

  // Use sender ID if alphanumeric, otherwise use the FROM number
  if (senderId && /^[a-zA-Z0-9]{1,11}$/.test(senderId)) {
    formData.set("From", senderId);
  } else {
    formData.set("From", TWILIO_FROM_NUMBER);
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        success: false,
        error: data.message || `Twilio HTTP ${resp.status}`,
      };
    }

    // Estimate cost: ~$0.0079 per SMS segment = 790 microcents
    return {
      success: true,
      provider_message_id: data.sid,
      cost_microcents: 790,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Resend Email Sender ────────────────────────────────────────────────
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  if (isTestEnv) {
    const mock = await MockResend.send({ to, subject, body });
    return { success: true, provider_message_id: String(mock.id), cost_microcents: 0 };
  }
  if (!RESEND_API_KEY) {
    return { success: false, error: "Resend not configured" };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject: subject || "Notification from iWorkr",
        text: body,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return {
        success: false,
        error: data.message || `Resend HTTP ${resp.status}`,
      };
    }

    return {
      success: true,
      provider_message_id: data.id,
      cost_microcents: 0, // Email is included in plan
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Push Notification (delegate to existing send-push function) ────────
async function sendPush(
  userId: string,
  subject: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<SendResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Insert into notifications table which triggers the existing push flow
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title: subject || "iWorkr",
      body: body.substring(0, 200),
      type: (metadata.event_type as string) || "general",
      data: metadata,
      read: false,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, cost_microcents: 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Exponential Backoff Helper ─────────────────────────────────────────
function getBackoffMs(retryCount: number): number {
  // 1s, 4s, 16s (capped)
  return Math.min(1000 * Math.pow(4, retryCount), 60000);
}

// ─── Process a single queue row ─────────────────────────────────────────
async function processRow(
  supabase: any,
  row: QueueRow
): Promise<{ status: string; result: SendResult }> {
  let result: SendResult;

  // Get sender ID from workspace settings
  let senderId: string | undefined;
  if (row.channel === "sms") {
    const { data: ws } = await supabase
      .from("workspace_communication_settings")
      .select("twilio_sender_id")
      .eq("organization_id", row.organization_id)
      .maybeSingle();
    senderId = ws?.twilio_sender_id || "iWorkr";
  }

  switch (row.channel) {
    case "sms":
      result = await sendSms(row.recipient_address, row.payload_body, senderId);
      break;
    case "email":
      result = await sendEmail(
        row.recipient_address,
        row.payload_subject || "Notification from iWorkr",
        row.payload_body
      );
      break;
    case "push":
      result = await sendPush(
        row.user_id,
        row.payload_subject || "iWorkr",
        row.payload_body,
        row.payload_metadata
      );
      break;
    default:
      result = { success: false, error: `Unknown channel: ${row.channel}` };
  }

  let finalStatus: string;

  if (result.success) {
    finalStatus = "sent";
  } else if (row.retry_count >= MAX_RETRIES - 1) {
    finalStatus = "failed";
  } else {
    // Schedule retry with exponential backoff
    const backoffMs = getBackoffMs(row.retry_count + 1);
    const executeAfter = new Date(Date.now() + backoffMs).toISOString();

    await supabase
      .from("outbound_queue")
      .update({
        status: "pending",
        retry_count: row.retry_count + 1,
        execute_after: executeAfter,
      })
      .eq("id", row.id);

    return { status: "retrying", result };
  }

  // Update final status
  await supabase
    .from("outbound_queue")
    .update({
      status: finalStatus,
      provider_message_id: result.provider_message_id || null,
      cost_microcents: result.cost_microcents || 0,
      processed_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return { status: finalStatus, result };
}

// ─── Main Handler ───────────────────────────────────────────────────────
serve(async (req) => {
  // Only allow POST
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Claim a batch of pending messages using the DB function
    const { data: batch, error: claimError } = await supabase.rpc(
      "process_outbound_batch",
      { p_batch_size: BATCH_SIZE }
    );

    if (claimError) {
      console.error("Batch claim error:", claimError);
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!batch || batch.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, failed: 0, retrying: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Process each row
    const summary = { processed: batch.length, sent: 0, failed: 0, retrying: 0 };
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const row of batch as QueueRow[]) {
      try {
        const { status, result } = await processRow(supabase, row);
        results.push({
          id: row.id,
          status,
          error: result.error,
        });

        if (status === "sent") summary.sent++;
        else if (status === "failed") summary.failed++;
        else if (status === "retrying") summary.retrying++;
      } catch (err: any) {
        console.error(`Error processing ${row.id}:`, err.message);
        // Mark as failed on unexpected error
        await supabase
          .from("outbound_queue")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        summary.failed++;
        results.push({ id: row.id, status: "failed", error: err.message });
      }
    }

    console.log(`Processed ${summary.processed}: ${summary.sent} sent, ${summary.failed} failed, ${summary.retrying} retrying`);

    return new Response(
      JSON.stringify({ ...summary, results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Process outbound error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
