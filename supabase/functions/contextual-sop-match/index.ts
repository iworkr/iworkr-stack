/**
 * @module contextual-sop-match
 * @status COMPLETE
 * @auth UNSECURED — No user auth guard; uses service_role key internally
 * @description Hybrid SOP matching: deterministic tag matching + semantic vector similarity via OpenAI embeddings and pgvector, persists top 5 recommendations
 * @dependencies OpenAI (embeddings), Supabase (DB, pgvector RPCs)
 * @lastAudit 2026-03-22
 */
/**
 * contextual-sop-match — Panopticon Knowledge Engine
 *
 * Edge Function: Hybrid Tag + Semantic Vector SOP Matching
 *
 * Recommends Standard Operating Procedures for a job using a two-pass
 * matching strategy:
 *   1. Deterministic tag matching (exact overlap between job tags and SOP tags)
 *   2. Semantic similarity via OpenAI embeddings + pgvector cosine search
 *
 * Results are merged, deduplicated, and persisted to `job_recommended_sops`.
 *
 * POST body: { job_id, workspace_id, job_title, job_description, job_tags? }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";


interface SOPMatchRequest {
  job_id: string;
  workspace_id: string;
  job_title: string;
  job_description: string;
  job_tags?: string[];
}

interface RecommendedSOP {
  article_id: string;
  title: string;
  match_type: "tag" | "semantic";
  score: number;
  tags?: string[];
}

serve(async (req) => {
  // ─── CORS preflight ────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SOPMatchRequest = await req.json();
    const { job_id, workspace_id, job_title, job_description, job_tags } = body;

    if (!job_id || !workspace_id || !job_title) {
      return new Response(
        JSON.stringify({
          error: "job_id, workspace_id, and job_title are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[contextual-sop-match] Starting match for job ${job_id} in workspace ${workspace_id}`
    );

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── Step 1 — Tag Matching (deterministic) ───────────────────
    const tagMatches: RecommendedSOP[] = [];
    const tags = job_tags ?? [];

    if (tags.length > 0) {
      console.log(
        `[contextual-sop-match] Step 1: Tag matching with ${tags.length} tags: ${tags.join(", ")}`
      );

      const { data: tagResults, error: tagError } = await adminClient.rpc(
        "match_sops_by_tags",
        {
          p_tags: tags,
          p_workspace_id: workspace_id,
        }
      );

      if (tagError) {
        console.error(
          "[contextual-sop-match] Tag match RPC error:",
          tagError.message
        );
      } else if (tagResults) {
        for (const row of tagResults) {
          tagMatches.push({
            article_id: row.article_id ?? row.id,
            title: row.title,
            match_type: "tag",
            score: 1.0,
            tags: row.matched_tags ?? row.tags,
          });
        }
        console.log(
          `[contextual-sop-match] Step 1 complete: ${tagMatches.length} tag matches`
        );
      }
    } else {
      console.log("[contextual-sop-match] Step 1: Skipped (no tags provided)");
    }

    // ─── Step 2 — Semantic Matching (vector similarity) ──────────
    const semanticMatches: RecommendedSOP[] = [];

    if (OPENAI_API_KEY) {
      try {
        const queryText = `${job_title}. ${job_description || ""}`.trim();
        console.log(
          `[contextual-sop-match] Step 2: Generating embedding for query (${queryText.length} chars)`
        );

        // 2a. Generate embedding via OpenAI
        const embeddingRes = await fetch(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "text-embedding-3-small",
              input: queryText,
            }),
          }
        );

        if (!embeddingRes.ok) {
          const errText = await embeddingRes.text();
          throw new Error(
            `OpenAI API returned ${embeddingRes.status}: ${errText}`
          );
        }

        const embeddingData = await embeddingRes.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        console.log(
          `[contextual-sop-match] Embedding generated (${queryEmbedding.length} dimensions)`
        );

        // 2b. Search via pgvector RPC
        const { data: semanticResults, error: semanticError } =
          await adminClient.rpc("search_knowledge_semantic", {
            query_embedding: queryEmbedding,
            p_workspace_id: workspace_id,
          });

        if (semanticError) {
          console.error(
            "[contextual-sop-match] Semantic search RPC error:",
            semanticError.message
          );
        } else if (semanticResults) {
          for (const row of semanticResults) {
            semanticMatches.push({
              article_id: row.article_id ?? row.id,
              title: row.title,
              match_type: "semantic",
              score: row.similarity ?? row.score ?? 0,
              tags: row.tags,
            });
          }
          console.log(
            `[contextual-sop-match] Step 2 complete: ${semanticMatches.length} semantic matches`
          );
        }
      } catch (embeddingErr) {
        console.error(
          "[contextual-sop-match] Semantic matching failed, continuing with tag results only:",
          (embeddingErr as Error).message
        );
      }
    } else {
      console.log(
        "[contextual-sop-match] Step 2: Skipped (no OPENAI_API_KEY)"
      );
    }

    // ─── Step 3 — Merge & Deduplicate ────────────────────────────
    console.log("[contextual-sop-match] Step 3: Merging and deduplicating");

    const merged = new Map<string, RecommendedSOP>();

    // Add tag matches first (score = 1.0)
    for (const match of tagMatches) {
      merged.set(match.article_id, match);
    }

    // Add semantic matches — keep higher score if duplicate
    for (const match of semanticMatches) {
      const existing = merged.get(match.article_id);
      if (!existing || match.score > existing.score) {
        merged.set(match.article_id, match);
      }
    }

    // Sort by score descending
    const recommendations = Array.from(merged.values()).sort(
      (a, b) => b.score - a.score
    );

    console.log(
      `[contextual-sop-match] Step 3 complete: ${recommendations.length} unique recommendations`
    );

    // ─── Step 4 — Persist top 5 to job_recommended_sops ──────────
    const topRecommendations = recommendations.slice(0, 5);

    if (topRecommendations.length > 0) {
      console.log(
        `[contextual-sop-match] Step 4: Persisting ${topRecommendations.length} recommendations`
      );

      const rows = topRecommendations.map((rec, idx) => ({
        job_id,
        workspace_id,
        article_id: rec.article_id,
        match_type: rec.match_type,
        score: rec.score,
        rank: idx + 1,
      }));

      const { error: insertError } = await adminClient
        .from("job_recommended_sops")
        .upsert(rows, { onConflict: "job_id,article_id", ignoreDuplicates: true });

      if (insertError) {
        console.error(
          "[contextual-sop-match] Failed to persist recommendations:",
          insertError.message
        );
      } else {
        console.log("[contextual-sop-match] Step 4 complete: Recommendations persisted");
      }
    }

    // ─── Response ────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        job_id,
        recommendations: topRecommendations,
        tag_matches: tagMatches.length,
        semantic_matches: semanticMatches.length,
        total_unique: recommendations.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[contextual-sop-match] Fatal error:", (err as Error).message);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
