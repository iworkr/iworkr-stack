// Edge Function: semantic-voice-router
// Project Hermes-Scribe — Voice-to-Ledger Engine
// Pipeline: Audio upload → Whisper transcription → GPT-4o Function Calling
// → Structured actions → HITL review queue

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── OpenAI Function Calling Tool Definitions ──────────── */

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "draft_shift_note",
      description:
        "Draft a professional, sanitized shift note from the worker's narrative. Sanitize colloquial language into objective, clinical documentation.",
      parameters: {
        type: "object",
        properties: {
          context_of_support: {
            type: "string",
            description:
              "Sanitized, professional description of shift activities",
          },
          outcomes_achieved: {
            type: "string",
            description: "Key outcomes achieved during the shift",
          },
          risks_identified: {
            type: "string",
            description: "Any risks or concerns identified",
          },
        },
        required: ["context_of_support"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_medication",
      description:
        "Log a medication administration event. Call this when the worker mentions giving, administering, or the participant taking any medication.",
      parameters: {
        type: "object",
        properties: {
          medication_name: {
            type: "string",
            description: "Name of the medication",
          },
          dosage_amount: {
            type: "string",
            description: "Dosage amount and unit (e.g. '10mg', '5ml')",
          },
          approximate_time: {
            type: "string",
            description: "Time of administration (HH:MM or natural language)",
          },
          was_refused: {
            type: "boolean",
            description: "Whether the participant refused the medication",
          },
          route: {
            type: "string",
            description: "Route: oral, topical, injection, sublingual",
          },
        },
        required: ["medication_name", "was_refused"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_incident",
      description:
        "Create an incident report. Call this if the worker mentions injury, outburst, aggression, property damage, abuse, neglect, falls, medication errors, or restrictive practices (locking doors, physical restraint). ALWAYS flag restrictive practices.",
      parameters: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            description: "Severity level of the incident",
          },
          incident_type: {
            type: "string",
            description:
              "Category: behavioral, injury, property_damage, medication_error, abuse, neglect, restrictive_practice, fall, other",
          },
          objective_description: {
            type: "string",
            description:
              "Court-ready, clinically objective description. No slang. No subjective terms like 'crazy' or 'aggressive'. Use 'dysregulation', 'behavioral escalation', 'physical aggression'.",
          },
          is_sirs_reportable: {
            type: "boolean",
            description:
              "True if: abuse, neglect, restrictive practice, serious injury, or death. These require NDIS Commission SIRS reporting within 24 hours.",
          },
          involves_restrictive_practice: {
            type: "boolean",
            description:
              "True if worker mentions: locking a door, holding someone down, seclusion, chemical restraint, physical restraint",
          },
          injuries_observed: {
            type: "string",
            description: "Description of injuries if any",
          },
        },
        required: [
          "severity",
          "incident_type",
          "objective_description",
          "is_sirs_reportable",
        ],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_goal_progress",
      description:
        "Log progress toward a participant's goal. Call this when the worker mentions working on a specific goal, skill, or training activity.",
      parameters: {
        type: "object",
        properties: {
          goal_name: {
            type: "string",
            description:
              "Name or description of the goal (e.g. 'Transit Independence', 'Self-care Routine')",
          },
          progress_rating: {
            type: "string",
            enum: [
              "EXCEEDED",
              "PROGRESSING",
              "MAINTAINED",
              "REGRESSED",
              "NOT_ADDRESSED",
            ],
            description: "Rating of progress during this session",
          },
          observation: {
            type: "string",
            description:
              "Clinical observation of the participant's progress. Objective, professional language.",
          },
        },
        required: ["goal_name", "progress_rating", "observation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_purchase_order",
      description:
        "Create a purchase order for materials. Call this when a tradesperson mentions needing to order supplies, parts, or materials.",
      parameters: {
        type: "object",
        properties: {
          supplier_name: {
            type: "string",
            description: "Supplier name if mentioned",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                estimated_cost: { type: "number" },
              },
              required: ["description", "quantity"],
            },
            description: "Materials/parts to order",
          },
          urgency: {
            type: "string",
            enum: ["STANDARD", "URGENT", "CRITICAL"],
          },
          delivery_notes: { type: "string" },
        },
        required: ["items"],
      },
    },
  },
];

/* ── Care-sector system prompt ─────────────────────────── */

const CARE_SYSTEM_PROMPT = `You are a clinical NLP router for an NDIS disability support provider. 
You receive unstructured audio transcripts from exhausted support workers debriefing after shifts.

Your responsibilities:
1. ALWAYS call draft_shift_note to create a sanitized, professional shift summary.
2. Extract ALL medications mentioned → call log_medication for each one.
3. Detect ANY incidents (agitation, injury, property damage, falls, medication errors) → call create_incident.
4. If any RESTRICTIVE PRACTICE is mentioned (locking doors, physical restraint, seclusion, chemical restraint), you MUST flag is_sirs_reportable=true and involves_restrictive_practice=true. This is a legal requirement.
5. Match any goal-related activities to log_goal_progress.

CRITICAL RULES:
- Sanitize ALL language. Replace "crazy", "pissed off", "lost it" with clinical terms: "dysregulation", "behavioral escalation", "acute distress".
- NEVER use subjective, non-clinical language in any output.
- If the worker says "I locked the door" or "I held them down", this is an Unauthorized Restrictive Practice — ALWAYS create a HIGH/CRITICAL incident with is_sirs_reportable=true.
- If audio is vague about medication dosage, still log it but note the ambiguity.
- Be thorough — extract EVERY actionable data point.`;

const TRADE_SYSTEM_PROMPT = `You are an operations NLP router for a field service company (plumbing, electrical, HVAC, etc.).
You receive audio transcripts from technicians in the field.

Your responsibilities:
1. ALWAYS call draft_shift_note to summarize work performed.
2. If materials or supplies are mentioned for ordering → call create_purchase_order.
3. If any safety incidents are mentioned → call create_incident.
4. Map product descriptions to standard trade terminology.

Keep language professional and concise.`;

/* ── Whisper Transcription ─────────────────────────────── */

async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  contextPrompt: string
): Promise<{ transcript: string; confidence: number; language: string }> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: "audio/mp4" }),
    "audio.m4a"
  );
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("prompt", contextPrompt);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error: ${err}`);
  }

  const data = await res.json();
  return {
    transcript: data.text ?? "",
    confidence: data.avg_logprob
      ? Math.max(0, Math.min(1, 1 + data.avg_logprob))
      : 0.85,
    language: data.language ?? "en",
  };
}

/* ── LLM Semantic Routing ──────────────────────────────── */

async function routeTranscript(
  transcript: string,
  sector: string
): Promise<{
  actions: Record<string, unknown>[];
  sanitized: string;
}> {
  const systemPrompt =
    sector === "trade" ? TRADE_SYSTEM_PROMPT : CARE_SYSTEM_PROMPT;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Process this shift debrief transcript and extract all structured data:\n\n"${transcript}"`,
        },
      ],
      tools: TOOLS,
      tool_choice: "required",
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  const toolCalls = message?.tool_calls ?? [];

  const actions: Record<string, unknown>[] = [];
  let sanitizedNote = "";

  for (const call of toolCalls) {
    const fnName = call.function?.name;
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function?.arguments ?? "{}");
    } catch {
      continue;
    }

    const actionTypeMap: Record<string, string> = {
      draft_shift_note: "shift_note",
      log_medication: "medication",
      create_incident: "incident",
      log_goal_progress: "goal_progress",
      create_purchase_order: "purchase_order",
    };

    const actionType = actionTypeMap[fnName] ?? fnName;
    const confidence = estimateConfidence(actionType, args);

    if (fnName === "draft_shift_note") {
      sanitizedNote = (args.context_of_support as string) ?? "";
    }

    actions.push({
      action_type: actionType,
      confidence,
      data: args,
      warnings: generateWarnings(actionType, args),
    });
  }

  return { actions, sanitized: sanitizedNote };
}

/* ── Confidence Estimation ─────────────────────────────── */

function estimateConfidence(
  actionType: string,
  args: Record<string, unknown>
): number {
  let confidence = 0.9;

  if (actionType === "medication") {
    if (!args.dosage_amount) confidence -= 0.3;
    if (!args.approximate_time) confidence -= 0.15;
    if (!args.medication_name) confidence -= 0.4;
  } else if (actionType === "incident") {
    if (!args.severity) confidence -= 0.2;
    if (!args.objective_description) confidence -= 0.3;
  } else if (actionType === "goal_progress") {
    if (!args.goal_name) confidence -= 0.25;
    if (!args.observation) confidence -= 0.2;
  }

  return Math.max(0.1, Math.min(1, confidence));
}

function generateWarnings(
  actionType: string,
  args: Record<string, unknown>
): string[] {
  const warnings: string[] = [];

  if (actionType === "medication" && !args.dosage_amount) {
    warnings.push("Dosage not specified in audio — manual verification required");
  }
  if (actionType === "incident" && args.involves_restrictive_practice) {
    warnings.push(
      "RESTRICTIVE PRACTICE DETECTED — SIRS report required within 24 hours"
    );
  }
  if (actionType === "incident" && args.is_sirs_reportable) {
    warnings.push("SIRS-reportable incident — statutory deadline applies");
  }

  return warnings;
}

/* ── Main Handler ──────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      debrief_id,
      organization_id,
      audio_storage_path,
      sector = "care",
      context_names = [],
      context_medications = [],
      context_goals = [],
    } = body as {
      debrief_id: string;
      organization_id: string;
      audio_storage_path: string;
      sector?: string;
      context_names?: string[];
      context_medications?: string[];
      context_goals?: string[];
    };

    if (!debrief_id || !organization_id || !audio_storage_path) {
      return new Response(
        JSON.stringify({ error: "debrief_id, organization_id, audio_storage_path required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to TRANSCRIBING
    await supabase
      .from("audio_debriefs")
      .update({ status: "TRANSCRIBING", updated_at: new Date().toISOString() })
      .eq("id", debrief_id);

    // Download audio from storage
    const { data: audioData, error: storageErr } = await supabase.storage
      .from("audio-debriefs")
      .download(audio_storage_path);

    if (storageErr || !audioData) {
      throw new Error(`Storage download failed: ${storageErr?.message}`);
    }

    // Build Whisper context prompt
    const contextPrompt = [
      ...context_names,
      ...context_medications,
      ...context_goals,
    ].join(", ");

    // Transcribe with Whisper
    const audioBuffer = await audioData.arrayBuffer();
    const { transcript, confidence: whisperConfidence, language } =
      await transcribeAudio(audioBuffer, contextPrompt);

    if (!transcript || transcript.trim().length < 5) {
      await supabase
        .from("audio_debriefs")
        .update({
          status: "FAILED",
          error_message: "Transcript too short or empty",
          raw_transcript: transcript,
          whisper_confidence: whisperConfidence,
          updated_at: new Date().toISOString(),
        })
        .eq("id", debrief_id);

      return new Response(
        JSON.stringify({ error: "Transcript too short", transcript }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Abort if Whisper confidence is too low
    if (whisperConfidence < 0.7) {
      await supabase
        .from("audio_debriefs")
        .update({
          status: "FAILED",
          error_message: `Audio unclear — Whisper confidence ${(whisperConfidence * 100).toFixed(0)}%. Please review raw transcript or type manually.`,
          raw_transcript: transcript,
          whisper_confidence: whisperConfidence,
          whisper_language: language,
          updated_at: new Date().toISOString(),
        })
        .eq("id", debrief_id);

      return new Response(
        JSON.stringify({
          error: "Audio unclear",
          whisper_confidence: whisperConfidence,
          transcript,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to ROUTING
    await supabase
      .from("audio_debriefs")
      .update({
        status: "ROUTING",
        raw_transcript: transcript,
        whisper_confidence: whisperConfidence,
        whisper_language: language,
        updated_at: new Date().toISOString(),
      })
      .eq("id", debrief_id);

    // Run semantic routing
    const { actions, sanitized } = await routeTranscript(transcript, sector);

    // Calculate overall confidence
    const overallConfidence =
      actions.length > 0
        ? actions.reduce((s, a) => s + ((a.confidence as number) ?? 0), 0) /
          actions.length
        : 0;

    // Update debrief with proposed actions
    await supabase
      .from("audio_debriefs")
      .update({
        status: "PENDING_REVIEW",
        sanitized_transcript: sanitized,
        llm_model_used: "gpt-4o",
        llm_routing_result: { tool_calls_count: actions.length },
        proposed_actions: actions,
        overall_confidence: overallConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", debrief_id);

    return new Response(
      JSON.stringify({
        debrief_id,
        status: "PENDING_REVIEW",
        transcript,
        sanitized_transcript: sanitized,
        whisper_confidence: whisperConfidence,
        overall_confidence: overallConfidence,
        actions,
        action_count: actions.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";

    // Try to update debrief status to FAILED
    try {
      const body = await req.clone().json();
      if (body.debrief_id) {
        await supabase
          .from("audio_debriefs")
          .update({
            status: "FAILED",
            error_message: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.debrief_id);
      }
    } catch { /* ignore cleanup errors */ }

    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
