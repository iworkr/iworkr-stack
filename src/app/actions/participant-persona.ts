/**
 * @module ParticipantPersona Server Actions
 * @status COMPLETE
 * @description Participant persona profiles — medical alerts, preferences, communication styles, and personalized care instructions
 * @exports createMedicalAlertAction, fetchMedicalAlertsAction, updatePersonaAction, fetchPersonaAction, deactivateAlertAction
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MedicalAlertSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  alert_type: z.enum(["allergy", "medical_condition", "medication_warning", "custom"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  is_active: z.boolean().optional().default(true),
});

const PreferenceSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  likes: z.array(z.string()).optional().default([]),
  dislikes: z.array(z.string()).optional().default([]),
  hobbies: z.array(z.string()).optional().default([]),
  morning_routine: z.string().optional().nullable(),
  evening_routine: z.string().optional().nullable(),
  communication_primary_method: z.string().optional().nullable(),
  communication_receptive_notes: z.string().optional().nullable(),
  communication_expressive_notes: z.string().optional().nullable(),
  routines_and_comfort: z.string().optional().nullable(),
});

const BehaviorSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  behavior_name: z.string().min(1).max(200),
  known_triggers: z.array(z.string()).optional().default([]),
  early_warning_signs: z.array(z.string()).optional().default([]),
  de_escalation_steps: z.array(z.string()).optional().default([]),
  requires_restrictive_practice: z.boolean().optional().default(false),
  bsp_document_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const GoalSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  ndis_goal_category: z.string().min(1).max(120),
  goal_statement: z.string().min(1).max(3000),
  status: z.enum(["not_started", "in_progress", "achieved", "abandoned"]).optional().default("in_progress"),
  timeframe: z.enum(["short_term", "medium_term", "long_term"]).optional().nullable(),
  action_steps: z.array(z.string()).optional().default([]),
});

const UpdateRequestReviewSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "merged"]),
  review_note: z.string().optional().nullable(),
});

const BriefingAckSchema = z.object({
  organization_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  participant_id: z.string().uuid(),
});

async function getSupabaseWithUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function fetchParticipantPersonaDossierAction(participantId: string) {
  try {
    const { supabase } = await getSupabaseWithUser();
    const { data, error } = await (supabase as any).rpc("fetch_participant_dossier", {
      p_participant_id: participantId,
    });
    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (error) {
    console.error("[participant-persona] fetchParticipantPersonaDossierAction", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function listParticipantMedicalAlertsAction(participantId: string) {
  try {
    const { supabase } = await getSupabaseWithUser();
    const { data, error } = await (supabase as any)
      .from("participant_medical_alerts")
      .select("*")
      .eq("participant_id", participantId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[participant-persona] listParticipantMedicalAlertsAction", error);
    return [];
  }
}

export async function createParticipantMedicalAlertAction(input: z.infer<typeof MedicalAlertSchema>) {
  const payload = MedicalAlertSchema.parse(input);
  const { supabase, user } = await getSupabaseWithUser();
  const { data, error } = await (supabase as any)
    .from("participant_medical_alerts")
    .insert({
      ...payload,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}`);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}/persona`);
  return data;
}

export async function updateMedicalAlertStatusAction(alertId: string, isActive: boolean) {
  const { supabase } = await getSupabaseWithUser();
  const { error } = await (supabase as any)
    .from("participant_medical_alerts")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) throw new Error(error.message);
}

export async function upsertParticipantPreferencesAction(input: z.infer<typeof PreferenceSchema>) {
  const payload = PreferenceSchema.parse(input);
  const { supabase } = await getSupabaseWithUser();
  const { data, error } = await (supabase as any)
    .from("participant_preferences")
    .upsert(payload, { onConflict: "participant_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}`);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}/persona`);
  return data;
}

export async function listParticipantBehaviorsAction(participantId: string) {
  try {
    const { supabase } = await getSupabaseWithUser();
    const { data, error } = await (supabase as any)
      .from("participant_behaviors")
      .select("*")
      .eq("participant_id", participantId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[participant-persona] listParticipantBehaviorsAction", error);
    return [];
  }
}

export async function createParticipantBehaviorAction(input: z.infer<typeof BehaviorSchema>) {
  const payload = BehaviorSchema.parse(input);
  const { supabase } = await getSupabaseWithUser();
  const { data, error } = await (supabase as any)
    .from("participant_behaviors")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}`);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}/persona`);
  return data;
}

export async function listParticipantGoalsAction(participantId: string) {
  try {
    const { supabase } = await getSupabaseWithUser();
    const { data, error } = await (supabase as any)
      .from("participant_goals")
      .select("*")
      .eq("participant_id", participantId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[participant-persona] listParticipantGoalsAction", error);
    return [];
  }
}

export async function createParticipantGoalAction(input: z.infer<typeof GoalSchema>) {
  const payload = GoalSchema.parse(input);
  const { supabase } = await getSupabaseWithUser();
  const { data, error } = await (supabase as any)
    .from("participant_goals")
    .insert({
      ...payload,
      action_steps: payload.action_steps,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}`);
  revalidatePath(`/dashboard/care/participants/${payload.participant_id}/persona`);
  return data;
}

export async function listProfileUpdateRequestsAction(participantId: string) {
  try {
    const { supabase } = await getSupabaseWithUser();
    const { data, error } = await (supabase as any)
      .from("participant_profile_update_requests")
      .select("*, profiles!participant_profile_update_requests_requested_by_user_id_fkey(full_name)")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[participant-persona] listProfileUpdateRequestsAction", error);
    return [];
  }
}

export async function reviewProfileUpdateRequestAction(input: z.infer<typeof UpdateRequestReviewSchema>) {
  const payload = UpdateRequestReviewSchema.parse(input);
  const { supabase, user } = await getSupabaseWithUser();
  const { data, error } = await (supabase as any)
    .from("participant_profile_update_requests")
    .update({
      status: payload.status,
      review_note: payload.review_note ?? null,
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.request_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function acknowledgeParticipantBriefingAction(input: z.infer<typeof BriefingAckSchema>) {
  const payload = BriefingAckSchema.parse(input);
  const { supabase, user } = await getSupabaseWithUser();
  const { error } = await (supabase as any).from("worker_profile_acknowledgments").upsert({
    organization_id: payload.organization_id,
    shift_id: payload.shift_id,
    participant_id: payload.participant_id,
    worker_id: user.id,
    acknowledged_at: new Date().toISOString(),
  }, { onConflict: "shift_id,worker_id" });
  if (error) throw new Error(error.message);
  return { success: true };
}

