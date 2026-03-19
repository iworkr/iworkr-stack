// ============================================================================
// Twilio Voice Inbound — Edge Function
// ============================================================================
// Handles inbound VOIP calls via Twilio. When a customer calls the business
// number, Twilio POSTs here. We perform a screen-pop lookup, broadcast via
// Realtime, log the communication, and return TwiML routing instructions.
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Twilio signature validation ─────────────────────────────────────────
async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): Promise<boolean> {
  if (!authToken || !signature) return false;

  try {
    const sortedKeys = Object.keys(params).sort();
    let dataStr = url;
    for (const key of sortedKeys) {
      dataStr += key + params[key];
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(authToken),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(dataStr));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === signature;
  } catch (err) {
    console.error("Signature validation error:", err);
    return false;
  }
}

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

// ─── TwiML Helpers ───────────────────────────────────────────────────────
function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function emptyTwiml(): Response {
  return twimlResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  );
}

function buildDialTwiml(
  workspaceId: string,
  toNumber: string,
  routingStrategy: string,
  assignedWorkerIds: string[]
): string {
  const statusCallback = `${SUPABASE_URL}/functions/v1/twilio-voice-status`;

  if (routingStrategy === "ring_all") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(toNumber)}" timeout="30" action="${statusCallback}">
    <Client>workspace_${workspaceId}</Client>
  </Dial>
  <Say>We're sorry, no one is available to take your call. Please leave a message.</Say>
  <Record maxLength="120" action="${statusCallback}" transcribe="false" />
</Response>`;
  }

  if (routingStrategy === "sequential" && assignedWorkerIds.length > 0) {
    // Ring each worker in sequence (first available picks up)
    const clients = assignedWorkerIds
      .map((wid) => `    <Client>worker_${wid}</Client>`)
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(toNumber)}" timeout="20" action="${statusCallback}">
${clients}
  </Dial>
  <Say>We're sorry, no one is available to take your call. Please leave a message.</Say>
  <Record maxLength="120" action="${statusCallback}" transcribe="false" />
</Response>`;
  }

  // Default fallback — ring workspace client
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(toNumber)}" timeout="30" action="${statusCallback}">
    <Client>workspace_${workspaceId}</Client>
  </Dial>
  <Say>We're sorry, no one is available to take your call. Please leave a message.</Say>
  <Record maxLength="120" action="${statusCallback}" transcribe="false" />
</Response>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Main Handler ────────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return emptyTwiml();
  }

  try {
    const bodyText = await req.text();
    const params = parseFormBody(bodyText);

    // ── Validate Twilio signature in production ──────────────
    if (TWILIO_AUTH_TOKEN) {
      const twilioSig = req.headers.get("X-Twilio-Signature") || "";
      const requestUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-inbound`;
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

    const callSid = params.CallSid || "";
    const from = params.From || "";
    const to = params.To || "";
    const callStatus = params.CallStatus || "";
    const direction = params.Direction || "";

    console.log(
      `[twilio-voice-inbound] CallSid=${callSid} From=${from} To=${to} Status=${callStatus} Direction=${direction}`
    );

    // ── Handle status callbacks on this endpoint ─────────────
    // Twilio may POST status updates here if configured as the status callback
    if (
      callStatus === "completed" ||
      callStatus === "no-answer" ||
      callStatus === "busy" ||
      callStatus === "failed" ||
      callStatus === "canceled"
    ) {
      return await handleStatusCallback(params);
    }

    // ── Inbound call flow ────────────────────────────────────
    if (!from || !to) {
      console.error("[twilio-voice-inbound] Missing From or To");
      return emptyTwiml();
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Look up workspace by called number ────────────────
    const { data: phoneRecord, error: phoneErr } = await supabase
      .from("workspace_phone_numbers")
      .select("workspace_id, routing_strategy, assigned_worker_ids, friendly_name")
      .eq("phone_number", to)
      .eq("is_active", true)
      .maybeSingle();

    if (phoneErr) {
      console.error("[twilio-voice-inbound] Phone lookup error:", phoneErr);
    }

    if (!phoneRecord) {
      console.warn(`[twilio-voice-inbound] No workspace found for number: ${to}`);
      return twimlResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured. Goodbye.</Say>
  <Hangup />
</Response>`
      );
    }

    const workspaceId = phoneRecord.workspace_id;
    const routingStrategy = phoneRecord.routing_strategy || "ring_all";
    const assignedWorkerIds: string[] = phoneRecord.assigned_worker_ids || [];

    console.log(
      `[twilio-voice-inbound] Workspace=${workspaceId} Strategy=${routingStrategy}`
    );

    // ── 2. Screen-pop lookup ─────────────────────────────────
    const { data: screenPopData, error: screenPopErr } = await supabase.rpc(
      "screen_pop_lookup",
      {
        p_workspace_id: workspaceId,
        p_phone_number: from,
      }
    );

    if (screenPopErr) {
      console.error("[twilio-voice-inbound] Screen pop error:", screenPopErr);
    }

    const screenPop = screenPopData || { found: false, phone: from };

    // ── 3. Broadcast realtime screen pop ─────────────────────
    const realtimePayload = {
      type: "broadcast",
      event: "inbound_call",
      payload: {
        call_sid: callSid,
        from_number: from,
        to_number: to,
        call_status: callStatus || "ringing",
        screen_pop: screenPop,
        timestamp: new Date().toISOString(),
      },
    };

    // Use Supabase Realtime broadcast via REST
    const channelName = `inbound-call:${workspaceId}`;
    try {
      const broadcastUrl = `${SUPABASE_URL}/realtime/v1/api/broadcast`;
      const broadcastRes = await fetch(broadcastUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: channelName,
              event: "inbound_call",
              payload: realtimePayload.payload,
            },
          ],
        }),
      });

      if (!broadcastRes.ok) {
        const errText = await broadcastRes.text();
        console.error(`[twilio-voice-inbound] Broadcast failed: ${errText}`);
      } else {
        console.log(`[twilio-voice-inbound] Broadcast sent to ${channelName}`);
      }
    } catch (bcastErr) {
      console.error("[twilio-voice-inbound] Broadcast error:", bcastErr);
    }

    // ── 4. Log communication ─────────────────────────────────
    const bodyPreview = screenPop.found
      ? `Incoming call from ${screenPop.client_name}`
      : `Incoming call from ${from}`;

    const { data: logResult, error: logErr } = await supabase.rpc(
      "log_communication",
      {
        p_workspace_id: workspaceId,
        p_direction: "inbound",
        p_channel: "voice_call",
        p_status: "ringing",
        p_from_address: from,
        p_to_address: to,
        p_body_preview: bodyPreview,
        p_client_id: screenPop.found ? screenPop.client_id : null,
        p_metadata: {
          call_sid: callSid,
          routing_strategy: routingStrategy,
        },
      }
    );

    if (logErr) {
      console.error("[twilio-voice-inbound] Log communication error:", logErr);
    }

    const logId = logResult?.log_id || null;
    console.log(`[twilio-voice-inbound] Communication logged: ${logId}`);

    // ── 5. Insert VOIP call record ───────────────────────────
    if (logId) {
      const { error: voipErr } = await supabase
        .from("voip_call_records")
        .insert({
          log_id: logId,
          twilio_call_sid: callSid,
          from_number: from,
          to_number: to,
          transcript_status: "none",
        });

      if (voipErr) {
        console.error("[twilio-voice-inbound] VOIP record insert error:", voipErr);
      }
    }

    // ── 6. Return TwiML routing response ─────────────────────
    const twiml = buildDialTwiml(workspaceId, to, routingStrategy, assignedWorkerIds);
    console.log(`[twilio-voice-inbound] Returning TwiML for ${routingStrategy}`);

    return twimlResponse(twiml);
  } catch (err: any) {
    console.error("[twilio-voice-inbound] Unhandled error:", err);
    // Always return valid TwiML even on error
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please try again later.</Say>
  <Hangup />
</Response>`
    );
  }
});

// ─── Status Callback Handler ─────────────────────────────────────────────
// Handles call status updates when Twilio POSTs status callbacks here
async function handleStatusCallback(
  params: Record<string, string>
): Promise<Response> {
  const callSid = params.CallSid || "";
  const callStatus = params.CallStatus || "";
  const callDuration = parseInt(params.CallDuration || "0", 10);
  const recordingUrl = params.RecordingUrl || "";
  const recordingSid = params.RecordingSid || "";

  console.log(
    `[twilio-voice-inbound] Status callback: CallSid=${callSid} Status=${callStatus} Duration=${callDuration}`
  );

  if (!callSid) {
    return emptyTwiml();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Look up the VOIP call record
    const { data: voipRecord, error: voipErr } = await supabase
      .from("voip_call_records")
      .select("id, log_id")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (voipErr) {
      console.error("[twilio-voice-inbound] VOIP lookup error:", voipErr);
      return emptyTwiml();
    }

    if (!voipRecord) {
      console.warn(`[twilio-voice-inbound] No VOIP record for CallSid: ${callSid}`);
      return emptyTwiml();
    }

    // Map Twilio status to our comm_status
    let commStatus: string;
    switch (callStatus) {
      case "completed":
        commStatus = "completed";
        break;
      case "no-answer":
      case "busy":
      case "canceled":
        commStatus = "missed";
        break;
      case "failed":
        commStatus = "failed";
        break;
      default:
        commStatus = "completed";
    }

    // Check if this is a voicemail (has recording)
    if (recordingUrl) {
      commStatus = "voicemail";
    }

    // Update VOIP record
    const voipUpdate: Record<string, unknown> = {
      duration_seconds: callDuration,
    };
    if (recordingUrl) {
      voipUpdate.recording_url = recordingUrl;
      voipUpdate.transcript_status = "pending";
      voipUpdate.recording_duration = callDuration;
    }

    await supabase
      .from("voip_call_records")
      .update(voipUpdate)
      .eq("id", voipRecord.id);

    // Update parent communication log
    const logUpdate: Record<string, unknown> = {
      status: commStatus,
      duration_seconds: callDuration,
      updated_at: new Date().toISOString(),
    };
    if (recordingUrl) {
      logUpdate.recording_url = recordingUrl;
    }

    await supabase
      .from("communication_logs")
      .update(logUpdate)
      .eq("id", voipRecord.log_id);

    console.log(
      `[twilio-voice-inbound] Updated records for CallSid=${callSid}: status=${commStatus}, duration=${callDuration}s`
    );
  } catch (err) {
    console.error("[twilio-voice-inbound] Status callback error:", err);
  }

  return emptyTwiml();
}
