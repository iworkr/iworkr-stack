/**
 * @module ClickSend — Centralised ClickSend SMS Wrapper
 * @status COMPLETE
 * @description Project Hermes-Matrix — Pre-logs every dispatch attempt to
 *   communication_logs BEFORE sending, ensuring audit trail survives network
 *   failures. Handles segment math and delivery status updates.
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ClickSendResult {
  success: boolean;
  message_id?: string;
  segments?: number;
  cost_cents?: number;
  error?: string;
}

function calculateSegments(message: string): { segments: number; encoding: string } {
  const hasUcs2 = /[^\x00-\x7F]/.test(message);
  const limit = hasUcs2 ? 70 : 160;
  const concatLimit = hasUcs2 ? 67 : 153;
  const len = message.length;

  if (len <= limit) return { segments: 1, encoding: hasUcs2 ? "UCS-2" : "GSM-7" };
  return { segments: Math.ceil(len / concatLimit), encoding: hasUcs2 ? "UCS-2" : "GSM-7" };
}

export async function sendClickSendSMS(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  toPhone: string,
  message: string,
  eventType: string,
  options?: {
    clientId?: string;
    jobId?: string;
    workerId?: string;
    senderId?: string;
  },
): Promise<ClickSendResult> {
  const { segments } = calculateSegments(message);

  // Pre-log the attempt before network call
  let logId: string | null = null;
  try {
    const { data: logResult } = await supabase.rpc("log_dispatch_event", {
      p_workspace_id: workspaceId,
      p_event_type: eventType,
      p_channel: "sms",
      p_recipient_phone: toPhone,
      p_to_address: toPhone,
      p_body_preview: message.slice(0, 500),
      p_client_id: options?.clientId || null,
      p_job_id: options?.jobId || null,
      p_worker_id: options?.workerId || null,
      p_status: "queued",
      p_segments: segments,
    });
    logId = logResult;
  } catch (err) {
    console.error("[clicksend] Pre-log failed:", err);
  }

  const username = Deno.env.get("CLICKSEND_USERNAME");
  const apiKey = Deno.env.get("CLICKSEND_API_KEY");

  if (!username || !apiKey) {
    if (logId) {
      await supabase
        .from("communication_logs")
        .update({
          status: "failed",
          error_message: "ClickSend credentials not configured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return { success: false, error: "ClickSend not configured", segments };
  }

  const auth = "Basic " + btoa(`${username}:${apiKey}`);

  try {
    const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        messages: [
          {
            source: "iWorkr",
            from: options?.senderId || Deno.env.get("CLICKSEND_SENDER_ID") || "iWorkr",
            to: toPhone,
            body: message.slice(0, 960),
            custom_string: logId || "",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[clicksend] API error:", response.status, errBody);

      if (logId) {
        await supabase
          .from("communication_logs")
          .update({
            status: "failed",
            error_message: `HTTP ${response.status}: ${errBody.slice(0, 500)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      return { success: false, error: `HTTP ${response.status}`, segments };
    }

    const result = await response.json();
    const msg = result?.data?.messages?.[0];
    const messageId = msg?.message_id || null;
    const msgStatus = msg?.status || "unknown";
    const msgPrice = parseFloat(msg?.message_price || "0");
    const costCents = Math.round(msgPrice * 10000) / 100;

    const isSuccess = msgStatus === "SUCCESS" || msgStatus === "success";

    if (logId) {
      await supabase
        .from("communication_logs")
        .update({
          status: isSuccess ? "delivered" : "failed",
          provider_message_id: messageId,
          cost_cents: costCents,
          error_message: isSuccess ? null : msgStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return {
      success: isSuccess,
      message_id: messageId,
      segments,
      cost_cents: costCents,
    };
  } catch (err) {
    console.error("[clicksend] Dispatch error:", err);

    if (logId) {
      await supabase
        .from("communication_logs")
        .update({
          status: "failed",
          error_message: String(err).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { success: false, error: String(err), segments };
  }
}

export { calculateSegments };
