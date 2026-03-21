"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ───────────────────────────────────────────────── */

export interface ClinicalSkill {
  id: string;
  name: string;
  category: string;
}

export interface CareBlueprint {
  id: string;
  organization_id: string;
  participant_id: string;
  coverage_type: "standard_hourly" | "24_7_continuous" | "active_night" | "sleepover";
  staffing_ratio: number;
  required_skills: string[];
  gender_preference: "no_preference" | "male_only" | "female_only";
  banned_workers: string[];
  shift_pattern: Array<{ label: string; start: string; end: string }>;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RosterShellResult {
  success: boolean;
  blueprint_id: string;
  total_shifts_created: number;
  date_range_start: string;
  date_range_end: string;
  participant_name: string;
}

export interface SmartMatchResult {
  success: boolean;
  total_unfilled: number;
  filled: number;
  remaining_unfilled: number;
  assignments: Array<{ shift_id: string; worker_id: string; worker_name: string }>;
  error?: string;
  message?: string;
}

export interface BlueprintShift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  shift_group_id: string;
  target_ratio: number;
  technician_id: string | null;
  worker_name?: string;
}

/* ── Fetch Clinical Skills ───────────────────────────────── */

export async function fetchClinicalSkills(orgId: string): Promise<ClinicalSkill[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("clinical_skills")
    .select("id, name, category")
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order("category")
    .order("name");
  if (error) return [];
  return data || [];
}

/* ── Create Care Blueprint ───────────────────────────────── */

export async function createCareBlueprint(payload: {
  organization_id: string;
  participant_id: string;
  coverage_type: string;
  staffing_ratio: number;
  required_skills: string[];
  gender_preference: string;
  shift_pattern: Array<{ label: string; start: string; end: string }>;
  notes?: string;
}): Promise<{ success: boolean; blueprint?: CareBlueprint; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("care_blueprints")
    .insert({
      organization_id: payload.organization_id,
      participant_id: payload.participant_id,
      coverage_type: payload.coverage_type,
      staffing_ratio: payload.staffing_ratio,
      required_skills: payload.required_skills,
      gender_preference: payload.gender_preference,
      shift_pattern: payload.shift_pattern,
      notes: payload.notes || null,
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, blueprint: data };
}

/* ── Fetch Blueprint for Participant ─────────────────────── */

export async function fetchBlueprintForParticipant(
  participantId: string,
  orgId: string,
): Promise<CareBlueprint | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("care_blueprints")
    .select("*")
    .eq("participant_id", participantId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  return data || null;
}

/* ── Generate Roster Shell ───────────────────────────────── */

export async function generateRosterShell(
  blueprintId: string,
  weeks: number = 4,
): Promise<RosterShellResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("rpc_generate_roster_shell", {
    p_blueprint_id: blueprintId,
    p_weeks: weeks,
  });

  if (error) throw new Error(error.message);
  return data as RosterShellResult;
}

/* ── Trigger Smart Match ─────────────────────────────────── */

export async function triggerSmartMatch(blueprintId: string): Promise<SmartMatchResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).functions.invoke("smart-roster-match", {
    body: { blueprint_id: blueprintId },
  });

  if (error) return { success: false, total_unfilled: 0, filled: 0, remaining_unfilled: 0, assignments: [], error: error.message };
  return data as SmartMatchResult;
}

/* ── Fetch Blueprint Shifts (for dispatch view) ──────────── */

export async function fetchBlueprintShifts(
  blueprintId: string,
  orgId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<BlueprintShift[]> {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("schedule_blocks")
    .select("id, title, start_time, end_time, status, shift_group_id, target_ratio, technician_id, profiles:technician_id(full_name)")
    .eq("blueprint_id", blueprintId)
    .eq("organization_id", orgId)
    .order("start_time", { ascending: true });

  if (dateFrom) query = query.gte("start_time", dateFrom);
  if (dateTo) query = query.lte("start_time", dateTo);

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map((s: any) => ({
    ...s,
    worker_name: s.profiles?.full_name || null,
    profiles: undefined,
  }));
}

/* ── Fetch Unfilled Shift Count ──────────────────────────── */

export async function fetchUnfilledShiftCount(
  blueprintId: string,
): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await (supabase as any)
    .from("schedule_blocks")
    .select("id", { count: "exact", head: true })
    .eq("blueprint_id", blueprintId)
    .eq("status", "unfilled");
  if (error) return 0;
  return count || 0;
}

/* ── Validate Worker Assignment (skill check) ────────────── */

export async function validateWorkerAssignment(
  workerId: string,
  shiftId: string,
  orgId: string,
): Promise<{ valid: boolean; missing_skills: string[] }> {
  const supabase = await createServerSupabaseClient();

  // Get shift's blueprint
  const { data: shift } = await (supabase as any)
    .from("schedule_blocks")
    .select("blueprint_id")
    .eq("id", shiftId)
    .single();

  if (!shift?.blueprint_id) return { valid: true, missing_skills: [] };

  // Get blueprint required skills
  const { data: blueprint } = await (supabase as any)
    .from("care_blueprints")
    .select("required_skills")
    .eq("id", shift.blueprint_id)
    .single();

  if (!blueprint?.required_skills?.length) return { valid: true, missing_skills: [] };

  // Get worker skills
  const { data: workerSkills } = await (supabase as any)
    .from("worker_clinical_skills")
    .select("skill_id")
    .eq("user_id", workerId)
    .eq("organization_id", orgId);

  const workerSkillIds = (workerSkills || []).map((ws: any) => ws.skill_id);
  const missingIds = blueprint.required_skills.filter(
    (s: string) => !workerSkillIds.includes(s),
  );

  if (missingIds.length === 0) return { valid: true, missing_skills: [] };

  // Resolve skill names
  const { data: missingSkills } = await (supabase as any)
    .from("clinical_skills")
    .select("name")
    .in("id", missingIds);

  return {
    valid: false,
    missing_skills: (missingSkills || []).map((s: any) => s.name),
  };
}

/* ── Assign Worker to Shift ──────────────────────────────── */

export async function assignWorkerToShift(
  shiftId: string,
  workerId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("schedule_blocks")
    .update({ technician_id: workerId, status: "published" })
    .eq("id", shiftId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
