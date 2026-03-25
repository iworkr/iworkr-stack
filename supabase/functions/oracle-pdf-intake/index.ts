/**
 * @module oracle-pdf-intake
 * @status COMPLETE
 * @auth SERVICE_ROLE — Called from server actions, not directly from client
 * @description Project Oracle-Intake: Multimodal LLM document extraction engine.
 *   Ingests NDIS Plan PDFs via Gemini 1.5 Pro (OpenAI GPT-4o fallback),
 *   enforces structured JSON output, and writes to the intake_sessions staging vault.
 * @dependencies Gemini 1.5 Pro, OpenAI GPT-4o, Supabase Storage
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://app.iworkr.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ─── NDIS Plan Extraction Schema ─────────────────────────────────────────────
// Gemini native responseSchema format (Type enum values)
const NDIS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    participant_first_name: { type: "STRING", description: "Participant's given/first name" },
    participant_last_name: { type: "STRING", description: "Participant's family/last name" },
    ndis_number: { type: "STRING", description: "Exactly 9 digits, no spaces or dashes" },
    date_of_birth: { type: "STRING", description: "YYYY-MM-DD format, or null if not found" },
    plan_start_date: { type: "STRING", description: "YYYY-MM-DD format" },
    plan_end_date: { type: "STRING", description: "YYYY-MM-DD format" },
    primary_disability: { type: "STRING", description: "Primary disability category from the plan" },
    plan_management_type: {
      type: "STRING",
      description: "One of: NDIA_MANAGED, PLAN_MANAGED, SELF_MANAGED",
    },
    goals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          goal_text: { type: "STRING", description: "The full goal statement from the plan" },
          support_category: {
            type: "STRING",
            description: "NDIS support category: CORE, CAPACITY_BUILDING, or CAPITAL",
          },
        },
        required: ["goal_text"],
      },
    },
    budgets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: {
            type: "STRING",
            description: "Must be one of: CORE, CAPACITY_BUILDING, CAPITAL",
          },
          subcategory: { type: "STRING", description: "Specific support category name if present" },
          total_amount: { type: "NUMBER", description: "Total budget in AUD, decimal (e.g. 50000.00)" },
          management_type: {
            type: "STRING",
            description: "One of: NDIA, PLAN_MANAGED, SELF_MANAGED",
          },
        },
        required: ["category", "total_amount"],
      },
    },
    support_coordinator_name: { type: "STRING", description: "Name of support coordinator if listed" },
    plan_manager_name: { type: "STRING", description: "Name of plan manager if listed" },
  },
  required: [
    "participant_first_name",
    "participant_last_name",
    "ndis_number",
    "plan_start_date",
    "plan_end_date",
    "budgets",
  ],
};

const EXTRACTION_PROMPT = `You are a specialized NDIS (National Disability Insurance Scheme) document parser for the Australian government.

TASK: Extract ALL participant details, funding budgets, and goals from this official NDIS Plan document.

CRITICAL RULES:
1. NDIS Number must be EXACTLY 9 digits. If you see spaces or dashes, remove them.
2. All monetary amounts are in AUD. Use decimal format (e.g., 50000.00, NOT 50,000).
3. Dates must be in YYYY-MM-DD format.
4. Budget categories MUST be one of: CORE, CAPACITY_BUILDING, CAPITAL.
5. Management type MUST be one of: NDIA, PLAN_MANAGED, SELF_MANAGED (or NDIA_MANAGED, PLAN_MANAGED, SELF_MANAGED for plan-level).
6. If a budget category is not funded in the plan, EXCLUDE it entirely.
7. DO NOT hallucinate or infer numbers. If a value is not explicitly stated in the document, omit it.
8. Extract ALL goals listed in the plan, even if they are generic.
9. If the document is not an NDIS plan, still extract whatever structured data you can find.

Extract the data now from this document.`;

// ─── Gemini Extraction ───────────────────────────────────────────────────────

interface ExtractionResult {
  data: Record<string, unknown>;
  model: string;
  confidence: number;
  warnings: string[];
}

async function extractWithGemini(pdfBase64: string): Promise<ExtractionResult> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY / GEMINI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: NDIS_RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const warnings = validateExtraction(parsed);

  return {
    data: parsed,
    model: "gemini-1.5-pro",
    confidence: calculateConfidence(parsed, warnings),
    warnings,
  };
}

// ─── OpenAI GPT-4o Fallback ──────────────────────────────────────────────────

async function extractWithOpenAI(pdfBase64: string): Promise<ExtractionResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a specialized NDIS document parser. You MUST return valid JSON matching the schema provided. No markdown, no code blocks, no explanation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}\n\nReturn JSON with these required fields: participant_first_name, participant_last_name, ndis_number, plan_start_date, plan_end_date, budgets (array of {category, total_amount, management_type}), goals (array of {goal_text, support_category}), primary_disability, plan_management_type, date_of_birth`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";

  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const warnings = validateExtraction(parsed);

  return {
    data: parsed,
    model: "gpt-4o",
    confidence: calculateConfidence(parsed, warnings),
    warnings,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateExtraction(data: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  // NDIS number validation: must be exactly 9 digits
  const ndis = String(data.ndis_number || "").replace(/\D/g, "");
  if (!ndis || ndis.length !== 9) {
    warnings.push(`NDIS number "${data.ndis_number}" is not exactly 9 digits`);
  }

  // Date validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (data.plan_start_date && !dateRegex.test(String(data.plan_start_date))) {
    warnings.push(`Plan start date "${data.plan_start_date}" is not YYYY-MM-DD format`);
  }
  if (data.plan_end_date && !dateRegex.test(String(data.plan_end_date))) {
    warnings.push(`Plan end date "${data.plan_end_date}" is not YYYY-MM-DD format`);
  }

  // Plan dates: end must be after start
  if (data.plan_start_date && data.plan_end_date) {
    if (String(data.plan_end_date) <= String(data.plan_start_date)) {
      warnings.push("Plan end date is before or equal to start date");
    }
  }

  // Budget validation
  const budgets = data.budgets as Array<{ category: string; total_amount: number }> | undefined;
  if (!budgets || budgets.length === 0) {
    warnings.push("No budget categories extracted");
  } else {
    const validCategories = ["CORE", "CAPACITY_BUILDING", "CAPITAL"];
    for (const b of budgets) {
      if (!validCategories.includes(b.category?.toUpperCase())) {
        warnings.push(`Invalid budget category: "${b.category}"`);
      }
      if (typeof b.total_amount !== "number" || b.total_amount <= 0) {
        warnings.push(`Budget amount for ${b.category} is invalid: ${b.total_amount}`);
      }
      if (b.total_amount > 500000) {
        warnings.push(`Unusually large budget for ${b.category}: $${b.total_amount.toLocaleString()} — verify carefully`);
      }
    }
  }

  // Name validation
  if (!data.participant_first_name) warnings.push("Missing participant first name");
  if (!data.participant_last_name) warnings.push("Missing participant last name");

  return warnings;
}

function calculateConfidence(
  data: Record<string, unknown>,
  warnings: string[]
): number {
  let score = 100;

  // Deduct for each warning
  score -= warnings.length * 8;

  // Bonus for completeness
  const optionalFields = [
    "date_of_birth",
    "primary_disability",
    "plan_management_type",
    "goals",
    "support_coordinator_name",
    "plan_manager_name",
  ];
  const present = optionalFields.filter((f) => data[f]).length;
  score += present * 2;

  // Goals present
  const goals = data.goals as unknown[];
  if (goals && goals.length > 0) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let sessionId: string | undefined;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    sessionId = body.session_id;
    const filePath: string = body.file_path;
    const preferredModel: string = body.preferred_model || "gemini";

    if (!sessionId || !filePath) {
      throw new Error("session_id and file_path are required");
    }

    // Update status to ANALYZING
    await supabase
      .from("intake_sessions")
      .update({ status: "ANALYZING" })
      .eq("id", sessionId);

    // Download PDF from Supabase Storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("intake-documents")
      .download(filePath);

    if (dlError || !fileData) {
      throw new Error(`Storage download failed: ${dlError?.message || "No data"}`);
    }

    const buffer = await fileData.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    // Run extraction with dual-model fallback
    let result: ExtractionResult;

    try {
      if (preferredModel === "openai") {
        result = await extractWithOpenAI(base64);
      } else {
        result = await extractWithGemini(base64);
      }
    } catch (primaryError) {
      console.warn(`Primary model (${preferredModel}) failed, trying fallback:`, primaryError);
      try {
        if (preferredModel === "openai") {
          result = await extractWithGemini(base64);
        } else {
          result = await extractWithOpenAI(base64);
        }
      } catch (fallbackError) {
        // Both models failed
        const elapsed = Date.now() - startTime;
        await supabase
          .from("intake_sessions")
          .update({
            status: "FAILED",
            error_log: `Both models failed.\nPrimary (${preferredModel}): ${primaryError}\nFallback: ${fallbackError}`,
            ai_processing_ms: elapsed,
          })
          .eq("id", sessionId);

        throw new Error(`Both AI models failed: ${fallbackError}`);
      }
    }

    const elapsed = Date.now() - startTime;

    // Save extraction result to staging table
    const { error: updateError } = await supabase
      .from("intake_sessions")
      .update({
        status: "PENDING_REVIEW",
        extracted_data: result.data,
        confidence_score: result.confidence,
        validation_warnings: result.warnings,
        ai_model_used: result.model,
        ai_processing_ms: elapsed,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to update intake session:", updateError);
    }

    // Broadcast via Supabase Realtime REST
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }).catch(() => {
      // Realtime broadcast is best-effort via postgres_changes on the table
    });

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        model_used: result.model,
        confidence: result.confidence,
        warnings: result.warnings,
        processing_ms: elapsed,
        fields_extracted: Object.keys(result.data).length,
        budgets_found: (result.data.budgets as unknown[])?.length || 0,
        goals_found: (result.data.goals as unknown[])?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("oracle-pdf-intake error:", error);

    // Try to mark session as failed if we have the ID
    if (sessionId) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
        await supabase
          .from("intake_sessions")
          .update({
            status: "FAILED",
            error_log: error instanceof Error ? error.message : String(error),
            ai_processing_ms: Date.now() - startTime,
          })
          .eq("id", sessionId);
      } catch {
        // Best effort
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
