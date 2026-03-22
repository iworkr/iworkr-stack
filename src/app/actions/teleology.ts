/**
 * @module Teleology Server Actions
 * @status COMPLETE
 * @description NDIS goal tracking — goal CRUD, progress milestones, outcome measurement, and domain-based goal categorization
 * @exports createGoalAction, fetchGoalsAction, updateGoalProgressAction, archiveGoalAction, fetchGoalOutcomesAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type GoalDomain =
  | "DAILY_LIVING"
  | "SOCIAL_COMMUNITY"
  | "HEALTH_WELLBEING"
  | "EMPLOYMENT"
  | "LIFELONG_LEARNING"
  | "HOME_LIVING"
  | "CHOICE_CONTROL";

export type GoalStatus = "ACTIVE" | "ACHIEVED" | "STAGNANT" | "ARCHIVED";
export type ProgressRating = "REGRESSED" | "MAINTAINED" | "PROGRESSED";

export interface GoalMatrixRow {
  goal_id: string;
  participant_id: string;
  participant_name: string;
  title: string;
  domain: GoalDomain;
  goal_status: GoalStatus;
  start_date: string | null;
  end_date: string | null;
  observation_count: number;
  observations_30d: number;
  is_stagnant: boolean;
  last_observation_at: string | null;
  trajectory: Array<{ ts: string; rating: number }>;
}

export interface EvidenceFeedItem {
  linkage_id: string;
  progress_rating: ProgressRating;
  worker_observation: string | null;
  created_at: string;
  worker_name: string;
  worker_avatar_url: string | null;
  shift_date: string;
}

export interface GoalTelemetry {
  active_goals: number;
  observations_30d: number;
  stagnant_goals: number;
  upcoming_reviews: number;
}

export interface GoalMatrixData {
  telemetry: GoalTelemetry;
  goals: GoalMatrixRow[];
}

export async function getGoalMatrix(
  orgId: string,
  participantId?: string
): Promise<{ data: GoalMatrixData | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const [telemetryRes, matrixRes] = await Promise.all([
    (supabase as any).rpc("get_goal_matrix_telemetry", {
      p_organization_id: orgId,
    }),
    (supabase as any).rpc("get_goal_matrix_for_org", {
      p_organization_id: orgId,
      p_participant_id: participantId ?? null,
    }),
  ]);

  if (telemetryRes.error) return { data: null, error: telemetryRes.error.message };
  if (matrixRes.error) return { data: null, error: matrixRes.error.message };

  return {
    data: {
      telemetry: telemetryRes.data as GoalTelemetry,
      goals: (matrixRes.data as GoalMatrixRow[]) ?? [],
    },
    error: null,
  };
}

export async function getGoalEvidenceFeed(
  goalId: string,
  orgId: string,
  limit = 50,
  offset = 0
): Promise<{ data: EvidenceFeedItem[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_goal_evidence_feed", {
    p_goal_id: goalId,
    p_organization_id: orgId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as EvidenceFeedItem[], error: null };
}

export async function createParticipantGoal(
  orgId: string,
  payload: {
    participant_id: string;
    title: string;
    description?: string;
    domain: GoalDomain;
    start_date?: string;
    end_date?: string;
  }
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("participant_goals")
    .insert({
      organization_id: orgId,
      participant_id: payload.participant_id,
      title: payload.title,
      description: payload.description ?? null,
      domain: payload.domain,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      goal_status: "ACTIVE",
    });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/clinical/goals");
  return { error: null };
}

export async function updateGoalStatus(
  orgId: string,
  goalId: string,
  status: GoalStatus
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("participant_goals")
    .update({ goal_status: status })
    .eq("id", goalId)
    .eq("organization_id", orgId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/clinical/goals");
  return { error: null };
}

export async function getPlanReportData(
  orgId: string,
  participantId: string,
  fromDate: string,
  toDate: string
): Promise<{ data: any | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_plan_report_data", {
    p_organization_id: orgId,
    p_participant_id: participantId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getParticipantsForOrg(
  orgId: string
): Promise<{ data: Array<{ id: string; name: string }> | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("participant_profiles")
    .select("id, preferred_name, profiles(full_name, email)")
    .eq("organization_id", orgId)
    .limit(100);
  if (error) return { data: null, error: error.message };
  return {
    data: (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.preferred_name ?? p.profiles?.full_name ?? p.profiles?.email ?? "Unknown",
    })),
    error: null,
  };
}
