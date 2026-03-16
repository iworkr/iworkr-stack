"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CreateFacilitySchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2).max(200),
  max_capacity: z.number().int().positive().optional(),
  address: z.record(z.string(), z.unknown()).optional(),
});

const CreateTaskTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  target_type: z.enum(["participant", "facility", "global"]),
  participant_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  title: z.string().min(2).max(300),
  description: z.string().max(5000).optional(),
  task_type: z.enum(["checkbox", "number_input", "photo_required", "form_trigger"]),
  linked_form_template_id: z.string().uuid().optional(),
  is_mandatory: z.boolean().optional().default(false),
  is_critical: z.boolean().optional().default(false),
  visible_to_family: z.boolean().optional().default(false),
  schedule_cron: z.string().min(3).max(100),
  time_of_day: z.string().optional(),
  trigger_mode: z.enum(["calendar", "per_shift"]).optional().default("calendar"),
});

const CompleteTaskSchema = z.object({
  task_instance_id: z.string().uuid(),
  evidence_data: z.record(z.string(), z.unknown()).optional(),
});

const ExemptTaskSchema = z.object({
  task_instance_id: z.string().uuid(),
  reason: z.enum([
    "participant_refused",
    "equipment_broken",
    "not_enough_time_unsafe",
    "other",
  ]),
  note: z.string().max(2000).optional(),
});

const AdHocTaskSchema = z.object({
  organization_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  title: z.string().min(2).max(300),
  facility_id: z.string().uuid().optional(),
  participant_id: z.string().uuid().optional(),
  task_type: z.enum(["checkbox", "number_input", "photo_required", "form_trigger"]).optional(),
});

async function requireAuthedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listCareFacilitiesAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("care_facilities")
      .select("*, participant_profiles(count)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[choreography] listCareFacilitiesAction", error);
    return [];
  }
}

export async function createCareFacilityAction(input: z.infer<typeof CreateFacilitySchema>) {
  const parsed = CreateFacilitySchema.parse(input);
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("care_facilities")
    .insert({
      organization_id: parsed.organization_id,
      name: parsed.name,
      max_capacity: parsed.max_capacity ?? null,
      address: parsed.address ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/facilities");
  revalidatePath("/dashboard/care/daily-ops");
  return data;
}

export async function linkParticipantToFacilityAction(input: {
  participant_id: string;
  facility_id: string | null;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("participant_profiles")
    .update({ facility_id: input.facility_id })
    .eq("id", input.participant_id)
    .select("id, facility_id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/facilities");
  return data;
}

export async function listFacilityParticipantsAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("participant_profiles")
      .select("id, preferred_name, facility_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[choreography] listFacilityParticipantsAction", error);
    return [];
  }
}

export async function listRoutineTemplatesAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("task_templates")
      .select(
        "*, care_facilities(name), participant_profiles(preferred_name), shift_note_templates(name, version)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[choreography] listRoutineTemplatesAction", error);
    return [];
  }
}

export async function createRoutineTemplateAction(input: z.infer<typeof CreateTaskTemplateSchema>) {
  const parsed = CreateTaskTemplateSchema.parse(input);
  const { supabase, user } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("task_templates")
    .insert({
      ...parsed,
      participant_id: parsed.participant_id ?? null,
      facility_id: parsed.facility_id ?? null,
      description: parsed.description ?? null,
      linked_form_template_id: parsed.linked_form_template_id ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/routines");
  revalidatePath("/dashboard/care/daily-ops");
  return data;
}

export async function triggerDailyTaskGenerationAction(input: {
  target_date?: string;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("generate_daily_tasks", {
    p_target_date: input.target_date ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/daily-ops");
  return Number(data || 0);
}

export async function listFacilityDailyOpsAction(input: {
  organization_id: string;
  target_date: string;
}) {
  try {
    const { supabase } = await requireAuthedUser();
    const [{ data: facilities, error: facilitiesError }, { data: rows, error: rowsError }] =
      await Promise.all([
        (supabase as any)
          .from("care_facilities")
          .select("id, name")
          .eq("organization_id", input.organization_id),
        (supabase as any)
          .from("task_instances")
          .select("id, facility_id, status, is_critical, completed_by_user_id")
          .eq("organization_id", input.organization_id)
          .eq("target_date", input.target_date),
      ]);
    if (facilitiesError) throw new Error(facilitiesError.message);
    if (rowsError) throw new Error(rowsError.message);

    const byFacility = new Map<string, any[]>();
    for (const row of rows || []) {
      const facilityId = row.facility_id || "unscoped";
      const current = byFacility.get(facilityId) || [];
      current.push(row);
      byFacility.set(facilityId, current);
    }

    return (facilities || []).map((facility: any) => {
      const items = byFacility.get(facility.id) || [];
      const total = items.length;
      const completed = items.filter((x) => x.status === "completed" || x.status === "exempted").length;
      const criticalPending = items.filter((x) => x.is_critical && x.status === "pending").length;
      return {
        facility_id: facility.id,
        facility_name: facility.name,
        total,
        completed,
        completion_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
        critical_pending: criticalPending,
      };
    });
  } catch (error) {
    console.error("[choreography] listFacilityDailyOpsAction", error);
    return [];
  }
}

export async function listTaskInstancesForDateAction(input: {
  organization_id: string;
  target_date: string;
  facility_id?: string;
}) {
  try {
    const { supabase } = await requireAuthedUser();
    let query = (supabase as any)
      .from("task_instances")
      .select(
        "*, care_facilities(name), participant_profiles(preferred_name), profiles!task_instances_completed_by_user_id_fkey(full_name, email)",
      )
      .eq("organization_id", input.organization_id)
      .eq("target_date", input.target_date)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (input.facility_id) {
      query = query.eq("facility_id", input.facility_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[choreography] listTaskInstancesForDateAction", error);
    return [];
  }
}

export async function listShiftTaskInstancesAction(input: {
  organization_id: string;
  shift_id: string;
}) {
  const { supabase } = await requireAuthedUser();
  const { data: shift, error: shiftError } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, organization_id, participant_id, facility_id, start_time, technician_id")
    .eq("id", input.shift_id)
    .eq("organization_id", input.organization_id)
    .single();
  if (shiftError) throw new Error(shiftError.message);

  const targetDate = String(shift.start_time).slice(0, 10);
  const { data, error } = await (supabase as any)
    .from("task_instances")
    .select("*")
    .eq("organization_id", input.organization_id)
    .eq("target_date", targetDate)
    .or(
      [
        `shift_id.eq.${shift.id}`,
        shift.participant_id ? `participant_id.eq.${shift.participant_id}` : null,
        shift.facility_id ? `facility_id.eq.${shift.facility_id}` : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .order("scheduled_for_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { shift, tasks: data ?? [] };
}

export async function completeTaskInstanceAction(input: z.infer<typeof CompleteTaskSchema>) {
  const parsed = CompleteTaskSchema.parse(input);
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("complete_task_instance", {
    p_task_instance_id: parsed.task_instance_id,
    p_evidence_data: parsed.evidence_data ?? {},
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/daily-ops");
  return data;
}

export async function exemptTaskInstanceAction(input: z.infer<typeof ExemptTaskSchema>) {
  const parsed = ExemptTaskSchema.parse(input);
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("exempt_task_instance", {
    p_task_instance_id: parsed.task_instance_id,
    p_reason: parsed.reason,
    p_note: parsed.note ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/daily-ops");
  return data;
}

export async function createAdHocTaskInstanceAction(input: z.infer<typeof AdHocTaskSchema>) {
  const parsed = AdHocTaskSchema.parse(input);
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("create_ad_hoc_task_instance", {
    p_organization_id: parsed.organization_id,
    p_shift_id: parsed.shift_id,
    p_title: parsed.title,
    p_facility_id: parsed.facility_id ?? null,
    p_participant_id: parsed.participant_id ?? null,
    p_task_type: parsed.task_type ?? "checkbox",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/daily-ops");
  return data;
}

export async function getShiftTaskGateStatusAction(shiftId: string) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("get_shift_mandatory_task_gate", {
    p_shift_id: shiftId,
  });
  if (error) throw new Error(error.message);
  return data as {
    can_clock_out: boolean;
    pending_mandatory_count: number;
    pending_task_ids: string[];
  };
}

export async function listFacilityCleaningLogAction(input: {
  organization_id: string;
  facility_id: string;
  start_date: string;
  end_date: string;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("task_instances")
    .select("*, profiles!task_instances_completed_by_user_id_fkey(full_name, email)")
    .eq("organization_id", input.organization_id)
    .eq("facility_id", input.facility_id)
    .gte("target_date", input.start_date)
    .lte("target_date", input.end_date)
    .order("target_date", { ascending: true })
    .order("completed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
