/**
 * @module oracle-claim-predict
 * @status COMPLETE
 * @auth SECURED — Aegis Auth Gate + org membership check
 * @description NDIS claim rejection prediction engine: rule-based classification to intercept likely-rejected claims before PACE submission
 * @dependencies Supabase (RPC: predict_claim_rejection)
 * @lastAudit 2026-03-22
 */

// Edge Function: oracle-claim-predict
// NDIS claim rejection prediction engine — intercepts invoices before PACE submission.
// Uses rule-based classification (worker credentials, temporal conflicts, budget, ratios)
// to prevent revenue-destroying claim rejections.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClaimInput {
  invoice_id?: string;
  timesheet_id?: string;
  claim_batch_id?: string;
  participant_id: string;
  worker_id: string;
  support_item_code: string;
  shift_date: string;
  claim_amount: number;
  organization_id: string;
}

interface PredictionResult {
  claim: ClaimInput;
  confidence_success: number;
  confidence_reject: number;
  predicted_error_code: string | null;
  predicted_error_category: string | null;
  flagged_reasons: string[];
  suggested_fix: string | null;
  suggested_code: string | null;
  intercepted: boolean;
  checks: {
    credential_expiry: boolean;
    temporal_conflict: boolean;
    budget_remaining: number | null;
    overlap_shifts: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Aegis Auth Gate ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      claims,
      organization_id,
      intercept_threshold = 0.85,
      dry_run = false,
    } = body as {
      claims: ClaimInput[];
      organization_id: string;
      intercept_threshold?: number;
      dry_run?: boolean;
    };

    if (!organization_id || !claims?.length) {
      return new Response(
        JSON.stringify({ error: "organization_id and claims[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Org membership check ──
    const { data: member } = await userClient
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden: Not a member of this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const results: PredictionResult[] = [];
    let interceptedCount = 0;
    let passedCount = 0;

    for (const claim of claims) {
      const { data: prediction, error: rpcErr } = await supabase.rpc(
        "predict_claim_rejection",
        {
          p_org_id: organization_id,
          p_worker_id: claim.worker_id,
          p_participant_id: claim.participant_id,
          p_support_item: claim.support_item_code,
          p_shift_date: claim.shift_date,
          p_claim_amount: claim.claim_amount,
        }
      );

      if (rpcErr) {
        results.push({
          claim,
          confidence_success: 1.0,
          confidence_reject: 0.0,
          predicted_error_code: null,
          predicted_error_category: null,
          flagged_reasons: [`RPC error: ${rpcErr.message}`],
          suggested_fix: null,
          suggested_code: null,
          intercepted: false,
          checks: {
            credential_expiry: false,
            temporal_conflict: false,
            budget_remaining: null,
            overlap_shifts: 0,
          },
        });
        passedCount++;
        continue;
      }

      const pred = prediction as Record<string, unknown>;
      const confidenceSuccess = pred.confidence_success as number;
      const confidenceReject = 1 - confidenceSuccess;
      const shouldIntercept = confidenceReject >= intercept_threshold;

      const result: PredictionResult = {
        claim,
        confidence_success: confidenceSuccess,
        confidence_reject: confidenceReject,
        predicted_error_code: (pred.predicted_error_code as string) ?? null,
        predicted_error_category:
          (pred.predicted_error_category as string) ?? null,
        flagged_reasons: (pred.flagged_reasons as string[]) ?? [],
        suggested_fix: (pred.suggested_fix as string) ?? null,
        suggested_code: (pred.suggested_code as string) ?? null,
        intercepted: shouldIntercept,
        checks: pred.checks_performed as PredictionResult["checks"],
      };

      if (shouldIntercept && !dry_run) {
        await supabase.from("ndis_claim_predictions").insert({
          organization_id,
          invoice_id: claim.invoice_id ?? null,
          timesheet_id: claim.timesheet_id ?? null,
          claim_batch_id: claim.claim_batch_id ?? null,
          participant_id: claim.participant_id,
          worker_id: claim.worker_id,
          support_item_code: claim.support_item_code,
          shift_date: claim.shift_date,
          claim_amount: claim.claim_amount,
          confidence_score_success: confidenceSuccess,
          predicted_error_code: result.predicted_error_code,
          predicted_error_category: result.predicted_error_category,
          flagged_reason: result.flagged_reasons.join("; "),
          ai_suggested_fix: result.suggested_fix,
          ai_suggested_code: result.suggested_code,
          status: "INTERCEPTED",
          model_version: "v1.0-rules",
        });
        interceptedCount++;
      } else {
        passedCount++;
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        total: claims.length,
        intercepted: interceptedCount,
        passed: passedCount,
        intercept_threshold: intercept_threshold,
        dry_run,
        results,
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
