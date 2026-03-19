// ============================================================================
// Twilio Voice Status — Edge Function
// ============================================================================
// Handles Twilio status callbacks when a call ends, is recorded, or changes
// state. Updates voip_call_records and communication_logs with final status,
// duration, and recording URLs.
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

// ─── Empty TwiML response ────────────────────────────────────────────────
function emptyTwiml(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    }
  );
}

// ─── Map Twilio status → comm_status ─────────────────────────────────────
function mapCallStatus(
  twilioStatus: string,
  hasRecording: boolean
): string {
  if (hasRecording) return "voicemail";

  switch (twilioStatus) {
    case "completed":
      return "completed";
    case "no-answer":
    case "busy":
    case "canceled":
      return "missed";
    case "failed":
      return "failed";
    case "in-progress":
      return "in_progress";
    case "ringing":
    case "queued":
    case "initiated":
      return "ringing";
    default:
      return "completed";
  }
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
      const requestUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-status`;
      const valid = await validateTwilioSignature(
        requestUrl,
        params,
        twilioSig,
        TWILIO_AUTH_TOKEN
      );

      if (!valid) {
        console.warn("[twilio-voice-status] Invalid Twilio signature — rejecting");
        return new Response("Forbidden", { status: 403 });
      }
    }

    const callSid = params.CallSid || "";
    const callStatus = params.CallStatus || "";
    const callDuration = parseInt(params.CallDuration || "0", 10);
    const recordingUrl = params.RecordingUrl || "";
    const recordingSid = params.RecordingSid || "";
    const recordingDuration = parseInt(params.RecordingDuration || "0", 10);

    console.log(
      `[twilio-voice-status] CallSid=${callSid} Status=${callStatus} Duration=${callDuration}s` +
        (recordingUrl ? ` Recording=${recordingSid}` : "")
    );

    if (!callSid) {
      console.error("[twilio-voice-status] Missing CallSid");
      return emptyTwiml();
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Look up the VOIP call record ──────────────────────
    const { data: voipRecord, error: voipLookupErr } = await supabase
      .from("voip_call_records")
      .select("id, log_id")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (voipLookupErr) {
      console.error("[twilio-voice-status] VOIP lookup error:", voipLookupErr);
      return emptyTwiml();
    }

    if (!voipRecord) {
      console.warn(
        `[twilio-voice-status] No VOIP record found for CallSid: ${callSid}`
      );
      return emptyTwiml();
    }

    // ── 2. Determine final comm status ───────────────────────
    const hasRecording = !!recordingUrl;
    const commStatus = mapCallStatus(callStatus, hasRecording);

    // ── 3. Update voip_call_records ──────────────────────────
    const voipUpdate: Record<string, unknown> = {
      duration_seconds: callDuration,
    };

    if (recordingUrl) {
      voipUpdate.recording_url = recordingUrl;
      voipUpdate.recording_duration = recordingDuration || callDuration;
      voipUpdate.transcript_status = "pending"; // AI transcription triggered separately
    }

    if (recordingSid) {
      voipUpdate.notes = voipRecord.notes
        ? `${voipRecord.notes}\nRecording: ${recordingSid}`
        : `Recording: ${recordingSid}`;
    }

    const { error: voipUpdateErr } = await supabase
      .from("voip_call_records")
      .update(voipUpdate)
      .eq("id", voipRecord.id);

    if (voipUpdateErr) {
      console.error("[twilio-voice-status] VOIP update error:", voipUpdateErr);
    } else {
      console.log(
        `[twilio-voice-status] Updated VOIP record ${voipRecord.id}: duration=${callDuration}s` +
          (hasRecording ? `, recording stored` : "")
      );
    }

    // ── 4. Update parent communication_logs ──────────────────
    const logUpdate: Record<string, unknown> = {
      status: commStatus,
      duration_seconds: callDuration,
      updated_at: new Date().toISOString(),
    };

    if (recordingUrl) {
      logUpdate.recording_url = recordingUrl;
    }

    const { error: logUpdateErr } = await supabase
      .from("communication_logs")
      .update(logUpdate)
      .eq("id", voipRecord.log_id);

    if (logUpdateErr) {
      console.error("[twilio-voice-status] Log update error:", logUpdateErr);
    } else {
      console.log(
        `[twilio-voice-status] Updated communication log ${voipRecord.log_id}: status=${commStatus}`
      );
    }

    // ── 5. Broadcast status update via Realtime ──────────────
    // Fetch workspace_id from the communication log for the channel name
    try {
      const { data: logRecord } = await supabase
        .from("communication_logs")
        .select("workspace_id, client_id")
        .eq("id", voipRecord.log_id)
        .single();

      if (logRecord?.workspace_id) {
        const channelName = `inbound-call:${logRecord.workspace_id}`;
        const broadcastUrl = `${SUPABASE_URL}/realtime/v1/api/broadcast`;

        await fetch(broadcastUrl, {
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
                event: "call_status_update",
                payload: {
                  call_sid: callSid,
                  status: commStatus,
                  duration_seconds: callDuration,
                  has_recording: hasRecording,
                  has_voicemail: commStatus === "voicemail",
                  timestamp: new Date().toISOString(),
                },
              },
            ],
          }),
        });

        console.log(
          `[twilio-voice-status] Broadcast status update to ${channelName}`
        );
      }
    } catch (bcastErr) {
      console.error("[twilio-voice-status] Broadcast error:", bcastErr);
    }

    return emptyTwiml();
  } catch (err: any) {
    console.error("[twilio-voice-status] Unhandled error:", err);
    // Always return valid TwiML even on error
    return emptyTwiml();
  }
});
