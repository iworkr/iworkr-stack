// Edge Function: sirs-sanitizer
// AI-powered clinical note sanitization for NDIS SIRS compliance
// Strips speculation, emotion, and internal HR commentary from worker notes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a clinical compliance officer for the Australian NDIS Quality & Safeguards Commission. Your sole task is to convert raw support worker incident notes into objective, legally sound statements suitable for a Serious Incident Response Scheme (SIRS) report.

STRICT RULES:
1. Remove ALL speculation, assumptions, guesses, or emotional language (e.g., "I think", "probably", "seems like", "acting crazy")
2. Remove ALL internal critique of the company, management, or other staff members
3. Remove ALL personal opinions about participants or their families
4. Replace worker-to-worker commentary or hearsay with factual observations only
5. Retain ALL strict facts: exact times, locations, injuries observed, and immediate actions taken
6. Use clinical, professional language throughout
7. Preserve safety-critical information and any mandatory reporting triggers
8. Do NOT add information that was not in the original notes
9. Present output as clear, numbered bullet points
10. Each bullet point must be a standalone factual statement

OUTPUT FORMAT:
Return ONLY the sanitized bullet points. No preamble, no explanation, no headers.`;

/**
 * Sanitize raw notes using OpenAI GPT-4o
 */
async function sanitizeWithOpenAI(rawNotes: string): Promise<{
  sanitized: string;
  model: string;
}> {
  if (!OPENAI_API_KEY) {
    // Fallback: basic regex sanitization
    return {
      sanitized: performBasicSanitization(rawNotes),
      model: "regex-fallback",
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawNotes },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const sanitized = result.choices?.[0]?.message?.content;

  if (!sanitized) {
    throw new Error("OpenAI returned empty response");
  }

  return {
    sanitized,
    model: "gpt-4o",
  };
}

/**
 * Basic regex-based sanitization fallback (no AI)
 */
function performBasicSanitization(rawNotes: string): string {
  let text = rawNotes;

  // Remove speculation phrases
  const speculationPatterns = [
    /\b(I think|I believe|I suspect|probably|maybe|perhaps|seems like|looks like|might be|could be)\b[^.]*\./gi,
    /\b(in my opinion|I feel that|it appears that)\b[^.]*\./gi,
  ];
  for (const pattern of speculationPatterns) {
    text = text.replace(pattern, "");
  }

  // Remove management criticism
  text = text.replace(/\b(management|supervisor|boss|they|nobody)\b[^.]*\b(never|didn't|won't|doesn't|ignored|failed)\b[^.]*/gi, "");

  // Remove emotional language
  text = text.replace(/\b(crazy|insane|stupid|terrible|horrible|awful|ridiculous)\b/gi, "[observed behavior]");

  // Clean up whitespace
  text = text.replace(/\s{2,}/g, " ").trim();

  // Format as bullet points
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  return sentences.map((s, i) => `${i + 1}. ${s.trim()}.`).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id, submission_id, raw_text } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // If submission_id provided, fetch raw notes from the database
    let textToSanitize = raw_text;

    if (submission_id && !textToSanitize) {
      const { data: submission, error: fetchErr } = await supabase
        .from("sirs_submissions")
        .select("raw_worker_notes")
        .eq("id", submission_id)
        .eq("organization_id", organization_id)
        .single();

      if (fetchErr || !submission) {
        return new Response(
          JSON.stringify({ error: "Submission not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      textToSanitize = submission.raw_worker_notes;
    }

    if (!textToSanitize) {
      return new Response(
        JSON.stringify({ error: "No text to sanitize" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Run AI sanitization
    const { sanitized, model } = await sanitizeWithOpenAI(textToSanitize);

    // If submission_id provided, update the submission record
    if (submission_id) {
      await supabase
        .from("sirs_submissions")
        .update({
          ai_sanitized_draft: sanitized,
          sanitization_model: model,
          sanitization_prompt_version: "v1.0",
          sanitization_ran_at: new Date().toISOString(),
          status: "IN_SANITIZATION",
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission_id)
        .eq("organization_id", organization_id);
    }

    return new Response(
      JSON.stringify({
        sanitized,
        model,
        prompt_version: "v1.0",
        original_length: textToSanitize.length,
        sanitized_length: sanitized.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
