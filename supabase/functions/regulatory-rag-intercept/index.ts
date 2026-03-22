/**
 * @module regulatory-rag-intercept
 * @status COMPLETE
 * @auth UNSECURED — No user auth; accepts organization_id and serialized_intent directly
 * @description Project Solon-Law: Semantic compliance evaluation via RAG — embeds operational intent, vector-searches regulatory chunks, LLM evaluates violations with severity and actionable fixes
 * @dependencies OpenAI (Embeddings + GPT-4o), Supabase (pgvector)
 * @lastAudit 2026-03-22
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const SYSTEM_PROMPT = `You are an expert regulatory compliance auditor for Australian trade and care sectors. You have been provided with an operational intent (what the user is trying to do) and the most relevant clauses from applicable legislation and regulatory frameworks.

Your task:
1. Determine if the operational intent violates any of the provided legal clauses.
2. If compliant, return is_compliant: true.
3. If violations exist, return is_compliant: false with detailed violations.
4. CRITICAL: If the provided regulatory context does NOT explicitly mention or relate to the subject matter of the operational intent, you MUST return is_compliant: true with confidence_flag: "LOW". Do NOT hallucinate violations from irrelevant context.

Return STRICTLY as JSON matching this schema:
{
  "is_compliant": boolean,
  "confidence_flag": "HIGH" | "MEDIUM" | "LOW",
  "violations": [
    {
      "clause_reference": "string (e.g., 'AS/NZS 3000 Clause 4.1.2')",
      "human_explanation": "string (plain English explanation of the violation)",
      "actionable_fix": "string (specific steps to become compliant)",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    }
  ]
}`;

async function embedText(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-small",
    }),
  });

  if (!res.ok) throw new Error(`Embedding error: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      organization_id,
      serialized_intent,
      context_type,
      context_id,
      operation_date,
      framework_id,
      top_k = 5,
    } = body as {
      organization_id: string;
      serialized_intent: string;
      context_type: string;
      context_id?: string;
      operation_date?: string;
      framework_id?: string;
      top_k?: number;
    };

    if (!organization_id || !serialized_intent || !context_type) {
      return new Response(
        JSON.stringify({ error: "organization_id, serialized_intent, context_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Embed the operational intent
    const queryEmbedding = await embedText(serialized_intent);

    // Step 2: Temporal-aware vector search
    const opDate = operation_date ?? new Date().toISOString().split("T")[0];

    const { data: matchedChunks, error: searchErr } = await supabase.rpc(
      "search_regulatory_chunks",
      {
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_workspace_id: organization_id,
        p_operation_date: opDate,
        p_framework_id: framework_id ?? null,
        p_limit: top_k,
      }
    );

    if (searchErr) {
      throw new Error(`Vector search failed: ${searchErr.message}`);
    }

    const chunks = (matchedChunks ?? []) as {
      chunk_id: string;
      framework_id: string;
      framework_title: string;
      chunk_index: number;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }[];

    // If no relevant chunks found, return compliant with LOW confidence
    if (chunks.length === 0) {
      const result = {
        is_compliant: true,
        confidence_flag: "LOW",
        violations: [],
        matched_chunks: [],
        model_used: "none",
        processing_ms: Date.now() - startTime,
      };

      await supabase.from("compliance_intercept_logs").insert({
        organization_id,
        context_type,
        context_id: context_id ?? null,
        serialized_intent,
        result: "LOW_CONFIDENCE",
        confidence_flag: "LOW",
        violations: [],
        matched_chunks: [],
        processing_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Build context for LLM
    const regulatoryContext = chunks
      .map(
        (c, i) =>
          `[Source: ${c.framework_title}, Similarity: ${(c.similarity * 100).toFixed(1)}%]\n${c.content}`
      )
      .join("\n\n---\n\n");

    // Step 4: LLM evaluation
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `OPERATIONAL INTENT:\n"${serialized_intent}"\n\nRELEVANT REGULATORY CLAUSES:\n${regulatoryContext}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!llmRes.ok) throw new Error(`OpenAI error: ${await llmRes.text()}`);

    const llmData = await llmRes.json();
    const evaluation = JSON.parse(
      llmData.choices?.[0]?.message?.content ?? '{"is_compliant":true,"confidence_flag":"LOW","violations":[]}'
    );

    const isCompliant = evaluation.is_compliant ?? true;
    const confidenceFlag = evaluation.confidence_flag ?? "HIGH";
    const violations = evaluation.violations ?? [];
    const processingMs = Date.now() - startTime;

    const interceptResult = !isCompliant
      ? "VIOLATION_DETECTED"
      : confidenceFlag === "LOW"
      ? "LOW_CONFIDENCE"
      : "COMPLIANT";

    // Step 5: Log the intercept
    await supabase.from("compliance_intercept_logs").insert({
      organization_id,
      context_type,
      context_id: context_id ?? null,
      serialized_intent,
      result: interceptResult,
      confidence_flag: confidenceFlag,
      violations,
      matched_chunks: chunks.map((c) => ({
        chunk_id: c.chunk_id,
        framework_title: c.framework_title,
        content: c.content.slice(0, 200),
        similarity: c.similarity,
      })),
      framework_id: chunks[0]?.framework_id ?? null,
      llm_model_used: "gpt-4o",
      processing_ms: processingMs,
    });

    return new Response(
      JSON.stringify({
        is_compliant: isCompliant,
        confidence_flag: confidenceFlag,
        violations,
        matched_chunks: chunks.map((c) => ({
          chunk_id: c.chunk_id,
          framework_title: c.framework_title,
          content: c.content,
          similarity: c.similarity,
        })),
        model_used: "gpt-4o",
        processing_ms: processingMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";

    // Log error
    try {
      const b = await req.clone().json();
      if (b.organization_id) {
        await supabase.from("compliance_intercept_logs").insert({
          organization_id: b.organization_id,
          context_type: b.context_type ?? "unknown",
          serialized_intent: b.serialized_intent ?? "",
          result: "ERROR",
          violations: [],
          matched_chunks: [],
          processing_ms: Date.now() - startTime,
        });
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
