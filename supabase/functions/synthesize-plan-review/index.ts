/**
 * @module synthesize-plan-review
 * @status COMPLETE
 * @auth UNSECURED — No auth guard; uses service-role key internally
 * @description AI-powered NDIS end-of-plan review synthesis via Gemini/OpenAI with SSE streaming from 365 days of shift notes
 * @dependencies Supabase, Google Gemini, OpenAI (fallback)
 * @lastAudit 2026-03-22
 */
// Edge Function: synthesize-plan-review
// AI End-of-Plan Review Synthesis via Gemini 1.5 Pro with SSE Streaming
// Ingests 365 days of shift notes and generates a clinical NDIS report

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert Allied Health Professional and Clinical Report Writer operating within the Australian National Disability Insurance Scheme (NDIS) framework.

Your task is to write a comprehensive, publication-quality "End of Plan Progress Report" for the participant, synthesising the operational shift data provided.

You have been provided a JSON object containing:
- Participant details (name, NDIS number, diagnosis)
- Their formal NDIS goals
- Every progress note and goal observation recorded during the review period

STRICT REQUIREMENTS:

1. TONE: Clinical, objective, professional, and person-centred. Use third person. Avoid emotional language, casual phrasing, or colloquialisms. Transform worker shorthand into formal clinical prose.

2. STRUCTURE (use exact Markdown headings):
   # End of Plan Progress Report
   ## Executive Summary
   A 2-3 paragraph overview of the participant's overall trajectory during the plan period.
   
   ## Goal Progress
   For EACH goal identified in the data:
   ### [Goal Title]
   #### Progress Summary
   A detailed narrative of the participant's progress toward this goal.
   #### Key Milestones
   Bullet points of specific, dated achievements.
   #### Ongoing Barriers
   Factors that continue to limit progress.
   #### Clinical Recommendation
   What support is recommended for the next plan period.
   
   ## Overall Clinical Observations
   Cross-cutting themes observed across all goals (e.g., mood patterns, engagement levels, environmental factors).
   
   ## Recommendations for Next Plan Period
   Numbered list of specific, actionable recommendations for the NDIS planner.

3. CITATIONS (CRITICAL - ABSOLUTE REQUIREMENT):
   You MUST NOT invent, fabricate, or embellish ANY facts.
   Every clinical claim you make MUST be supported by the provided data.
   When referencing a specific observation, event, or milestone, you MUST cite the source using this exact format: {{cite:SOURCE_ID}}
   Where SOURCE_ID is the "id" field from the progress note or goal observation JSON.
   
   Example: "The participant demonstrated improved transit independence, successfully navigating public transport unassisted {{cite:abc-123-def}}."
   
   If you cannot find supporting evidence for a claim in the data, DO NOT make the claim.

4. HANDLING CONTRADICTIONS:
   If different workers report contradictory observations, present BOTH perspectives clinically.
   Example: "Participant responses to [activity] were variable across the review period. While some sessions demonstrated high engagement {{cite:note_A}}, others resulted in dysregulation {{cite:note_B}}, suggesting the need for structured environmental supports."

5. OUTPUT: Return the report in raw Markdown format. Do not wrap in code blocks. Start immediately with the # heading.`;

interface SynthesisRequest {
  organization_id: string;
  review_id: string;
  participant: {
    id: string;
    full_name: string;
    ndis_number: string;
    primary_diagnosis: string;
    date_of_birth: string;
  };
  goals: Array<{
    id: string;
    title: string;
    goal_statement: string;
    domain?: string;
    status?: string;
    ndis_goal_category?: string;
  }>;
  progress_notes: Array<{
    id: string;
    date: string;
    content?: string;
    summary?: string;
    observations?: string;
    outcomes_achieved?: string;
    goals_addressed?: string;
    participant_mood?: string;
    context_of_support?: string;
    risks_identified?: string;
    worker_name?: string;
  }>;
  goal_observations: Array<{
    id: string;
    date: string;
    worker_observation?: string;
    progress_rating?: string;
    goal_title?: string;
    goal_statement?: string;
    worker_name?: string;
  }>;
  review_start_date: string;
  review_end_date: string;
}

/**
 * Compress context data to minimize tokens while preserving all evidence
 */
function compressContext(data: SynthesisRequest): string {
  const parts: string[] = [];

  // Participant info
  parts.push(`PARTICIPANT: ${data.participant.full_name} | NDIS: ${data.participant.ndis_number} | Diagnosis: ${data.participant.primary_diagnosis || "Not specified"} | DOB: ${data.participant.date_of_birth || "Not specified"}`);
  parts.push(`REVIEW PERIOD: ${data.review_start_date} to ${data.review_end_date}`);
  parts.push("");

  // Goals
  parts.push("GOALS:");
  for (const g of data.goals || []) {
    parts.push(`- [${g.id}] ${g.title || g.goal_statement} (Category: ${g.ndis_goal_category || g.domain || "General"}, Status: ${g.status || "active"})`);
  }
  parts.push("");

  // Progress notes — compressed format
  parts.push("SHIFT NOTES:");
  for (const n of data.progress_notes || []) {
    const noteContent = [
      n.content,
      n.summary && `Summary: ${n.summary}`,
      n.observations && `Observations: ${n.observations}`,
      n.outcomes_achieved && `Outcomes: ${n.outcomes_achieved}`,
      n.goals_addressed && `Goals: ${n.goals_addressed}`,
      n.participant_mood && `Mood: ${n.participant_mood}`,
      n.context_of_support && `Context: ${n.context_of_support}`,
      n.risks_identified && `Risks: ${n.risks_identified}`,
    ]
      .filter(Boolean)
      .join(" | ");
    parts.push(`[${n.id}] ${n.date} (${n.worker_name || "Unknown"}): ${noteContent}`);
  }
  parts.push("");

  // Goal observations
  if (data.goal_observations?.length) {
    parts.push("GOAL OBSERVATIONS:");
    for (const o of data.goal_observations || []) {
      parts.push(`[${o.id}] ${o.date} (${o.worker_name || "Unknown"}) Goal: ${o.goal_title || "N/A"} | Rating: ${o.progress_rating || "N/A"} | ${o.worker_observation || ""}`);
    }
  }

  return parts.join("\n");
}

/**
 * Stream via Gemini 1.5 Pro
 */
async function* streamGemini(contextText: string): AsyncGenerator<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT + "\n\n---\n\nHere is the complete operational data:\n\n" + contextText },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        topP: 0.85,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

/**
 * Stream via OpenAI GPT-4o (fallback)
 */
async function* streamOpenAI(contextText: string): AsyncGenerator<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("No AI API key configured (need GEMINI_API_KEY or OPENAI_API_KEY)");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      temperature: 0.3,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextText },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed?.choices?.[0]?.delta?.content;
          if (text) yield text;
        } catch {
          // Skip malformed
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SynthesisRequest = await req.json();
    const { organization_id, review_id } = body;

    if (!organization_id || !review_id) {
      return new Response(
        JSON.stringify({ error: "organization_id and review_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate the review exists
    const { data: review, error: revErr } = await supabase
      .from("plan_reviews")
      .select("id, status")
      .eq("id", review_id)
      .eq("organization_id", organization_id)
      .single();

    if (revErr || !review) {
      return new Response(
        JSON.stringify({ error: "Review not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check minimum data threshold
    const totalNotes = (body.progress_notes?.length || 0) + (body.goal_observations?.length || 0);
    if (totalNotes < 10) {
      return new Response(
        JSON.stringify({
          error: "Insufficient Data. A minimum of 10 operational logs is required to generate an AI synthesis. Please draft this report manually.",
          note_count: totalNotes,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Set status to GENERATING
    await supabase
      .from("plan_reviews")
      .update({ status: "GENERATING", updated_at: new Date().toISOString() })
      .eq("id", review_id);

    // Compress context
    const contextText = compressContext(body);
    const startTime = Date.now();

    // Choose AI provider (Gemini preferred, OpenAI fallback)
    const useGemini = !!GEMINI_API_KEY;
    const aiModel = useGemini ? "gemini-1.5-pro" : "gpt-4o";
    const streamFn = useGemini ? streamGemini : streamOpenAI;

    // Create SSE stream
    const encoder = new TextEncoder();
    let fullMarkdown = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "meta", model: aiModel, note_count: totalNotes })}\n\n`),
          );

          // Stream AI tokens
          for await (const chunk of streamFn(contextText)) {
            fullMarkdown += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: chunk })}\n\n`),
            );
          }

          const durationMs = Date.now() - startTime;

          // Save the complete markdown to the database
          await supabase
            .from("plan_reviews")
            .update({
              ai_generated_markdown: fullMarkdown,
              final_html: fullMarkdown,
              status: "DRAFT",
              ai_model_used: aiModel,
              total_notes_ingested: totalNotes,
              total_goals_covered: body.goals?.length || 0,
              generation_duration_ms: durationMs,
              updated_at: new Date().toISOString(),
            })
            .eq("id", review_id);

          // Extract citations and save them
          const citationRegex = /\{\{cite:([^}]+)\}\}/g;
          let match;
          let citationIndex = 1;
          const citations: Array<{
            review_id: string;
            citation_index: number;
            progress_note_id: string | null;
            goal_linkage_id: string | null;
            source_date: string | null;
            source_text_snapshot: string;
            source_worker_name: string | null;
          }> = [];

          // Build lookup maps
          const noteMap = new Map<string, typeof body.progress_notes[0]>();
          for (const n of body.progress_notes || []) {
            noteMap.set(n.id, n);
          }
          const obsMap = new Map<string, typeof body.goal_observations[0]>();
          for (const o of body.goal_observations || []) {
            obsMap.set(o.id, o);
          }

          while ((match = citationRegex.exec(fullMarkdown)) !== null) {
            const sourceId = match[1];
            const note = noteMap.get(sourceId);
            const obs = obsMap.get(sourceId);

            if (note || obs) {
              citations.push({
                review_id,
                citation_index: citationIndex++,
                progress_note_id: note ? sourceId : null,
                goal_linkage_id: obs ? sourceId : null,
                source_date: (note?.date || obs?.date) || null,
                source_text_snapshot: note
                  ? (note.content || note.summary || note.observations || "").substring(0, 500)
                  : (obs?.worker_observation || "").substring(0, 500),
                source_worker_name: note?.worker_name || obs?.worker_name || null,
              });
            }
          }

          if (citations.length > 0) {
            await supabase.from("review_citations").insert(citations);
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                total_citations: citations.length,
                duration_ms: durationMs,
                model: aiModel,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";

          // Update review status back to DRAFT on error
          await supabase
            .from("plan_reviews")
            .update({
              status: "DRAFT",
              ai_generated_markdown: fullMarkdown || null,
              final_html: fullMarkdown || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", review_id);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
