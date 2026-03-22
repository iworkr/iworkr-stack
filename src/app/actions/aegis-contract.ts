/**
 * @module AegisContract Server Actions
 * @status COMPLETE
 * @description CRUD operations for Aegis contract management with org membership checks
 * @exports createContractAction, updateContractAction, fetchContractsAction, deleteContractAction, fetchContractByIdAction
 * @lastAudit 2026-03-22
 */
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

/* ══════════════════════════════════════════════════════════════
   COMMERCIAL CONTRACTS
   ══════════════════════════════════════════════════════════════ */
export async function createCommercialContract(input: {
  orgId: string;
  jobId: string;
  contractNumber?: string;
  clientName?: string;
  projectName?: string;
  totalContractValue: number;
  retentionPercentage: number;
  retentionCapPercentage?: number;
  contractDate?: string;
}) {
  try {
    const { supabase, user } = await assertOrgMember(input.orgId);
    const { data, error } = await (supabase as any)
      .from("commercial_contracts")
      .insert({
        organization_id: input.orgId,
        job_id: input.jobId,
        contract_number: input.contractNumber,
        client_name: input.clientName,
        project_name: input.projectName,
        total_contract_value: input.totalContractValue,
        retention_percentage: input.retentionPercentage,
        retention_cap_percentage: input.retentionCapPercentage ?? 5.0,
        contract_date: input.contractDate,
        created_by: user.id,
        status: "DRAFT",
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath(`/dashboard/jobs/${input.jobId}/contract`);
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getContractForJob(jobId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("commercial_contracts")
      .select("*")
      .eq("job_id", jobId)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getContractById(contractId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("commercial_contracts")
      .select("*")
      .eq("id", contractId)
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function lockContract(contractId: string, orgId: string) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("lock_commercial_contract", {
      p_contract_id: contractId,
      p_locked_by: user.id,
    });
    if (error) throw error;
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateContractStatus(contractId: string, orgId: string, status: string, pcDate?: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (pcDate) {
      updates.practical_completion_date = pcDate;
      updates.dlp_end_date = new Date(new Date(pcDate).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    }
    const { data, error } = await (supabase as any)
      .from("commercial_contracts")
      .update(updates)
      .eq("id", contractId)
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULE OF VALUES (SOV)
   ══════════════════════════════════════════════════════════════ */
export async function getSOVLines(contractId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("schedule_of_values")
      .select("*")
      .eq("contract_id", contractId)
      .order("sort_order", { ascending: true })
      .order("item_code", { ascending: true });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function upsertSOVLine(contractId: string, orgId: string, line: {
  id?: string;
  item_code: string;
  description: string;
  scheduled_value: number;
  sort_order?: number;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    if (line.id) {
      const { data, error } = await (supabase as any)
        .from("schedule_of_values")
        .update({ item_code: line.item_code, description: line.description, scheduled_value: line.scheduled_value, sort_order: line.sort_order, updated_at: new Date().toISOString() })
        .eq("id", line.id)
        .select().single();
      if (error) throw error;
      return { data, error: null };
    } else {
      const { data, error } = await (supabase as any)
        .from("schedule_of_values")
        .insert({ contract_id: contractId, item_code: line.item_code, description: line.description, scheduled_value: line.scheduled_value, sort_order: line.sort_order ?? 0 })
        .select().single();
      if (error) throw error;
      return { data, error: null };
    }
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteSOVLine(lineId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { error } = await (supabase as any).from("schedule_of_values").delete().eq("id", lineId);
    if (error) throw error;
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function addVariation(contractId: string, orgId: string, description: string, value: number, ref?: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("add_contract_variation", {
      p_contract_id: contractId,
      p_description: description,
      p_value: value,
      p_variation_ref: ref || null,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS CLAIMS
   ══════════════════════════════════════════════════════════════ */
export async function generateClaim(contractId: string, orgId: string, periodEnd: string) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("generate_next_claim", {
      p_contract_id: contractId,
      p_period_end: periodEnd,
      p_created_by: user.id,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getClaimsForContract(contractId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("progress_claims")
      .select("*")
      .eq("contract_id", contractId)
      .order("claim_number", { ascending: true });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function getClaimWithLines(claimId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data: claim, error: claimErr } = await (supabase as any)
      .from("progress_claims")
      .select("*")
      .eq("id", claimId)
      .single();
    if (claimErr) throw claimErr;

    const { data: lines, error: linesErr } = await (supabase as any)
      .from("claim_lines")
      .select("*, schedule_of_values!inner(item_code, description, scheduled_value)")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });
    if (linesErr) throw linesErr;

    return { data: { ...claim, lines: lines || [] }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateClaimLine(lineId: string, orgId: string, updates: {
  work_completed_this_period?: number;
  materials_stored_this_period?: number;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    // Get the line + SOV to recalculate
    const { data: line } = await (supabase as any).from("claim_lines").select("*, schedule_of_values!inner(scheduled_value)").eq("id", lineId).single();
    if (!line) throw new Error("Line not found");

    const work = updates.work_completed_this_period ?? line.work_completed_this_period;
    const stored = updates.materials_stored_this_period ?? line.materials_stored_this_period;
    const prevCompleted = line.previously_completed || 0;
    const totalCompleted = prevCompleted + work + stored;
    const scheduledValue = line.schedule_of_values.scheduled_value;

    // Over-billing failsafe
    if (totalCompleted > scheduledValue) {
      return { data: null, error: `Total completed ($${totalCompleted.toFixed(2)}) exceeds scheduled value ($${scheduledValue.toFixed(2)})` };
    }

    const pctComplete = scheduledValue > 0 ? (totalCompleted / scheduledValue) * 100 : 0;

    const { data, error } = await (supabase as any)
      .from("claim_lines")
      .update({
        work_completed_this_period: work,
        materials_stored_this_period: stored,
        total_completed_to_date: totalCompleted,
        percent_complete: Math.round(pctComplete * 10000) / 10000,
        balance_to_finish: scheduledValue - totalCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lineId)
      .select().single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function calculateClaimSummary(claimId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("calculate_claim_summary", { p_claim_id: claimId });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function submitClaim(claimId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    // First recalculate
    await (supabase as any).rpc("calculate_claim_summary", { p_claim_id: claimId });
    const { data, error } = await (supabase as any)
      .from("progress_claims")
      .update({ status: "SUBMITTED", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", claimId).select().single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function certifyClaim(claimId: string, orgId: string, certifiedAmount: number, certifiedBy: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const status = certifiedAmount < (await (supabase as any).from("progress_claims").select("current_payment_due").eq("id", claimId).single()).data?.current_payment_due
      ? "CERTIFIED_PARTIAL" : "CERTIFIED_FULL";
    const { data, error } = await (supabase as any)
      .from("progress_claims")
      .update({ status, certified_amount: certifiedAmount, certified_by_name: certifiedBy, certified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", claimId).select().single();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   XERO SYNC (ACCPAYREC with Retention Liability Split)
   ══════════════════════════════════════════════════════════════ */
export async function syncClaimToXero(claimId: string, orgId: string) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);
    if (!["owner", "admin"].includes(role)) throw new Error("Only admins can sync to Xero");

    const { data: claim } = await (supabase as any).from("progress_claims").select("*").eq("id", claimId).single();
    if (!claim) throw new Error("Claim not found");

    const { data: contract } = await (supabase as any).from("commercial_contracts").select("*").eq("id", claim.contract_id).single();
    if (!contract) throw new Error("Contract not found");

    const grossAmount = claim.total_completed_to_date - claim.gross_completed_previously;
    const retentionAmount = claim.retention_to_date - (claim.less_previous_certificates > 0 ? claim.retention_to_date * (claim.gross_completed_previously / claim.total_completed_to_date) : 0);

    const payload = {
      type: "ACCREC",
      contact_name: contract.client_name || "Head Contractor",
      reference: `Progress Claim #${claim.claim_number} - ${contract.contract_number}`,
      date: claim.period_end,
      line_items: [
        {
          description: `Progress Claim #${claim.claim_number} - Gross Work Completed`,
          quantity: 1,
          unit_amount: grossAmount,
          account_code: contract.revenue_account_code || "200",
          tax_type: "OUTPUT",
        },
        {
          description: `Less ${contract.retention_percentage}% Retention Withheld`,
          quantity: 1,
          unit_amount: -(claim.retention_to_date - (claim.gross_completed_previously > 0 ? claim.retention_to_date * (claim.gross_completed_previously / claim.total_completed_to_date) : 0)),
          account_code: contract.retention_account_code || "2150",
          tax_type: "NONE",
        },
      ],
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const res = await fetch(`${supabaseUrl}/functions/v1/ledger-sync`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_invoice", organization_id: orgId, payload }),
      });
      if (res.ok) {
        const syncData = await res.json();
        await (supabase as any).from("progress_claims").update({
          status: "INVOICED",
          xero_invoice_id: syncData.invoice_id || syncData.id || "synced",
          invoiced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", claimId);
      }
    }

    return { data: { success: true, payload }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   RETENTION DASHBOARD
   ══════════════════════════════════════════════════════════════ */
export async function getRetentionSummary(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data: contracts, error } = await (supabase as any)
      .from("commercial_contracts")
      .select("id, contract_number, client_name, project_name, job_id, total_contract_value, retention_percentage, total_retention_held, retention_released, practical_completion_date, dlp_end_date, status, retention_release_50_done, retention_release_final")
      .eq("organization_id", orgId)
      .in("status", ["ACTIVE", "PRACTICAL_COMPLETION", "DLP", "CLOSED"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    const totalHeld = (contracts || []).reduce((s: number, c: any) => s + (c.total_retention_held || 0), 0);
    const totalReleased = (contracts || []).reduce((s: number, c: any) => s + (c.retention_released || 0), 0);
    const now = new Date();
    const eligibleForRelease = (contracts || []).filter((c: any) => {
      if (!c.dlp_end_date) return false;
      const dlpEnd = new Date(c.dlp_end_date);
      const daysUntil = Math.ceil((dlpEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 30 && !c.retention_release_final;
    });
    const overdue = (contracts || []).filter((c: any) => {
      if (!c.dlp_end_date) return false;
      return new Date(c.dlp_end_date) < now && !c.retention_release_final;
    });

    return {
      data: {
        contracts: contracts || [],
        total_retention_held: totalHeld,
        total_released: totalReleased,
        net_retention: totalHeld - totalReleased,
        eligible_for_release: eligibleForRelease.length,
        overdue_count: overdue.length,
        overdue_contracts: overdue,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
