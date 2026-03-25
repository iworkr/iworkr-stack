/**
 * @module clicksend-webhook
 * @status COMPLETE
 * @auth UNSECURED — Webhook receiver; validates by payload structure
 * @description Project Hermes-Matrix — Receives ClickSend delivery receipts (DLRs)
 *   and updates both communication_logs (dispatch ledger) and tracking_sessions
 *   (Outrider-Pulse) with delivery confirmation status.
 * @dependencies Supabase (DB)
 * @lastAudit 2026-03-24
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

const CLICKSEND_STATUS_MAP: Record<string, string> = {
  "200": "delivered",
  "201": "delivered",
  "301": "bounced",
  "302": "bounced",
  "303": "bounced",
  "400": "failed",
  "401": "failed",
  "402": "failed",
  "500": "failed",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let customString: string | null = null;
    let messageId: string | null = null;
    let statusCode: string | null = null;
    let status: string | null = null;

    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      customString = formData.get("custom_string") as string;
      messageId = formData.get("message_id") as string;
      statusCode = formData.get("status_code") as string;
      status = formData.get("status") as string;
    } else {
      const payload = await req.json();
      customString = payload.custom_string;
      messageId = payload.message_id;
      statusCode = String(payload.status_code || "");
      status = payload.status;
    }

    if (!customString && !messageId) {
      return new Response(
        JSON.stringify({ success: false, error: "No identifiers in DLR payload" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolvedStatus = CLICKSEND_STATUS_MAP[statusCode || ""] || status || "delivered";

    // Update communication_logs (Hermes dispatch ledger) by log ID (custom_string)
    if (customString) {
      const { error: logError } = await supabase
        .from("communication_logs")
        .update({
          status: resolvedStatus,
          provider_message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customString);

      if (logError) {
        console.warn(`[clicksend-webhook] communication_logs update failed for ${customString}:`, logError.message);
      }
    }

    // Update communication_logs by provider_message_id (fallback)
    if (messageId) {
      await supabase
        .from("communication_logs")
        .update({
          status: resolvedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_message_id", messageId);
    }

    // Update tracking_sessions (Outrider-Pulse backward compat)
    if (customString) {
      const { error: trackingError } = await supabase
        .from("tracking_sessions")
        .update({
          clicksend_status: status || resolvedStatus,
          clicksend_status_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", customString);

      if (trackingError) {
        // Not all custom_strings map to tracking sessions; this is expected
        console.log(`[clicksend-webhook] No tracking_session for ${customString} (normal for non-tracking events)`);
      }
    }

    console.log(
      `[clicksend-webhook] DLR processed: LogID=${customString}, MsgID=${messageId}, Status=${resolvedStatus}`,
    );

    return new Response(
      JSON.stringify({ success: true, status: resolvedStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[clicksend-webhook] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Webhook processing failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
