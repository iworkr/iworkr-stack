/**
 * @module vision-hazard-analyzer
 * @status COMPLETE
 * @auth UNSECURED — No auth guard; uses service-role key internally
 * @description Multimodal SWMS auto-generation — analyzes jobsite images via Gemini 1.5 Pro to produce risk matrices and SWMS documents
 * @dependencies Supabase, Google Gemini (multimodal)
 * @lastAudit 2026-03-22
 */
// Edge Function: vision-hazard-analyzer
// Project Hermes-Scribe — Multimodal SWMS Auto-Generation
// Pipeline: Frame images → Gemini 1.5 Pro Multimodal → Risk Matrix JSON → SWMS tables

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestEnv } from "../_shared/mockClients.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY")!;

const SWMS_SYSTEM_PROMPT = `You are an expert occupational health and safety auditor with deep knowledge of Australian WHS legislation, Safe Work Method Statements (SWMS), and construction site safety standards.

Review the provided sequential frames captured from a job site. For each identifiable hazard:

1. Identify the hazard type and give a clear description
2. Calculate the Initial Risk Score using a 5x5 risk matrix:
   - Likelihood (1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain)
   - Consequence (1=Insignificant, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic)
   - Risk Score = Likelihood × Consequence
3. Suggest specific, actionable control measures following the hierarchy of controls
4. Calculate the Residual Risk after controls are applied

Also identify:
- Required PPE for the site
- General site conditions observed

Return STRICTLY as JSON matching this schema:
{
  "hazards": [
    {
      "hazard_type": "string",
      "description": "string",
      "likelihood": 1-5,
      "consequence": 1-5,
      "initial_risk_score": number,
      "control_measures": ["string"],
      "residual_likelihood": 1-5,
      "residual_consequence": 1-5,
      "residual_risk_score": number,
      "frame_index": number
    }
  ],
  "overall_site_risk": "LOW|MEDIUM|HIGH|EXTREME",
  "recommended_ppe": ["string"],
  "site_conditions": ["string"],
  "summary": "string"
}`;

async function analyzeWithGemini(
  frameUrls: string[],
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> {
  if (isTestEnv) {
    return {
      hazards: [
        {
          hazard_type: "trip_hazard",
          description: "Loose cable crossing work area",
          likelihood: 3,
          consequence: 3,
          initial_risk_score: 9,
          control_measures: ["Secure cables with covers", "Mark hazard zone"],
          residual_likelihood: 1,
          residual_consequence: 2,
          residual_risk_score: 2,
          frame_index: 0,
        },
      ],
      overall_site_risk: "MEDIUM",
      recommended_ppe: ["Safety boots", "Gloves"],
      site_conditions: ["Indoor", "Low visibility in corner"],
      summary: "One material hazard detected and controls proposed.",
    };
  }
  // Download frames and convert to base64
  const imageParts: { inline_data: { mime_type: string; data: string } }[] = [];

  for (const url of frameUrls) {
    const { data, error } = await supabase.storage
      .from("vision-frames")
      .download(url);

    if (error || !data) continue;

    const buffer = await data.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(buffer))
    );
    imageParts.push({
      inline_data: { mime_type: "image/jpeg", data: base64 },
    });
  }

  if (imageParts.length === 0) {
    throw new Error("No valid frames to analyze");
  }

  // Try Gemini first, fall back to OpenAI Vision
  if (GEMINI_API_KEY && !GEMINI_API_KEY.startsWith("sk-")) {
    return await callGemini(imageParts);
  }
  return await callOpenAIVision(frameUrls, supabase);
}

async function callGemini(
  imageParts: { inline_data: { mime_type: string; data: string } }[]
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SWMS_SYSTEM_PROMPT },
              ...imageParts,
              {
                text: "Analyze these sequential site frames and return the SWMS risk matrix JSON.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  return JSON.parse(text);
}

async function callOpenAIVision(
  frameUrls: string[],
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> {
  const imageContent: { type: string; image_url?: { url: string }; text?: string }[] = [];

  for (const url of frameUrls) {
    const { data } = await supabase.storage
      .from("vision-frames")
      .download(url);
    if (!data) continue;

    const buffer = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    imageContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    });
  }

  imageContent.push({ type: "text", text: "Analyze these sequential site frames and return the SWMS risk matrix JSON." });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SWMS_SYSTEM_PROMPT },
        { role: "user", content: imageContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI Vision error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
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
      scan_id,
      organization_id,
      job_id,
      frame_storage_paths,
    } = body as {
      scan_id: string;
      organization_id: string;
      job_id?: string;
      frame_storage_paths: string[];
    };

    if (!scan_id || !organization_id || !frame_storage_paths?.length) {
      return new Response(
        JSON.stringify({ error: "scan_id, organization_id, frame_storage_paths[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status
    await supabase
      .from("vision_hazard_scans")
      .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
      .eq("id", scan_id);

    // Analyze frames
    const result = await analyzeWithGemini(frame_storage_paths, supabase);
    const hazards = (result.hazards as Record<string, unknown>[]) ?? [];
    const overallRisk = (result.overall_site_risk as string) ?? "MEDIUM";
    const ppe = (result.recommended_ppe as string[]) ?? [];
    const conditions = (result.site_conditions as string[]) ?? [];
    const summary = (result.summary as string) ?? "";

    // Calculate overall confidence
    const confidence = hazards.length > 0 ? 0.85 : 0.5;

    // Build risk matrix for SWMS
    const riskMatrix = hazards.map(
      (h: Record<string, unknown>, idx: number) => ({
        hazard_number: idx + 1,
        hazard_type: h.hazard_type,
        description: h.description,
        initial_likelihood: h.likelihood,
        initial_consequence: h.consequence,
        initial_risk: h.initial_risk_score,
        controls: h.control_measures,
        residual_likelihood: h.residual_likelihood,
        residual_consequence: h.residual_consequence,
        residual_risk: h.residual_risk_score,
      })
    );

    // Update scan record
    await supabase
      .from("vision_hazard_scans")
      .update({
        status: "PENDING_REVIEW",
        cloud_analysis: result,
        risk_matrix: riskMatrix,
        proposed_hazards: hazards,
        llm_model_used: GEMINI_API_KEY?.startsWith("sk-") ? "gpt-4o" : "gemini-1.5-pro",
        overall_confidence: confidence,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scan_id);

    return new Response(
      JSON.stringify({
        scan_id,
        status: "PENDING_REVIEW",
        hazard_count: hazards.length,
        overall_site_risk: overallRisk,
        recommended_ppe: ppe,
        site_conditions: conditions,
        summary,
        risk_matrix: riskMatrix,
        confidence,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
