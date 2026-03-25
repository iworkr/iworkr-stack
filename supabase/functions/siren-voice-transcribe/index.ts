/**
 * @module siren-voice-transcribe
 * @status COMPLETE
 * @auth SECURED — Service role only
 * @description Project Siren-Voice: Post-call transcription and AI summarization.
 *   Downloads recording from Twilio, transcribes with OpenAI Whisper,
 *   generates a GPT-4o-mini summary, and saves to voip_call_records.
 *   Injects the summary into the client CRM timeline.
 * @dependencies Supabase, OpenAI (Whisper + GPT-4o-mini), Twilio
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();
    const { call_sid, recording_url, recording_sid } = body as {
      call_sid: string;
      recording_url: string;
      recording_sid?: string;
    };

    if (!call_sid) {
      return new Response(
        JSON.stringify({ error: "call_sid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the VOIP record
    const { data: voipRecord, error: voipErr } = await supabase
      .from("voip_call_records")
      .select("id, log_id, recording_url, ai_transcript, transcript_status")
      .eq("twilio_call_sid", call_sid)
      .maybeSingle();

    if (voipErr || !voipRecord) {
      return new Response(
        JSON.stringify({ error: "VOIP record not found", details: voipErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already transcribed
    if (voipRecord.transcript_status === "completed" && voipRecord.ai_transcript) {
      return new Response(
        JSON.stringify({ status: "already_transcribed", voip_id: voipRecord.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    await supabase
      .from("voip_call_records")
      .update({ transcript_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", voipRecord.id);

    // Download recording from Twilio
    const recUrl = recording_url || voipRecord.recording_url;
    if (!recUrl) {
      await supabase
        .from("voip_call_records")
        .update({ transcript_status: "no_recording", updated_at: new Date().toISOString() })
        .eq("id", voipRecord.id);

      return new Response(
        JSON.stringify({ error: "No recording URL available" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the recording audio (Twilio requires Basic auth)
    const audioUrl = recUrl.endsWith(".mp3") ? recUrl : `${recUrl}.mp3`;
    const auth = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
      ? `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
      : undefined;

    const audioRes = await fetch(audioUrl, {
      headers: auth ? { Authorization: auth } : {},
    });

    if (!audioRes.ok) {
      throw new Error(`Failed to download recording: ${audioRes.status} ${audioRes.statusText}`);
    }

    const audioBuffer = await audioRes.arrayBuffer();

    // Transcribe with Whisper
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioBuffer], { type: "audio/mp3" }),
      "recording.mp3"
    );
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      throw new Error(`Whisper API error: ${errText}`);
    }

    const whisperData = await whisperRes.json();
    const fullTranscript = whisperData.text || "";
    const segments = whisperData.segments || [];

    if (!fullTranscript || fullTranscript.trim().length < 3) {
      await supabase
        .from("voip_call_records")
        .update({
          transcript_status: "empty",
          ai_transcript: "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", voipRecord.id);

      return new Response(
        JSON.stringify({ status: "empty_transcript", voip_id: voipRecord.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI summary
    const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Summarize this phone call transcript in 2-3 concise bullet points. Extract any action items or follow-ups needed. Format as markdown bullet points. Be factual and professional.`,
          },
          { role: "user", content: fullTranscript },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    let aiSummary = "";
    if (summaryRes.ok) {
      const summaryData = await summaryRes.json();
      aiSummary = summaryData.choices?.[0]?.message?.content || "";
    }

    // Build structured transcript JSONB
    const transcriptJsonb = {
      full_text: fullTranscript,
      segments: segments.map((seg: Record<string, unknown>) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      language: whisperData.language || "en",
      duration: whisperData.duration || 0,
      whisper_confidence: whisperData.avg_logprob
        ? Math.max(0, Math.min(1, 1 + (whisperData.avg_logprob as number)))
        : 0.85,
    };

    // Save to database
    await supabase.rpc("save_call_transcript", {
      p_call_sid: call_sid,
      p_transcript_jsonb: transcriptJsonb,
      p_ai_summary: aiSummary,
      p_ai_handled: false,
      p_ai_actions: [],
      p_sentiment_score: null,
      p_caller_intent: null,
    });

    console.log(`[siren-voice-transcribe] Transcribed call ${call_sid}: ${fullTranscript.length} chars, ${segments.length} segments`);

    return new Response(
      JSON.stringify({
        success: true,
        voip_id: voipRecord.id,
        transcript_length: fullTranscript.length,
        segments_count: segments.length,
        has_summary: !!aiSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[siren-voice-transcribe] Error:", msg);

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
