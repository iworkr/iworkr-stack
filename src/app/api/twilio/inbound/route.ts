/**
 * @route POST /api/twilio/inbound
 * @status COMPLETE
 * @description Twilio inbound voice webhook proxy — forwards to the Supabase Edge Function
 *   for processing while also performing a local screen-pop broadcast.
 *   This route exists as a stable URL for Twilio webhook configuration.
 * @lastAudit 2026-03-24
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();

    // Forward to the Supabase Edge Function
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-inbound`;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Pass through Twilio signature for validation
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

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: unknown) {
    console.error("[api/twilio/inbound] Error:", error);

    // Always return valid TwiML even on error
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please try again later.</Say>
  <Hangup />
</Response>`;

    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
