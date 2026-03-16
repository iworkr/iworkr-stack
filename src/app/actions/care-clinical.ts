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

const CreateBSPSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  author_name: z.string().max(200).optional().nullable(),
  author_role: z.string().max(100).optional().nullable(),
  start_date: z.string().optional().nullable(),
  review_date: z.string().optional().nullable(),
  next_review_date: z.string().optional().nullable(),
  target_behaviours: z.array(z.unknown()).default([]),
  triggers: z.array(z.unknown()).default([]),
  prevention_strategies: z.array(z.unknown()).default([]),
  response_strategies: z.array(z.unknown()).default([]),
  reinforcement_strategies: z.array(z.unknown()).default([]),
  consent_obtained: z.boolean().default(false),
  consent_date: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

// ── Observations ─────────────────────────────────────────────────────────────

export async function createObservationAction(input: z.infer<typeof CreateObservationSchema>) {
  try {
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
  } catch (e: any) {
    console.error("[care] createObservationAction failed:", e);
    throw e;
  }
}

export async function fetchObservationsAction(organizationId: string, participantId?: string) {
  try {
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
  } catch (e: any) {
    console.error("[care] fetchObservationsAction failed:", e);
    return [];
  }
}

// ── Medications ──────────────────────────────────────────────────────────────

export async function createMedicationAction(input: z.infer<typeof CreateMedicationSchema>) {
  try {
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
  } catch (e: any) {
    console.error("[care] createMedicationAction failed:", e);
    throw e;
  }
}

export async function updateMedicationAction(id: string, updates: Partial<z.infer<typeof CreateMedicationSchema>>) {
  try {
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
  } catch (e: any) {
    console.error("[care] updateMedicationAction failed:", e);
    throw e;
  }
}

export async function recordMARAction(input: z.infer<typeof RecordMARSchema>) {
  try {
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
  } catch (e: any) {
    console.error("[care] recordMARAction failed:", e);
    throw e;
  }
}

export async function fetchMedicationsAction(organizationId: string, participantId?: string) {
  try {
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
  } catch (e: any) {
    console.error("[care] fetchMedicationsAction failed:", e);
    return [];
  }
}

// ── Care Plans ───────────────────────────────────────────────────────────────

export async function createCarePlanAction(input: z.infer<typeof CreateCarePlanSchema>) {
  try {
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
  } catch (e: any) {
    console.error("[care] createCarePlanAction failed:", e);
    throw e;
  }
}

export async function updateCarePlanAction(id: string, updates: Partial<z.infer<typeof CreateCarePlanSchema>> & { status?: string }) {
  try {
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
  } catch (e: any) {
    console.error("[care] updateCarePlanAction failed:", e);
    throw e;
  }
}

export async function fetchCarePlansAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("care_plans")
      .select("*, care_goals(id, title, status, priority), participant_profiles(preferred_name, full_name, clients(name))")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (participantId) {
      query = query.eq("participant_id", participantId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchCarePlansAction failed:", e);
    return [];
  }
}

// ── Care Goals ───────────────────────────────────────────────────────────────

export async function createCareGoalAction(input: z.infer<typeof CreateCareGoalSchema>) {
  try {
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
  } catch (e: any) {
    console.error("[care] createCareGoalAction failed:", e);
    throw e;
  }
}

export async function updateCareGoalAction(id: string, updates: Partial<z.infer<typeof CreateCareGoalSchema>> & { status?: string }) {
  try {
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
  } catch (e: any) {
    console.error("[care] updateCareGoalAction failed:", e);
    throw e;
  }
}

// ── Progress Notes ────────────────────────────────────────────────────────────

export async function createProgressNoteAction(input: {
  organization_id: string;
  participant_id: string;
  job_id?: string;
  note_type: string;
  content: string;
  goals_addressed?: string[];
  risks_identified?: string[];
  follow_up_required?: boolean;
  follow_up_notes?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("progress_notes")
      .insert({ ...input, worker_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Trigger sentinel scan for keyword detection
    try {
      await supabase.functions.invoke("sentinel-scan", {
        body: { trigger_type: "progress_note", record_id: data.id, organization_id: input.organization_id },
      });
    } catch { /* non-blocking */ }

    revalidatePath("/dashboard/care/progress-notes");
    return data;
  } catch (e: any) {
    console.error("[care] createProgressNoteAction failed:", e);
    throw e;
  }
}

export async function fetchProgressNotesAction(organizationId: string, filters?: {
  participant_id?: string;
  note_type?: string;
  follow_up_required?: boolean;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("progress_notes")
      .select("*, profiles!progress_notes_worker_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters?.participant_id) query = query.eq("participant_id", filters.participant_id);
    if (filters?.note_type) query = query.eq("note_type", filters.note_type);
    if (filters?.follow_up_required) query = query.eq("follow_up_required", true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchProgressNotesAction failed:", e);
    return [];
  }
}

// ── Behaviour Support Plans ──────────────────────────────────────────────────

export async function createBSPAction(input: z.infer<typeof CreateBSPSchema>) {
  try {
    const parsed = CreateBSPSchema.parse(input);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("behaviour_support_plans")
      .insert(parsed)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/behaviour");
    return data;
  } catch (e: any) {
    console.error("[care] createBSPAction failed:", e);
    throw e;
  }
}

export async function updateBSPAction(id: string, updates: any) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("behaviour_support_plans")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/care/behaviour");
    return data;
  } catch (e: any) {
    console.error("[care] updateBSPAction failed:", e);
    throw e;
  }
}

export async function fetchBSPsAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("behaviour_support_plans")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (participantId) query = query.eq("participant_id", participantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchBSPsAction failed:", e);
    return [];
  }
}

// ── Behaviour Events ─────────────────────────────────────────────────────────

export async function createBehaviourEventAction(input: {
  organization_id: string;
  participant_id: string;
  bsp_id?: string;
  behaviour_type: string;
  intensity: "low" | "moderate" | "high" | "extreme";
  behaviour_description: string;
  occurred_at: string;
  duration_minutes?: number;
  triggers_identified?: string[];
  antecedent?: string;
  consequence?: string;
  strategies_used?: string[];
  outcome?: string;
  restrictive_practice_used?: boolean;
  notes?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("behaviour_events")
      .insert({ ...input, worker_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Trigger sentinel scan
    try {
      await supabase.functions.invoke("sentinel-scan", {
        body: { trigger_type: "behaviour_event", record_id: data.id, organization_id: input.organization_id },
      });
    } catch { /* non-blocking */ }

    revalidatePath("/dashboard/care/behaviour");
    return data;
  } catch (e: any) {
    console.error("[care] createBehaviourEventAction failed:", e);
    throw e;
  }
}

export async function fetchBehaviourEventsAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("behaviour_events")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (participantId) query = query.eq("participant_id", participantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchBehaviourEventsAction failed:", e);
    return [];
  }
}
