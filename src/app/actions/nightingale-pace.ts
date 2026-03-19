/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Helpers ──────────────────────────────────────────────── */
async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

function edgeFunctionUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/${path}`;
}

function serviceHeaders() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };
}

/* ══════════════════════════════════════════════════════════════
   PRODA DEVICE MANAGEMENT
   ══════════════════════════════════════════════════════════════ */

export async function getProdaDevice(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("auth_proda_devices")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) throw error;
    return { data: data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function registerProdaDevice(orgId: string, input: {
  proda_org_id: string;
  device_name: string;
  device_id?: string;
  private_key_pem?: string;
}) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    const upsertPayload: any = {
      organization_id: orgId,
      proda_org_id: input.proda_org_id,
      device_name: input.device_name,
      device_id: input.device_id || null,
      registered_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // If a private key PEM is provided, store reference string
    if (input.private_key_pem) {
      upsertPayload.private_key_vault_id = `vault_proda_pk_${orgId}`;
    }

    const { data, error } = await (supabase as any)
      .from("auth_proda_devices")
      .upsert(upsertPayload, { onConflict: "organization_id" })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function testProdaAuth(orgId: string) {
  try {
    await assertOrgMember(orgId);
    const res = await fetch(edgeFunctionUrl("proda-auth"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({ organization_id: orgId, action: "test" }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "PRODA auth test failed");
    return { data: result, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function refreshProdaToken(orgId: string) {
  try {
    await assertOrgMember(orgId);
    const res = await fetch(edgeFunctionUrl("proda-auth"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({ organization_id: orgId, action: "refresh" }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "PRODA token refresh failed");
    revalidatePath("/dashboard/ndis");
    return { data: result, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   PACE ENDORSEMENT / LINKAGES
   ══════════════════════════════════════════════════════════════ */

export async function getParticipantPaceLinkage(orgId: string, participantProfileId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("participant_pace_linkages")
      .select("*")
      .eq("organization_id", orgId)
      .eq("participant_profile_id", participantProfileId)
      .maybeSingle();
    if (error) throw error;
    return { data: data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getAllPaceLinkages(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("participant_pace_linkages")
      .select("*, participant_profiles:participant_profile_id(id, ndis_number, date_of_birth)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function createPaceLinkage(orgId: string, participantProfileId: string, ndisNumber: string) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("participant_pace_linkages")
      .insert({
        organization_id: orgId,
        participant_profile_id: participantProfileId,
        ndis_number: ndisNumber,
        pace_status: "PENDING_ENDORSEMENT",
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function checkEndorsementStatus(orgId: string, participantProfileId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Call Edge Function to verify endorsement with PACE API
    const res = await fetch(edgeFunctionUrl("pace-check-budget"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({
        organization_id: orgId,
        participant_profile_id: participantProfileId,
        action: "check_endorsement",
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Endorsement check failed");

    // Update the linkage pace_status based on response
    const { data, error } = await (supabase as any)
      .from("participant_pace_linkages")
      .update({
        pace_status: result.pace_status || "ENDORSED",
        endorsement_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("participant_profile_id", participantProfileId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateLinkageBalance(
  orgId: string,
  participantProfileId: string,
  balanceData: Record<string, number>,
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("participant_pace_linkages")
      .update({
        live_balance_cache: balanceData,
        balance_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("participant_profile_id", participantProfileId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   BUDGET CHECKING
   ══════════════════════════════════════════════════════════════ */

export async function checkBudgetForShift(
  orgId: string,
  participantProfileId: string,
  supportCategory: string,
  estimatedCost: number,
  shiftRef?: string,
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .rpc("check_pace_budget_with_wip", {
        p_org_id: orgId,
        p_participant_id: participantProfileId,
        p_support_category: supportCategory,
        p_estimated_cost: estimatedCost,
        p_shift_reference: shiftRef || null,
      });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function releaseWipReservation(orgId: string, reservationId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("pace_wip_reservations")
      .update({
        status: "RELEASED",
      })
      .eq("id", reservationId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   CLAIMS PIPELINE
   ══════════════════════════════════════════════════════════════ */

export async function createPaceClaim(orgId: string, input: {
  participant_profile_id: string;
  ndis_number: string;
  support_item_code: string;
  support_item_name?: string;
  claim_type?: string;
  service_start_date: string;
  service_end_date: string;
  quantity: number;
  unit_price: number;
  gst_code?: string;
  claim_reference?: string;
  invoice_id?: string;
}) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    const totalAmount = input.quantity * input.unit_price;

    const { data, error } = await (supabase as any)
      .from("pace_claims")
      .insert({
        organization_id: orgId,
        participant_profile_id: input.participant_profile_id,
        ndis_number: input.ndis_number,
        support_item_code: input.support_item_code,
        support_item_name: input.support_item_name || null,
        claim_type: input.claim_type || "SERVICE_DELIVERY",
        service_start_date: input.service_start_date,
        service_end_date: input.service_end_date,
        quantity: input.quantity,
        unit_price: input.unit_price,
        total_amount: totalAmount,
        gst_code: input.gst_code || "P1",
        claim_reference: input.claim_reference || null,
        invoice_id: input.invoice_id || null,
        pace_status: "DRAFT",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function submitClaimToPace(orgId: string, claimId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const res = await fetch(edgeFunctionUrl("pace-submit-claim"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({
        organization_id: orgId,
        claim_id: claimId,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      // Update claim with error — queue for retry if 503
      const failStatus = res.status === 503 ? "QUEUED_FOR_PACE" : "ERROR";
      await (supabase as any)
        .from("pace_claims")
        .update({
          pace_status: failStatus,
          pace_error_code: result.error_code || String(res.status),
          pace_error_message: result.error || "Submission failed",
          submitted_at: new Date().toISOString(),
          retry_count: (supabase as any).rpc ? 1 : 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimId)
        .eq("organization_id", orgId);
      throw new Error(result.error || "PACE claim submission failed");
    }

    // Update claim with success
    const { data, error } = await (supabase as any)
      .from("pace_claims")
      .update({
        pace_status: result.pace_status || "SUBMITTED_TO_PACE",
        pace_claim_id: result.pace_claim_id || null,
        pace_response: result,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getPaceClaims(orgId: string, filters?: {
  status?: string;
  ndis_number?: string;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    let query = (supabase as any)
      .from("pace_claims")
      .select("*, participant_profiles:participant_profile_id(id, ndis_number)")
      .eq("organization_id", orgId);

    if (filters?.status) {
      query = query.eq("pace_status", filters.status);
    }
    if (filters?.ndis_number) {
      query = query.eq("ndis_number", filters.ndis_number);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function getClaimDetail(orgId: string, claimId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("pace_claims")
      .select("*, participant_profiles:participant_profile_id(id, ndis_number, date_of_birth)")
      .eq("id", claimId)
      .eq("organization_id", orgId)
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function retryFailedClaim(orgId: string, claimId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Reset error state
    const { error: resetErr } = await (supabase as any)
      .from("pace_claims")
      .update({
        pace_status: "READY",
        pace_error_code: null,
        pace_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("organization_id", orgId)
      .in("pace_status", ["ERROR", "REJECTED"]);
    if (resetErr) throw resetErr;

    // Re-submit
    const result = await submitClaimToPace(orgId, claimId);
    return result;
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function markClaimPaid(
  orgId: string,
  claimId: string,
  praReference: string,
  praAmount: number,
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("pace_claims")
      .update({
        pace_status: "PAID",
        pra_reference: praReference,
        pra_amount: praAmount,
        date_paid: new Date().toISOString().split("T")[0],
        pra_received_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/ndis");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════ */

export async function getPaceDashboardStats(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .rpc("get_pace_dashboard_stats", {
        p_org_id: orgId,
      });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getPaceClaimErrors(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("pace_claims")
      .select("*, participant_profiles:participant_profile_id(id, ndis_number)")
      .eq("organization_id", orgId)
      .in("pace_status", ["REJECTED", "ERROR"])
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   BATCH OPERATIONS
   ══════════════════════════════════════════════════════════════ */

export async function submitAllReadyClaims(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get all READY claims
    const { data: readyClaims, error: fetchErr } = await (supabase as any)
      .from("pace_claims")
      .select("id")
      .eq("organization_id", orgId)
      .eq("pace_status", "READY")
      .order("created_at", { ascending: true });
    if (fetchErr) throw fetchErr;

    if (!readyClaims || readyClaims.length === 0) {
      return { data: { submitted: 0, errors: [] }, error: null };
    }

    const results: { submitted: number; errors: { claimId: string; error: string }[] } = {
      submitted: 0,
      errors: [],
    };

    for (const claim of readyClaims) {
      const res = await submitClaimToPace(orgId, claim.id);
      if (res.error) {
        results.errors.push({ claimId: claim.id, error: res.error });
      } else {
        results.submitted++;
      }
    }

    revalidatePath("/dashboard/ndis");
    return { data: results, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function processClaimQueue(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get all QUEUED_FOR_PACE claims, oldest first
    const { data: queuedClaims, error: fetchErr } = await (supabase as any)
      .from("pace_claims")
      .select("id, retry_count")
      .eq("organization_id", orgId)
      .eq("pace_status", "QUEUED_FOR_PACE")
      .order("created_at", { ascending: true });
    if (fetchErr) throw fetchErr;

    if (!queuedClaims || queuedClaims.length === 0) {
      return { data: { processed: 0, succeeded: 0, failed: 0, skipped: 0 }, error: null };
    }

    const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
    const MAX_ATTEMPTS = 5;

    for (const claim of queuedClaims) {
      // Skip claims that have exceeded max retry attempts
      if ((claim.retry_count || 0) >= MAX_ATTEMPTS) {
        await (supabase as any)
          .from("pace_claims")
          .update({
            pace_status: "ERROR",
            pace_error_message: `Max retry attempts (${MAX_ATTEMPTS}) exceeded`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", claim.id)
          .eq("organization_id", orgId);
        results.skipped++;
        continue;
      }

      // Increment attempts count before submitting
      await (supabase as any)
        .from("pace_claims")
        .update({
          retry_count: (claim.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim.id)
        .eq("organization_id", orgId);

      const res = await submitClaimToPace(orgId, claim.id);
      results.processed++;

      if (res.error) {
        results.failed++;
      } else {
        results.succeeded++;
      }
    }

    revalidatePath("/dashboard/ndis");
    return { data: results, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
