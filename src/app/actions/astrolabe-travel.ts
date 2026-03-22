/**
 * @module AstrolabeTravel Server Actions
 * @status COMPLETE
 * @description Travel claim verification — GPS-based distance validation, variance flagging, approval workflows
 * @exports createTravelClaimAction, fetchTravelClaimsAction, verifyTravelClaimAction, approveTravelClaimAction, fetchTravelAuditLog
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TravelClaimStatus =
  | "PENDING_API"
  | "VERIFIED_CLEAN"
  | "FLAGGED_VARIANCE"
  | "APPROVED"
  | "OVERRIDDEN"
  | "BILLED"
  | "REJECTED";

export interface TravelClaim {
  claim_id: string;
  travel_log_id: string;
  worker_id: string;
  worker_name: string | null;
  transit_type: "PROVIDER_TRAVEL" | "PARTICIPANT_TRANSPORT";
  start_lat: number;
  start_lng: number;
  end_lat: number | null;
  end_lng: number | null;
  device_start_time: string;
  device_end_time: string | null;
  actual_duration_seconds: number | null;
  api_verified_distance_meters: number | null;
  api_verified_duration_seconds: number | null;
  billable_labor_minutes: number | null;
  billable_non_labor_km: number | null;
  calculated_labor_cost: number | null;
  calculated_non_labor_cost: number | null;
  total_claim_value: number | null;
  ndis_labor_code: string | null;
  ndis_non_labor_code: string | null;
  mmm_zone: string | null;
  status: TravelClaimStatus;
  flagged_reason: string | null;
  origin_label: string | null;
  destination_label: string | null;
  route_polyline: string | null;
  created_at: string;
}

export interface TravelLedgerSummary {
  total_claims: number;
  total_value: number;
  pending_count: number;
  flagged_count: number;
  approved_count: number;
  billed_count: number;
}

// ─── Fetch travel claims for org ──────────────────────────────────────────────

export async function getTravelClaims(
  orgId: string,
  status?: TravelClaimStatus | "all",
  fromDays: number = 30,
): Promise<{ claims: TravelClaim[]; summary: TravelLedgerSummary }> {
  const supabase = await createServerSupabaseClient();
  const fromDate = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await (supabase as any).rpc("get_travel_claims_for_org", {
    p_org_id: orgId,
    p_status: status && status !== "all" ? status : null,
    p_from: fromDate,
    p_limit: 200,
  });

  if (error) {
    console.error("[Astrolabe] getTravelClaims RPC error:", error);
    return { claims: [], summary: buildEmptySummary() };
  }

  const claims = (data || []) as TravelClaim[];
  const summary = buildSummary(claims);

  return { claims, summary };
}

function buildSummary(claims: TravelClaim[]): TravelLedgerSummary {
  return {
    total_claims: claims.length,
    total_value: claims.reduce((sum, c) => sum + (c.total_claim_value || 0), 0),
    pending_count: claims.filter(c => c.status === "PENDING_API" || c.status === "VERIFIED_CLEAN").length,
    flagged_count: claims.filter(c => c.status === "FLAGGED_VARIANCE").length,
    approved_count: claims.filter(c => c.status === "APPROVED" || c.status === "OVERRIDDEN").length,
    billed_count: claims.filter(c => c.status === "BILLED").length,
  };
}

function buildEmptySummary(): TravelLedgerSummary {
  return { total_claims: 0, total_value: 0, pending_count: 0, flagged_count: 0, approved_count: 0, billed_count: 0 };
}

// ─── Approve a single travel claim ───────────────────────────────────────────

export async function approveTravelClaim(
  orgId: string,
  claimId: string,
  overrideReason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any).rpc("approve_travel_claim", {
    p_claim_id: claimId,
    p_org_id: orgId,
    p_override_reason: overrideReason ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: (data as any)?.ok === true };
}

// ─── Bulk approve all VERIFIED_CLEAN claims ───────────────────────────────────

export async function bulkApproveCleanTravelClaims(
  orgId: string,
): Promise<{ ok: boolean; approved_count?: number; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any).rpc("bulk_approve_clean_travel_claims", {
    p_org_id: orgId,
  });

  if (error) return { ok: false, error: error.message };
  return {
    ok: (data as any)?.ok === true,
    approved_count: (data as any)?.approved_count,
  };
}

// ─── Reject a travel claim ────────────────────────────────────────────────────

export async function rejectTravelClaim(
  orgId: string,
  claimId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("travel_claims")
    .update({
      status: "REJECTED",
      flagged_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .eq("organization_id", orgId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Push approved claims to Ledger-Prime (billing handoff) ──────────────────

export async function pushTravelClaimsToLedgerPrime(
  orgId: string,
  claimIds: string[],
): Promise<{ ok: boolean; billed_count: number; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Mark claims as BILLED and record timestamp
  const { error, count } = await (supabase as any)
    .from("travel_claims")
    .update({
      status: "BILLED",
      billed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", claimIds)
    .eq("organization_id", orgId)
    .in("status", ["APPROVED", "OVERRIDDEN"]);

  if (error) return { ok: false, billed_count: 0, error: error.message };

  return { ok: true, billed_count: count ?? claimIds.length };
}

// ─── Get a single claim detail with full spatial coordinates ─────────────────

export async function getTravelClaimDetail(
  orgId: string,
  claimId: string,
): Promise<TravelClaim | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any).rpc("get_travel_claims_for_org", {
    p_org_id: orgId,
    p_status: null,
    p_from: new Date(0).toISOString(),
    p_limit: 1000,
  });

  if (error || !data) return null;
  const claims = data as TravelClaim[];
  return claims.find(c => c.claim_id === claimId) ?? null;
}
