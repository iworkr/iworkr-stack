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
    .select("role, max_po_limit")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role, maxPoLimit: membership.max_po_limit };
}

/* ══════════════════════════════════════════════════════════════
   PURCHASE ORDER GENERATION (Mobile Counter-Strike)
   ══════════════════════════════════════════════════════════════ */

export async function generatePurchaseOrder(input: {
  orgId: string;
  jobId?: string;
  supplierId?: string;
  supplierName?: string;
  expectedTotal?: number;
  notes?: string;
  offlineRef?: string;
}) {
  try {
    const { supabase, user } = await assertOrgMember(input.orgId);

    const { data, error } = await (supabase as any).rpc("generate_next_po_number", {
      p_org_id: input.orgId,
      p_job_id: input.jobId || null,
      p_worker_id: user.id,
      p_supplier: input.supplierId || null,
      p_supplier_name: input.supplierName || null,
      p_expected_total: input.expectedTotal || null,
      p_notes: input.notes || null,
      p_offline_ref: input.offlineRef || null,
    });

    if (error) throw error;
    revalidatePath("/dashboard/ops/purchase-orders");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function approvePurchaseOrder(poId: string, orgId: string) {
  try {
    const { supabase, user, role } = await assertOrgMember(orgId);
    if (!["owner", "admin", "manager"].includes(role)) {
      throw new Error("Only managers can approve purchase orders");
    }

    const { data, error } = await (supabase as any).rpc("approve_purchase_order", {
      p_po_id: poId,
      p_approver_id: user.id,
    });

    if (error) throw error;
    revalidatePath("/dashboard/ops/purchase-orders");
    revalidatePath("/dashboard/finance/accounts-payable");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getPurchaseOrdersForJob(jobId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("purchase_orders")
      .select("*, purchase_order_lines(*)")
      .eq("source_job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   SUPPLIER RECEIPTS (Vision AI & AP)
   ══════════════════════════════════════════════════════════════ */

export async function uploadReceiptImage(
  orgId: string,
  poId: string | null,
  jobId: string | null,
  formData: FormData,
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const file = formData.get("receipt") as File;
    if (!file) throw new Error("No file provided");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${orgId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from("supplier-receipts-photos")
      .upload(path, file, { contentType: file.type });

    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("supplier-receipts-photos")
      .getPublicUrl(path);

    // Create receipt record
    const { data: receipt, error: insErr } = await (supabase as any)
      .from("supplier_receipts")
      .insert({
        organization_id: orgId,
        po_id: poId,
        job_id: jobId,
        worker_id: user.id,
        receipt_image_url: urlData.publicUrl,
        receipt_storage_path: path,
        status: "PENDING_AI_PARSE",
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Trigger OCR Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      fetch(`${supabaseUrl}/functions/v1/receipt-ocr`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receipt_id: receipt.id,
          storage_path: path,
          organization_id: orgId,
          po_id: poId,
          job_id: jobId,
          worker_id: user.id,
        }),
      }).catch((e) => console.error("OCR trigger failed:", e));
    }

    revalidatePath("/dashboard/finance/accounts-payable");
    return { data: receipt, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getSupplierReceipts(orgId: string, filters?: {
  status?: string;
  jobId?: string;
  poId?: string;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    let query = (supabase as any)
      .from("supplier_receipts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.jobId) query = query.eq("job_id", filters.jobId);
    if (filters?.poId) query = query.eq("po_id", filters.poId);

    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function getReceiptDetail(receiptId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("supplier_receipts")
      .select("*")
      .eq("id", receiptId)
      .eq("organization_id", orgId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function verifyReceipt(
  receiptId: string,
  orgId: string,
  adjustments?: {
    actual_total_amount?: number;
    actual_tax_amount?: number;
    supplier_invoice_number?: string;
    cogs_account_code?: string;
  },
) {
  try {
    const { supabase, user, role } = await assertOrgMember(orgId);
    if (!["owner", "admin", "manager"].includes(role)) {
      throw new Error("Only managers can verify receipts");
    }

    const updates: any = {
      status: "VERIFIED",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (adjustments) {
      Object.assign(updates, adjustments);
    }

    const { data, error } = await (supabase as any)
      .from("supplier_receipts")
      .update(updates)
      .eq("id", receiptId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw error;

    // Update PO status to FULFILLED if receipt is linked
    if (data.po_id) {
      await (supabase as any)
        .from("purchase_orders")
        .update({
          status: "FULFILLED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.po_id);
    }

    revalidatePath("/dashboard/finance/accounts-payable");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function rejectReceipt(receiptId: string, orgId: string, reason: string) {
  try {
    const { supabase, user, role } = await assertOrgMember(orgId);
    if (!["owner", "admin", "manager"].includes(role)) {
      throw new Error("Only managers can reject receipts");
    }

    const { data, error } = await (supabase as any)
      .from("supplier_receipts")
      .update({
        status: "REJECTED",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/dashboard/finance/accounts-payable");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function pushReceiptToXero(receiptId: string, orgId: string) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Only admins can push to accounting");
    }

    // Get the verified receipt
    const { data: receipt, error: fetchErr } = await (supabase as any)
      .from("supplier_receipts")
      .select("*")
      .eq("id", receiptId)
      .eq("organization_id", orgId)
      .eq("status", "VERIFIED")
      .single();

    if (fetchErr || !receipt) throw new Error("Receipt not found or not verified");

    // Construct ACCPAY Bill payload for Xero/Ledger-Sync
    const billPayload = {
      type: "ACCPAY",
      contact_name: receipt.supplier_name_extracted || "Unknown Supplier",
      invoice_number: receipt.supplier_invoice_number,
      total: receipt.actual_total_amount,
      tax: receipt.actual_tax_amount,
      date: receipt.extracted_date || new Date().toISOString().split("T")[0],
      account_code: receipt.cogs_account_code || "300",
      attachment_url: receipt.receipt_image_url,
      reference: receipt.extracted_po_number || `REC-${receiptId.slice(0, 8)}`,
    };

    // Trigger Ledger-Sync edge function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const syncRes = await fetch(`${supabaseUrl}/functions/v1/ledger-sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_bill",
          organization_id: orgId,
          payload: billPayload,
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        await (supabase as any)
          .from("supplier_receipts")
          .update({
            status: "SYNCED_TO_ACCOUNTING",
            xero_bill_id: syncData.bill_id || syncData.id || "synced",
            xero_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", receiptId);
      }
    } else {
      // If no edge function available, just mark as synced (mock)
      await (supabase as any)
        .from("supplier_receipts")
        .update({
          status: "SYNCED_TO_ACCOUNTING",
          xero_bill_id: "manual-sync",
          xero_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);
    }

    revalidatePath("/dashboard/finance/accounts-payable");
    return { data: { success: true, bill: billPayload }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   JOB COSTING (The Financial Truth)
   ══════════════════════════════════════════════════════════════ */

export async function getJobCosting(jobId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("calculate_job_costing", {
      p_job_id: jobId,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getJobCostingSummary(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get all active jobs with their costing
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("id, title, status")
      .eq("organization_id", orgId)
      .in("status", ["in_progress", "scheduled", "en_route", "on_site"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const costingResults = [];
    for (const job of jobs || []) {
      const { data: costing } = await (supabase as any).rpc("calculate_job_costing", {
        p_job_id: job.id,
      });
      if (costing) {
        costingResults.push({ ...job, costing });
      }
    }

    return { data: costingResults, error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   AP TRIAGE DASHBOARD STATS
   ══════════════════════════════════════════════════════════════ */

export async function getAPDashboardStats(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const sb = supabase as any;
    const [
      { data: pendingAI },
      { data: needsReview },
      { data: verified },
      { data: synced },
      { data: totalValue },
      { data: pendingApproval },
    ] = await Promise.all([
      sb.from("supplier_receipts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "PENDING_AI_PARSE"),
      sb.from("supplier_receipts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "NEEDS_REVIEW"),
      sb.from("supplier_receipts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "VERIFIED"),
      sb.from("supplier_receipts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "SYNCED_TO_ACCOUNTING"),
      sb.from("supplier_receipts")
        .select("actual_total_amount")
        .eq("organization_id", orgId)
        .in("status", ["NEEDS_REVIEW", "VERIFIED"]),
      sb.from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("approval_status", "pending"),
    ]);

    const total = (totalValue || []).reduce(
      (sum: number, r: any) => sum + (r.actual_total_amount || 0),
      0,
    );

    return {
      data: {
        pending_ai: (pendingAI as any)?.length ?? 0,
        needs_review: (needsReview as any)?.length ?? 0,
        verified: (verified as any)?.length ?? 0,
        synced: (synced as any)?.length ?? 0,
        total_pending_value: total,
        pending_po_approvals: (pendingApproval as any)?.length ?? 0,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   SPEND LIMITS MANAGEMENT
   ══════════════════════════════════════════════════════════════ */

export async function updateMemberSpendLimit(
  orgId: string,
  userId: string,
  newLimit: number,
) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Only admins can update spend limits");
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ max_po_limit: newLimit } as any)
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) throw error;
    revalidatePath("/dashboard/settings/team");
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}
