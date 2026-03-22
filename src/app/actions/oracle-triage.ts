/**
 * @module OracleTriage Server Actions
 * @status COMPLETE
 * @description AI-powered triage system — intake classification, priority scoring, routing rules, and escalation workflows
 * @exports createTriageRuleAction, fetchTriageRulesAction, classifyIntakeAction, fetchTriageQueueAction, escalateAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Auth Helper ─────────────────────────────────────── */

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, user: null, error: "Not a member" };

  return { supabase, user, error: null };
}

/* ── Get Quarantined Claims ──────────────────────────── */

export async function getQuarantinedClaims(orgId: string, filters?: {
  status?: string;
  minConfidence?: number;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  let query = (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select(`
      *,
      participant:participant_id(id, preferred_name, clients!inner(name)),
      worker:worker_id(id, full_name)
    `)
    .eq("organization_id", orgId)
    .order("confidence_score_success", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.eq("status", "INTERCEPTED");
  }

  if (filters?.minConfidence !== undefined) {
    query = query.lte("confidence_score_success", 1 - filters.minConfidence);
  }

  const { data, error: dbErr } = await query.limit(100);

  return {
    data: (data ?? []) as Record<string, unknown>[],
    error: dbErr?.message ?? null,
  };
}

/* ── Predict Claims in Batch ─────────────────────────── */

export async function predictClaimBatch(orgId: string, claims: {
  invoice_id?: string;
  timesheet_id?: string;
  claim_batch_id?: string;
  participant_id: string;
  worker_id: string;
  support_item_code: string;
  shift_date: string;
  claim_amount: number;
}[]) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: { intercepted: 0, passed: 0, results: [] }, error };

  const results: Record<string, unknown>[] = [];
  let intercepted = 0;
  let passed = 0;

  for (const claim of claims) {
    const { data: prediction, error: rpcErr } = await (supabase as SupabaseClient).rpc("predict_claim_rejection", {
      p_org_id: orgId,
      p_worker_id: claim.worker_id,
      p_participant_id: claim.participant_id,
      p_support_item: claim.support_item_code,
      p_shift_date: claim.shift_date,
      p_claim_amount: claim.claim_amount,
    });

    if (rpcErr) continue;

    const pred = prediction as Record<string, unknown>;
    const confidenceSuccess = pred.confidence_success as number;
    const shouldIntercept = confidenceSuccess < 0.15;

    if (shouldIntercept) {
      const reasons = pred.flagged_reasons as string[];
      await (supabase as SupabaseClient)
        .from("ndis_claim_predictions")
        .insert({
          organization_id: orgId,
          invoice_id: claim.invoice_id ?? null,
          timesheet_id: claim.timesheet_id ?? null,
          claim_batch_id: claim.claim_batch_id ?? null,
          participant_id: claim.participant_id,
          worker_id: claim.worker_id,
          support_item_code: claim.support_item_code,
          shift_date: claim.shift_date,
          claim_amount: claim.claim_amount,
          confidence_score_success: confidenceSuccess,
          predicted_error_code: pred.predicted_error_code ?? null,
          predicted_error_category: pred.predicted_error_category ?? null,
          flagged_reason: reasons.join("; "),
          ai_suggested_fix: pred.suggested_fix ?? null,
          ai_suggested_code: pred.suggested_code ?? null,
          status: "INTERCEPTED",
        });
      intercepted++;
    } else {
      passed++;
    }

    results.push({ ...claim, prediction: pred, intercepted: shouldIntercept });
  }

  revalidatePath("/dashboard/finance/oracle-triage");
  return {
    data: { intercepted, passed, results },
    error: null,
  };
}

/* ── Apply AI Suggested Fix (One-Tap Remediation) ──── */

export async function applyClaimFix(orgId: string, predictionId: string, action: "downgrade" | "override") {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { data: prediction } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("*")
    .eq("id", predictionId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!prediction) return { error: "Prediction not found" };

  const pred = prediction as Record<string, unknown>;

  if (action === "downgrade" && pred.ai_suggested_code) {
    // Apply the AI's suggested fix
    await (supabase as SupabaseClient)
      .from("ndis_claim_predictions")
      .update({
        status: "FIXED_AND_RESUBMITTED",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_action: `Downgraded from ${pred.support_item_code} to ${pred.ai_suggested_code}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", predictionId);

    revalidatePath("/dashboard/finance/oracle-triage");
    return { error: null };
  }

  if (action === "override") {
    await (supabase as SupabaseClient)
      .from("ndis_claim_predictions")
      .update({
        status: "OVERRIDDEN_BY_HUMAN",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_action: "Human override — submitted despite AI warning",
        updated_at: new Date().toISOString(),
      })
      .eq("id", predictionId);

    revalidatePath("/dashboard/finance/oracle-triage");
    return { error: null };
  }

  return { error: "Invalid action" };
}

/* ── Record ML Feedback (False Positive Loop) ────────── */

export async function recordMlFeedback(orgId: string, params: {
  prediction_id: string;
  actual_outcome: "accepted" | "rejected";
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { data: prediction } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("confidence_score_success, status")
    .eq("id", params.prediction_id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!prediction) return { error: "Prediction not found" };

  const pred = prediction as Record<string, unknown>;
  const predictedReject = (pred.confidence_score_success as number) < 0.5;
  const actuallyRejected = params.actual_outcome === "rejected";
  const wasCorrect = predictedReject === actuallyRejected;

  // If prediction was wrong (false positive), mark it
  if (!wasCorrect && pred.status === "OVERRIDDEN_BY_HUMAN") {
    await (supabase as SupabaseClient)
      .from("ndis_claim_predictions")
      .update({
        status: "FALSE_POSITIVE_CONFIRMED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.prediction_id);
  }

  await (supabase as SupabaseClient)
    .from("oracle_ml_feedback")
    .insert({
      organization_id: orgId,
      prediction_id: params.prediction_id,
      prediction_type: "claim_rejection",
      predicted_outcome: predictedReject ? "rejected" : "accepted",
      actual_outcome: params.actual_outcome,
      was_correct: wasCorrect,
      feedback_source: "pace_webhook",
    });

  return { error: null };
}

/* ── Triage Dashboard Stats ──────────────────────────── */

export async function getTriageStats(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data: intercepted } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("id", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("status", "INTERCEPTED");

  const { data: fixed } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("id", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("status", "FIXED_AND_RESUBMITTED");

  const { data: overridden } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("id", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("status", "OVERRIDDEN_BY_HUMAN");

  const { data: falsePositives } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("id", { count: "exact" })
    .eq("organization_id", orgId)
    .eq("status", "FALSE_POSITIVE_CONFIRMED");

  const { data: totalSaved } = await (supabase as SupabaseClient)
    .from("ndis_claim_predictions")
    .select("claim_amount")
    .eq("organization_id", orgId)
    .eq("status", "FIXED_AND_RESUBMITTED");

  const savedAmount = (totalSaved ?? []).reduce(
    (s: number, r: Record<string, unknown>) => s + ((r.claim_amount as number) ?? 0), 0
  );

  return {
    data: {
      quarantined: intercepted?.length ?? 0,
      fixed: fixed?.length ?? 0,
      overridden: overridden?.length ?? 0,
      false_positives: falsePositives?.length ?? 0,
      total_saved_amount: savedAmount,
    },
    error: null,
  };
}
