/**
 * @module dispatch-arrival-sms
 * @status COMPLETE
 * @auth UNSECURED — No user auth; invoked by DB trigger or direct call with service_role key
 * @description Project Outrider-Pulse — Sends tracking URL via ClickSend SMS (Twilio fallback)
 *   when a tracking session is created. Supports Trade and Care modes.
 * @dependencies ClickSend (primary), Twilio (fallback), Supabase (DB)
 * @lastAudit 2026-03-24
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

interface DispatchPayload {
  session_id?: string;
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

async function sendViaClickSend(
  to: string,
  body: string,
  customString?: string,
): Promise<{ success: boolean; message_id?: string }> {
  const username = Deno.env.get("CLICKSEND_USERNAME");
  const apiKey = Deno.env.get("CLICKSEND_API_KEY");

  if (!username || !apiKey) return { success: false };

  const auth = "Basic " + btoa(`${username}:${apiKey}`);

  try {
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        messages: [
          {
            source: "iWorkr",
            from: Deno.env.get("CLICKSEND_SENDER_ID") || "iWorkr",
            to,
            body: body.slice(0, 960),
            custom_string: customString || "",
          },
        ],
      }),
    });

    if (!res.ok) return { success: false };

    const data = await res.json();
    const msg = data?.data?.messages?.[0];
    return {
      success: msg?.status === "SUCCESS" || msg?.status === "success",
      message_id: msg?.message_id,
    };
  } catch {
    return { success: false };
  }
}

async function sendViaTwilio(
  to: string,
  body: string,
): Promise<{ success: boolean; sid?: string }> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioSid || !twilioAuth || !twilioFrom) return { success: false };

  try {
    const params = new URLSearchParams({
      To: to,
      From: twilioFrom,
      Body: body.slice(0, 1600),
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
        },
        body: params.toString(),
      },
    );

    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: true, sid: data.sid };
  } catch {
    return { success: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: DispatchPayload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Resolve session ──
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
      sessionId = payload.record.id;
      sessionData = payload.record as any;
    } else if (payload.session_id) {
      sessionId = payload.session_id;
      const { data, error } = await supabase
        .from("tracking_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (error || !data) throw new Error(`Session not found: ${sessionId}`);
      sessionData = data;
    } else {
      throw new Error("No session_id or record provided");
    }

    if (sessionData.sms_dispatched) {
      return new Response(
        JSON.stringify({ success: true, message: "SMS already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Get client ──
    if (!sessionData.client_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No client linked to session" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: client } = await supabase
      .from("clients")
      .select("name, phone, email")
      .eq("id", sessionData.client_id)
      .single();

    if (!client?.phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Client has no phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Workspace branding ──
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", sessionData.workspace_id)
      .single();

    const orgName = org?.name || "iWorkr";
    const workerName = sessionData.worker_name || "Your technician";
    const workerRole = sessionData.worker_role || "technician";
    const clientFirstName = client.name?.split(" ")[0] || "there";

    // ── 4. Build tracking URL ──
    const baseUrl = Deno.env.get("TRACKING_BASE_URL") || "https://iworkr.app";
    const trackingUrl = `${baseUrl}/track/${sessionData.secure_token}`;

    // ── 5. Compose SMS ──
    let smsBody: string;
    const isCareMode =
      workerRole.toLowerCase().includes("support") ||
      workerRole.toLowerCase().includes("care");

    if (isCareMode) {
      smsBody =
        `Hi ${clientFirstName}, ${workerName} (Support Worker) from ${orgName} is on the way. ` +
        `Track their arrival here: ${trackingUrl}`;
    } else {
      smsBody =
        `Hi ${clientFirstName}, ${workerName} from ${orgName} is on the way. ` +
        `Track their arrival live: ${trackingUrl}`;
    }

    // ── 6. Send via ClickSend (primary) or Twilio (fallback) ──
    let smsSent = false;
    let smsProvider = "clicksend";
    let messageId: string | null = null;

    const clickResult = await sendViaClickSend(client.phone, smsBody, sessionId);
    if (clickResult.success) {
      smsSent = true;
      smsProvider = "clicksend";
      messageId = clickResult.message_id || null;
    } else {
      const twilioResult = await sendViaTwilio(client.phone, smsBody);
      if (twilioResult.success) {
        smsSent = true;
        smsProvider = "twilio";
        messageId = twilioResult.sid || null;
      }
    }

    // ── 7. Update session ──
    await supabase
      .from("tracking_sessions")
      .update({
        sms_dispatched: smsSent,
        sms_dispatched_at: smsSent ? new Date().toISOString() : null,
        sms_provider: smsProvider,
        sms_message_id: messageId,
        sms_sid: messageId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    console.log(
      `[dispatch-arrival-sms] Session ${sessionId}: SMS ${smsSent ? "SENT" : "FAILED"} via ${smsProvider} to ${client.phone} (ID: ${messageId})`,
    );

    return new Response(
      JSON.stringify({
        success: smsSent,
        sms_provider: smsProvider,
        sms_message_id: messageId,
        client_name: client.name,
        client_phone: client.phone,
        tracking_url: trackingUrl,
        message: smsSent
          ? `SMS sent to ${client.name} via ${smsProvider}`
          : "SMS delivery failed on all providers",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[dispatch-arrival-sms] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
