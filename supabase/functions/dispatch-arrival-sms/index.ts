/**
 * @module dispatch-arrival-sms
 * @status COMPLETE
 * @auth UNSECURED — No user auth; invoked by DB trigger or direct call with service_role key
 * @description Sends tracking URL via Twilio SMS when a tracking session is created, supports Trade and Care modes
 * @dependencies Twilio (SMS), Supabase (DB)
 * @lastAudit 2026-03-22
 */
// ============================================================================
// Project Glasshouse-Arrival — SMS Dispatch Edge Function
// ============================================================================
// Triggered when a tracking_session is created (INSERT trigger or direct call).
// 1. Fetches client phone + workspace branding
// 2. Sends tracking URL via Twilio SMS
// 3. Updates the tracking_session with SMS dispatch confirmation
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { isTestEnv } from "../_shared/mockClients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DispatchPayload {
  // Direct invocation
  session_id?: string;
  // DB trigger payload (INSERT on tracking_sessions)
  type?: string;
  table?: string;
  record?: {
    id: string;
    workspace_id: string;
    job_id: string;
    worker_id: string;
    client_id: string;
    secure_token: string;
    worker_name: string;
    worker_role: string;
    destination_address: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: DispatchPayload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Resolve session data ──────────────────────────────────────
    let sessionId: string;
    let sessionData: {
      id: string;
      workspace_id: string;
      job_id: string;
      worker_id: string;
      client_id: string | null;
      secure_token: string;
      worker_name: string | null;
      worker_role: string | null;
      destination_address: string | null;
      sms_dispatched: boolean;
    };

    if (payload.record) {
      // Triggered by DB webhook
      sessionId = payload.record.id;
      sessionData = payload.record as any;
    } else if (payload.session_id) {
      // Direct invocation
      sessionId = payload.session_id;
      const { data, error } = await supabase
        .from("tracking_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data)
        throw new Error(`Session not found: ${sessionId}`);
      sessionData = data;
    } else {
      throw new Error("No session_id or record provided");
    }

    // Skip if SMS already dispatched
    if (sessionData.sms_dispatched) {
      return new Response(
        JSON.stringify({ success: true, message: "SMS already sent" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 2. Fetch client details ────────────────────────────────────
    if (!sessionData.client_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No client linked to session" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name, phone, email")
      .eq("id", sessionData.client_id)
      .single();

    if (!client?.phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Client has no phone number",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 3. Fetch workspace branding (optional) ────────────────────
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", sessionData.workspace_id)
      .single();

    const orgName = org?.name || "iWorkr";
    const workerName = sessionData.worker_name || "Your technician";
    const workerRole = sessionData.worker_role || "technician";
    const clientName = client.name?.split(" ")[0] || "there";

    // ── 4. Build tracking URL ─────────────────────────────────────
    const baseUrl =
      Deno.env.get("TRACKING_BASE_URL") || "https://iworkr.app";
    const trackingUrl = `${baseUrl}/track/${sessionData.secure_token}`;

    // ── 5. Compose SMS message ────────────────────────────────────
    // Differentiate Trade vs Care based on worker_role
    let smsBody: string;

    if (
      workerRole.toLowerCase().includes("support") ||
      workerRole.toLowerCase().includes("care")
    ) {
      // NDIS / Care mode
      smsBody =
        `Hi ${clientName}, ${workerName} (Support Worker) from ${orgName} is on the way. ` +
        `Track their arrival here: ${trackingUrl}`;
    } else {
      // Trade mode
      smsBody =
        `Hi ${clientName}, ${workerName} from ${orgName} is on the way. ` +
        `Track their arrival live: ${trackingUrl}`;
    }

    // ── 6. Send via Twilio ────────────────────────────────────────
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioSid || !twilioAuth || !twilioFrom) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twilio not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const smsParams = new URLSearchParams({
      To: client.phone,
      From: twilioFrom,
      Body: smsBody.slice(0, 1600), // Twilio max
    });

    const twilioData = isTestEnv
      ? { sid: "SM_TEST_123" }
      : await (async () => {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
            },
            body: smsParams.toString(),
          }
        );
        if (!twilioRes.ok) return { _failed: true, ...(await twilioRes.json()) };
        return await twilioRes.json();
      })();
    const smsSent = !("_failed" in twilioData);
    const smsSid = twilioData?.sid || null;

    // ── 7. Update tracking session with SMS confirmation ──────────
    await supabase
      .from("tracking_sessions")
      .update({
        sms_dispatched: smsSent,
        sms_dispatched_at: smsSent ? new Date().toISOString() : null,
        sms_sid: smsSid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // ── 8. Log the dispatch ───────────────────────────────────────
    console.log(
      `[dispatch-arrival-sms] Session ${sessionId}: SMS ${smsSent ? "SENT" : "FAILED"} to ${client.phone} (SID: ${smsSid})`
    );

    return new Response(
      JSON.stringify({
        success: smsSent,
        sms_sid: smsSid,
        client_name: client.name,
        client_phone: client.phone,
        tracking_url: trackingUrl,
        message: smsSent
          ? `SMS sent to ${client.name}`
          : `SMS delivery failed: ${twilioData?.message || "unknown error"}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[dispatch-arrival-sms] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
