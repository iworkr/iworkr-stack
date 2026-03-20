/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateIncidentSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid().optional().nullable(),
  shift_id: z.string().uuid().optional().nullable(),
  category: z.enum([
    "fall", "medication_error", "behavioral", "environmental",
    "injury", "near_miss", "property_damage", "abuse_allegation",
    "restrictive_practice", "other",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  location: z.string().max(500).optional().nullable(),
  occurred_at: z.string(),
  witnesses: z.array(z.unknown()).default([]),
  immediate_actions: z.string().max(2000).optional().nullable(),
  photos: z.array(z.string().url()).default([]),
  is_reportable: z.boolean().default(false),
});

const UpdateIncidentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reported", "under_review", "investigation", "resolved", "closed"]).optional(),
  resolution_notes: z.string().max(5000).optional().nullable(),
  reviewed_by: z.string().uuid().optional().nullable(),
});

// ── Incidents ────────────────────────────────────────────────────────────────

export async function createIncidentAction(input: z.infer<typeof CreateIncidentSchema>) {
  try {
    const parsed = CreateIncidentSchema.parse(input);
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("incidents")
      .insert({ ...parsed, worker_id: user.id, reported_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/incidents");
    return data;
  } catch (e: any) {
    console.error("[care] createIncidentAction failed:", e);
    throw e;
  }
}

export async function updateIncidentAction(input: z.infer<typeof UpdateIncidentSchema>) {
  try {
    const parsed = UpdateIncidentSchema.parse(input);
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const updates: any = {};
    if (parsed.status) updates.status = parsed.status;
    if (parsed.resolution_notes !== undefined) updates.resolution_notes = parsed.resolution_notes;
    if (parsed.status === "resolved" || parsed.status === "closed") {
      updates.resolved_at = new Date().toISOString();
      updates.reviewed_by = user.id;
      updates.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await (supabase as any)
      .from("incidents")
      .update(updates)
      .eq("id", parsed.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/incidents");
    return data;
  } catch (e: any) {
    console.error("[care] updateIncidentAction failed:", e);
    throw e;
  }
}

export async function fetchIncidentsAction(organizationId: string, filters?: { status?: string; severity?: string; category?: string }) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("incidents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.severity) query = query.eq("severity", filters.severity);
    if (filters?.category) query = query.eq("category", filters.category);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchIncidentsAction failed:", e);
    return [];
  }
}

// ── Audit Sessions ───────────────────────────────────────────────────────────

export async function createAuditSessionAction(input: {
  organization_id: string;
  scope_type: "participant" | "organization" | "date_range";
  scope_participant_id?: string;
  scope_date_from?: string;
  scope_date_to?: string;
  title?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Generate magic link token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72-hour expiry

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", input.organization_id)
      .single();

    const { data, error } = await (supabase as any)
      .from("audit_sessions")
      .insert({
        ...input,
        generated_by: user.id,
        magic_link_token: token,
        expires_at: expiresAt.toISOString(),
        watermark_text: `CONFIDENTIAL — ${org?.name || "iWorkr"} — ${new Date().toISOString().split("T")[0]}`,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/admin/audit");
    return data;
  } catch (e: any) {
    console.error("[care] createAuditSessionAction failed:", e);
    throw e;
  }
}

export async function fetchAuditSessionsAction(organizationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("audit_sessions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchAuditSessionsAction failed:", e);
    return [];
  }
}

// ── CI Actions ───────────────────────────────────────────────────────────────

export async function createCIActionAction(input: {
  organization_id: string;
  title: string;
  description?: string;
  source_type: string;
  source_id?: string;
  source_reference?: string;
  priority?: string;
  owner_name?: string;
  due_date?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("ci_actions")
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/quality");
    return data;
  } catch (e: any) {
    console.error("[care] createCIActionAction failed:", e);
    throw e;
  }
}

export async function updateCIActionAction(id: string, updates: any) {
  try {
    const supabase = await createServerSupabaseClient();

    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    if (updates.status === "completed") {
      payload.completed_at = new Date().toISOString();
    }

    const { data, error } = await (supabase as any)
      .from("ci_actions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/quality");
    return data;
  } catch (e: any) {
    console.error("[care] updateCIActionAction failed:", e);
    throw e;
  }
}

export async function fetchCIActionsAction(organizationId: string, status?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("ci_actions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchCIActionsAction failed:", e);
    return [];
  }
}

// ── Policy Register ──────────────────────────────────────────────────────────

export async function createPolicyAction(input: {
  organization_id: string;
  title: string;
  category: string;
  version?: string;
  content?: string;
  document_url?: string;
  effective_date?: string;
  review_date?: string;
  requires_acknowledgement?: boolean;
  acknowledgement_deadline?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("policy_register")
      .insert({ ...input, created_by: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/quality");
    return data;
  } catch (e: any) {
    console.error("[care] createPolicyAction failed:", e);
    throw e;
  }
}

export async function fetchPoliciesAction(organizationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("policy_register")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchPoliciesAction failed:", e);
    return [];
  }
}

export async function acknowledgePolicyAction(policyId: string, organizationId: string, version: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("policy_acknowledgements")
      .upsert({
        organization_id: organizationId,
        policy_id: policyId,
        user_id: user.id,
        policy_version: version,
      }, { onConflict: "policy_id,user_id,policy_version" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/quality");
    return data;
  } catch (e: any) {
    console.error("[care] acknowledgePolicyAction failed:", e);
    throw e;
  }
}

// ── Governance Meetings ──────────────────────────────────────────────────────

export async function createGovernanceMeetingAction(input: {
  organization_id: string;
  title: string;
  meeting_type?: string;
  meeting_date: string;
  agenda?: string;
  attendees?: unknown[];
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("governance_meetings")
      .insert({ ...input, created_by: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/quality");
    return data;
  } catch (e: any) {
    console.error("[care] createGovernanceMeetingAction failed:", e);
    throw e;
  }
}

export async function fetchGovernanceMeetingsAction(organizationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("governance_meetings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("meeting_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchGovernanceMeetingsAction failed:", e);
    return [];
  }
}

// ── Support Coordination Cases ───────────────────────────────────────────────

export async function createSCCaseAction(input: {
  organization_id: string;
  participant_id: string;
  title: string;
  case_type?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("support_coordination_cases")
      .insert({ ...input, coordinator_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/plans");
    return data;
  } catch (e: any) {
    console.error("[care] createSCCaseAction failed:", e);
    throw e;
  }
}

export async function updateSCCaseAction(id: string, updates: any) {
  try {
    const supabase = await createServerSupabaseClient();

    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    if (updates.status === "closed") {
      payload.closed_at = new Date().toISOString();
    }

    const { data, error } = await (supabase as any)
      .from("support_coordination_cases")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/plans");
    return data;
  } catch (e: any) {
    console.error("[care] updateSCCaseAction failed:", e);
    throw e;
  }
}

export async function fetchSCCasesAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("support_coordination_cases")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (participantId) query = query.eq("participant_id", participantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchSCCasesAction failed:", e);
    return [];
  }
}

// ── NDIS Catalogue ───────────────────────────────────────────────────────────

export async function fetchNDISCatalogueAction(search?: string, category?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("ndis_catalogue")
      .select("*")
      .is("effective_to", null) // only active items
      .order("support_item_number")
      .limit(100);

    if (category) query = query.eq("support_category", category);
    if (search) query = query.or(`support_item_number.ilike.%${search}%,support_item_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Supabase returns `numeric` columns as strings — coerce to numbers
    // and map DB column names to the UI interface field names
    return (data || []).map((row: any) => ({
      ...row,
      national_price: parseFloat(row.base_rate_national) || 0,
      remote_price: row.base_rate_remote != null ? parseFloat(row.base_rate_remote) || null : null,
      very_remote_price: row.base_rate_very_remote != null ? parseFloat(row.base_rate_very_remote) || null : null,
    }));
  } catch (e: any) {
    console.error("[care] fetchNDISCatalogueAction failed:", e);
    return [];
  }
}

// ── Budget ───────────────────────────────────────────────────────────────────

export async function fetchBudgetAllocationsAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("budget_allocations")
      .select("*, service_agreements(title, start_date, end_date, status)")
      .eq("organization_id", organizationId);

    if (participantId) query = query.eq("participant_id", participantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchBudgetAllocationsAction failed:", e);
    return [];
  }
}

// ── Claims ───────────────────────────────────────────────────────────────────

export async function fetchClaimBatchesAction(organizationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("proda_claim_batches")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchClaimBatchesAction failed:", e);
    return [];
  }
}

export async function fetchClaimLineItemsAction(organizationId: string, batchId?: string, status?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("claim_line_items")
      .select("*, participant_profiles!claim_line_items_participant_id_fkey(id, ndis_number)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (batchId) query = query.eq("claim_batch_id", batchId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchClaimLineItemsAction failed:", e);
    return [];
  }
}

// ── Plan Manager Invoices ────────────────────────────────────────────────────

export async function fetchPlanManagerInvoicesAction(organizationId: string, status?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("plan_manager_invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchPlanManagerInvoicesAction failed:", e);
    return [];
  }
}

export async function approvePlanManagerInvoiceAction(id: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("plan_manager_invoices")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/finance/plan-manager");
    return data;
  } catch (e: any) {
    console.error("[care] approvePlanManagerInvoiceAction failed:", e);
    throw e;
  }
}

export async function rejectPlanManagerInvoiceAction(id: string, reason: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("plan_manager_invoices")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/finance/plan-manager");
    return data;
  } catch (e: any) {
    console.error("[care] rejectPlanManagerInvoiceAction failed:", e);
    throw e;
  }
}

// ── Create Claim Batch ───────────────────────────────────────────────────────

export async function createClaimBatchAction(input: {
  organization_id: string;
  line_item_ids: string[];
}) {
  try {
    const supabase = await createServerSupabaseClient();

    // Create the batch record
    const { data: batch, error: batchError } = await (supabase as any)
      .from("proda_claim_batches")
      .insert({
        organization_id: input.organization_id,
        status: "draft",
        submitted_at: null,
      })
      .select()
      .single();

    if (batchError) throw new Error(batchError.message);

    // Assign selected line items to this batch
    const { error: updateError } = await (supabase as any)
      .from("claim_line_items")
      .update({ claim_batch_id: batch.id, status: "pending" })
      .in("id", input.line_item_ids)
      .eq("organization_id", input.organization_id);

    if (updateError) throw new Error(updateError.message);

    revalidatePath("/dashboard/finance/ndis-claims");
    return batch;
  } catch (e: any) {
    console.error("[care] createClaimBatchAction failed:", e);
    throw e;
  }
}

// ── Apply Claim Resolutions ─────────────────────────────────────────────────

export async function applyClaimResolutionsAction(input: {
  organization_id: string;
  resolutions: Record<string, "shift_oop" | "adjust_hours" | "write_off">;
}) {
  try {
    const supabase = await createServerSupabaseClient();

    const resolvedAt = new Date().toISOString();
    const updates = Object.entries(input.resolutions).map(([lineItemId, resolution]) => ({
      id: lineItemId,
      resolution_action: resolution,
      status: resolution === "write_off" ? ("written_off" as const) : ("resolved" as const),
    }));

    const batchKey = (u: (typeof updates)[number]) => `${u.resolution_action}\0${u.status}`;
    const batches = new Map<
      string,
      { ids: string[]; resolution_action: (typeof updates)[number]["resolution_action"]; status: (typeof updates)[number]["status"] }
    >();
    for (const update of updates) {
      const key = batchKey(update);
      let batch = batches.get(key);
      if (!batch) {
        batch = { ids: [], resolution_action: update.resolution_action, status: update.status };
        batches.set(key, batch);
      }
      batch.ids.push(update.id);
    }

    for (const batch of batches.values()) {
      const { error } = await (supabase as any)
        .from("claim_line_items")
        .update({
          resolution_action: batch.resolution_action,
          status: batch.status,
          resolved_at: resolvedAt,
        })
        .in("id", batch.ids)
        .eq("organization_id", input.organization_id);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/dashboard/finance/ndis-claims");
    return { resolved: updates.length };
  } catch (e: any) {
    console.error("[care] applyClaimResolutionsAction failed:", e);
    throw e;
  }
}
