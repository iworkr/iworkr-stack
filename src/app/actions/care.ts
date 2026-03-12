/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateObservationSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  shift_id: z.string().uuid().optional().nullable(),
  observation_type: z.enum([
    "blood_pressure", "blood_glucose", "heart_rate", "temperature",
    "weight", "oxygen_saturation", "respiration_rate", "seizure",
    "pain_level", "bowel_movement", "fluid_intake", "food_intake",
    "sleep_quality", "mood", "other",
  ]),
  value_numeric: z.number().optional().nullable(),
  value_text: z.string().max(500).optional().nullable(),
  value_systolic: z.number().int().optional().nullable(),
  value_diastolic: z.number().int().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  is_abnormal: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

const CreateMedicationSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  medication_name: z.string().min(1).max(200),
  generic_name: z.string().max(200).optional().nullable(),
  dosage: z.string().min(1).max(100),
  route: z.enum([
    "oral", "sublingual", "topical", "inhaled", "subcutaneous",
    "intramuscular", "rectal", "ophthalmic", "otic", "nasal",
    "transdermal", "other",
  ]),
  frequency: z.enum([
    "once_daily", "twice_daily", "three_times_daily", "four_times_daily",
    "every_morning", "every_night", "weekly", "fortnightly", "monthly",
    "prn", "other",
  ]),
  time_slots: z.array(z.string()).default([]),
  prescribing_doctor: z.string().max(200).optional().nullable(),
  pharmacy: z.string().max(200).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_prn: z.boolean().default(false),
  prn_reason: z.string().max(500).optional().nullable(),
  special_instructions: z.string().max(1000).optional().nullable(),
});

const RecordMARSchema = z.object({
  organization_id: z.string().uuid(),
  medication_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  shift_id: z.string().uuid().optional().nullable(),
  outcome: z.enum([
    "given", "refused", "absent", "withheld", "self_administered",
    "prn_given", "not_available", "other",
  ]),
  notes: z.string().max(2000).optional().nullable(),
  witness_id: z.string().uuid().optional().nullable(),
  prn_effectiveness: z.string().max(500).optional().nullable(),
  prn_follow_up_time: z.string().optional().nullable(),
});

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

const CreateCarePlanSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  start_date: z.string().optional().nullable(),
  review_date: z.string().optional().nullable(),
  next_review_date: z.string().optional().nullable(),
  domains: z.record(z.string(), z.string()).default({}),
  assessor_name: z.string().max(200).optional().nullable(),
  assessor_role: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

const CreateCareGoalSchema = z.object({
  care_plan_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  ndis_goal_reference: z.string().max(500).optional().nullable(),
  support_category: z.enum(["core", "capacity_building", "capital"]).optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  target_outcome: z.string().max(1000).optional().nullable(),
  priority: z.number().int().min(0).max(3).default(0),
  milestones: z.array(z.object({
    title: z.string(),
    target_date: z.string().optional(),
    achieved: z.boolean().default(false),
  })).default([]),
});

// ── Observations ─────────────────────────────────────────────────────────────

export async function createObservationAction(input: z.infer<typeof CreateObservationSchema>) {
  const parsed = CreateObservationSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const payload = { ...parsed, worker_id: user.id };
  const { data, error } = await (supabase as any)
    .from("health_observations")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Trigger sentinel scan
  try {
    await supabase.functions.invoke("sentinel-scan", {
      body: { trigger_type: "health_observation", record_id: data.id, organization_id: parsed.organization_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath("/dashboard/care/observations");
  return data;
}

export async function fetchObservationsAction(organizationId: string, participantId?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("health_observations")
    .select("*, profiles!health_observations_worker_id_fkey(full_name)")
    .eq("organization_id", organizationId)
    .order("observed_at", { ascending: false })
    .limit(200);

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ── Medications ──────────────────────────────────────────────────────────────

export async function createMedicationAction(input: z.infer<typeof CreateMedicationSchema>) {
  const parsed = CreateMedicationSchema.parse(input);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("participant_medications")
    .insert(parsed)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/medications");
  return data;
}

export async function updateMedicationAction(id: string, updates: Partial<z.infer<typeof CreateMedicationSchema>>) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("participant_medications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/medications");
  return data;
}

export async function recordMARAction(input: z.infer<typeof RecordMARSchema>) {
  const parsed = RecordMARSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await (supabase as any)
    .from("medication_administration_records")
    .insert({ ...parsed, worker_id: user.id, administered_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Trigger sentinel scan for non-compliance detection
  try {
    await supabase.functions.invoke("sentinel-scan", {
      body: { trigger_type: "medication_administration", record_id: data.id, organization_id: parsed.organization_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath("/dashboard/care/medications");
  return data;
}

export async function fetchMedicationsAction(organizationId: string, participantId?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("participant_medications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("medication_name");

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ── Incidents ────────────────────────────────────────────────────────────────

export async function createIncidentAction(input: z.infer<typeof CreateIncidentSchema>) {
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
}

export async function updateIncidentAction(input: z.infer<typeof UpdateIncidentSchema>) {
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
}

export async function fetchIncidentsAction(organizationId: string, filters?: { status?: string; severity?: string; category?: string }) {
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
}

// ── Care Plans ───────────────────────────────────────────────────────────────

export async function createCarePlanAction(input: z.infer<typeof CreateCarePlanSchema>) {
  const parsed = CreateCarePlanSchema.parse(input);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("care_plans")
    .insert(parsed)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plans");
  return data;
}

export async function updateCarePlanAction(id: string, updates: Partial<z.infer<typeof CreateCarePlanSchema>> & { status?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const updatePayload: any = { ...updates };
  if (updates.status === "active" && !updatePayload.approved_by) {
    updatePayload.approved_by = user.id;
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data, error } = await (supabase as any)
    .from("care_plans")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plans");
  return data;
}

export async function fetchCarePlansAction(organizationId: string, participantId?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("care_plans")
    .select("*, care_goals(id, title, status, priority)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ── Care Goals ───────────────────────────────────────────────────────────────

export async function createCareGoalAction(input: z.infer<typeof CreateCareGoalSchema>) {
  const parsed = CreateCareGoalSchema.parse(input);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("care_goals")
    .insert(parsed)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plans");
  return data;
}

export async function updateCareGoalAction(id: string, updates: Partial<z.infer<typeof CreateCareGoalSchema>> & { status?: string }) {
  const supabase = await createServerSupabaseClient();

  const updatePayload: any = { ...updates };
  if (updates.status === "achieved") {
    updatePayload.achieved_at = new Date().toISOString();
  }
  if (updates.status === "in_progress" && !updatePayload.started_at) {
    updatePayload.started_at = new Date().toISOString();
  }

  const { data, error } = await (supabase as any)
    .from("care_goals")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plans");
  return data;
}

// ── Sentinel Alerts ──────────────────────────────────────────────────────────

export async function fetchSentinelAlertsAction(organizationId: string, status?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("sentinel_alerts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["active", "acknowledged", "escalated"]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function acknowledgeSentinelAlertAction(id: string, action: string, notes?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const updates: any = {
    acknowledged_by: user.id,
    acknowledged_at: new Date().toISOString(),
    resolution_action: action,
  };

  if (action === "dismissed_false_positive") {
    updates.status = "dismissed";
    updates.resolved_at = new Date().toISOString();
    updates.resolution_notes = notes;
  } else if (action === "incident_created") {
    updates.status = "resolved";
    updates.resolved_at = new Date().toISOString();
    updates.resolution_notes = notes;
  } else if (action === "escalated_to_clinical") {
    updates.status = "escalated";
    updates.resolution_notes = notes;
  } else {
    updates.status = "acknowledged";
  }

  const { data, error } = await (supabase as any)
    .from("sentinel_alerts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return data;
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
}

export async function fetchAuditSessionsAction(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("audit_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

// ── NDIS Catalogue ───────────────────────────────────────────────────────────

export async function fetchNDISCatalogueAction(search?: string, category?: string) {
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
  return data;
}

// ── Budget ───────────────────────────────────────────────────────────────────

export async function fetchBudgetAllocationsAction(organizationId: string, participantId?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("budget_allocations")
    .select("*, service_agreements(title, start_date, end_date, status)")
    .eq("organization_id", organizationId);

  if (participantId) query = query.eq("participant_id", participantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ── Claims ───────────────────────────────────────────────────────────────────

export async function fetchClaimBatchesAction(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("proda_claim_batches")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchClaimLineItemsAction(organizationId: string, batchId?: string, status?: string) {
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
}

// ── Plan Manager Invoices ────────────────────────────────────────────────────

export async function fetchPlanManagerInvoicesAction(organizationId: string, status?: string) {
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
}

export async function approvePlanManagerInvoiceAction(id: string) {
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
}

export async function rejectPlanManagerInvoiceAction(id: string, reason: string) {
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
}
