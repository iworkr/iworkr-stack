/**
 * @route POST /api/twilio/status
 * @status COMPLETE
 * @description Twilio voice status callback proxy — forwards to the Supabase Edge Function.
 *   Also triggers post-call transcription when a recording is available.
 * @lastAudit 2026-03-24
 */

import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const params = parseFormBody(bodyText);

    // Forward to the status Edge Function
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-status`;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const twilioSig = req.headers.get("X-Twilio-Signature");
    if (twilioSig) {
      headers["X-Twilio-Signature"] = twilioSig;
    }

    const edgeResponse = await fetch(edgeFnUrl, {
      method: "POST",
      headers,
      body: bodyText,
    });

    const twiml = await edgeResponse.text();

    // If call completed with a recording, trigger async transcription
    const callSid = params.CallSid || "";
    const recordingUrl = params.RecordingUrl || "";
    const callStatus = params.CallStatus || "";

    if (
      callSid &&
      recordingUrl &&
      (callStatus === "completed" || callStatus === "no-answer")
    ) {
      // Fire-and-forget transcription
      const transcribeUrl = `${SUPABASE_URL}/functions/v1/siren-voice-transcribe`;
      fetch(transcribeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          call_sid: callSid,
          recording_url: recordingUrl,
          recording_sid: params.RecordingSid || "",
        }),
      }).catch((err) => {
        console.error("[api/twilio/status] Transcription trigger error:", err);
      });
    }

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: unknown) {
    console.error("[api/twilio/status] Error:", error);

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}
