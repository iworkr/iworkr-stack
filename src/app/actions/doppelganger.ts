"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const AttachShadowSchema = z.object({
  parent_shift_id: z.string().uuid(),
  trainee_worker_id: z.string().uuid(),
});

const MentorEvaluationSchema = z.object({
  primary_shift_id: z.string().uuid(),
  shadow_shift_id: z.string().uuid(),
  recommendation_status: z.enum(["pass", "fail", "needs_more_training"]),
  evaluation_data: z.record(z.string(), z.unknown()),
});

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listShadowEligibleWorkersAction(organizationId: string, participantId?: string | null) {
  const { supabase } = await requireUser();
  const { data: members, error } = await (supabase as any)
    .from("organization_members")
    .select("user_id, role, profiles:user_id(id, full_name)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const workerIds = (members || []).map((m: any) => m.user_id);
  let familiarityMap = new Map<string, any>();
  if (participantId && workerIds.length > 0) {
    const { data: fam } = await (supabase as any)
      .from("worker_participant_familiarity")
      .select("worker_id, shadow_shifts_completed, shadow_shifts_required, is_cleared_for_independent")
      .eq("organization_id", organizationId)
      .eq("participant_id", participantId)
      .in("worker_id", workerIds);
    familiarityMap = new Map((fam || []).map((f: any) => [f.worker_id, f]));
  }

  return (members || []).map((m: any) => {
    const fam = familiarityMap.get(m.user_id);
    return {
      id: m.user_id,
      name: m.profiles?.full_name || "Unknown",
      role: m.role,
      familiarity: fam || null,
      rank: fam
        ? fam.is_cleared_for_independent
          ? 3
          : Number(fam.shadow_shifts_completed || 0)
        : 0,
    };
  });
}

export async function attachShadowWorkerAction(input: z.infer<typeof AttachShadowSchema>) {
  const payload = AttachShadowSchema.parse(input);
  const { supabase } = await requireUser();

  const { data: parent, error: parentErr } = await (supabase as any)
    .from("schedule_blocks")
    .select("*")
    .eq("id", payload.parent_shift_id)
    .single();
  if (parentErr) throw new Error(parentErr.message);
  if (parent.is_shadow_shift) throw new Error("Cannot attach a shadow to another shadow shift.");

  const { data: existingChild } = await (supabase as any)
    .from("schedule_blocks")
    .select("id")
    .eq("parent_shift_id", payload.parent_shift_id)
    .eq("is_shadow_shift", true)
    .maybeSingle();
  if (existingChild) throw new Error("This shift already has an attached shadow.");

  const { data: booking } = await (supabase as any)
    .from("vehicle_bookings")
    .select("id, vehicle_id, fleet_vehicles(seating_capacity)")
    .eq("shift_id", parent.id)
    .in("status", ["scheduled", "checked_out"])
    .maybeSingle();
  if (booking) {
    const seats = Number(booking.fleet_vehicles?.seating_capacity || 0);
    if (seats > 0 && seats < 3) {
      throw new Error("Cannot attach shadow: linked vehicle does not have seating capacity for trainee + mentor + participant.");
    }
  }

  const childMetadata = {
    ...(parent.metadata || {}),
    is_shadow_shift: true,
    training_mode: true,
    billable_override: "suppressed",
  };

  const { data: child, error: childErr } = await (supabase as any)
    .from("schedule_blocks")
    .insert({
      organization_id: parent.organization_id,
      job_id: parent.job_id,
      technician_id: payload.trainee_worker_id,
      participant_id: parent.participant_id,
      title: `${parent.title} (Shadow)`,
      client_name: parent.client_name,
      location: parent.location,
      start_time: parent.start_time,
      end_time: parent.end_time,
      status: parent.status === "cancelled" ? "cancelled" : "scheduled",
      notes: parent.notes,
      metadata: childMetadata,
      parent_shift_id: parent.id,
      is_shadow_shift: true,
    })
    .select("*")
    .single();
  if (childErr) throw new Error(childErr.message);

  await (supabase as any).from("worker_participant_familiarity").upsert(
    {
      worker_id: payload.trainee_worker_id,
      organization_id: parent.organization_id,
      participant_id: parent.participant_id,
    },
    { onConflict: "worker_id,participant_id" },
  );

  await (supabase as any).from("shift_financial_ledgers").upsert(
    {
      schedule_block_id: child.id,
      organization_id: parent.organization_id,
      worker_id: payload.trainee_worker_id,
      participant_id: parent.participant_id,
      projected_cost: 0,
      projected_revenue: 0,
      projected_margin: 0,
      is_billable_to_ndis: false,
      payroll_gl_account: "Expense - Staff Training & Onboarding",
    },
    { onConflict: "schedule_block_id" },
  );

  revalidatePath("/dashboard/schedule");
  return child;
}

export async function submitMentorEvaluationAction(input: z.infer<typeof MentorEvaluationSchema>) {
  const payload = MentorEvaluationSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: pair, error: pairErr } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, organization_id, participant_id, technician_id, parent_shift_id, is_shadow_shift")
    .in("id", [payload.primary_shift_id, payload.shadow_shift_id]);
  if (pairErr) throw new Error(pairErr.message);
  const primary = (pair || []).find((r: any) => r.id === payload.primary_shift_id);
  const shadow = (pair || []).find((r: any) => r.id === payload.shadow_shift_id);
  if (!primary || !shadow) throw new Error("Invalid mentor/shadow pair.");
  if (!shadow.is_shadow_shift || shadow.parent_shift_id !== primary.id) {
    throw new Error("Provided shadow shift is not attached to the primary shift.");
  }

  const { data, error } = await (supabase as any)
    .from("mentorship_evaluations")
    .upsert(
      {
        organization_id: primary.organization_id,
        primary_shift_id: primary.id,
        shadow_shift_id: shadow.id,
        evaluator_worker_id: user.id,
        trainee_worker_id: shadow.technician_id,
        participant_id: primary.participant_id,
        evaluation_data: payload.evaluation_data,
        recommendation_status: payload.recommendation_status,
      },
      { onConflict: "primary_shift_id,shadow_shift_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
  return data;
}

export async function getShadowClockOutGateAction(shiftId: string) {
  const { supabase } = await requireUser();
  const { data: shift, error } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, organization_id, participant_id, technician_id, is_shadow_shift")
    .eq("id", shiftId)
    .single();
  if (error) throw new Error(error.message);

  if (shift.is_shadow_shift) {
    return { can_clock_out: true, reason: null, mode: "shadow_reflection" };
  }

  const { data: child } = await (supabase as any)
    .from("schedule_blocks")
    .select("id")
    .eq("parent_shift_id", shift.id)
    .eq("is_shadow_shift", true)
    .maybeSingle();
  if (!child) return { can_clock_out: true, reason: null, mode: "standard" };

  const { data: evalRow } = await (supabase as any)
    .from("mentorship_evaluations")
    .select("id")
    .eq("primary_shift_id", shift.id)
    .eq("shadow_shift_id", child.id)
    .maybeSingle();

  return {
    can_clock_out: !!evalRow,
    reason: evalRow ? null : "Mentor evaluation required before clock-out.",
    shadow_shift_id: child.id,
    mode: "mentor_evaluation_required",
  };
}

export async function getWorkerParticipantTrainingMatrixAction(workerId: string, organizationId: string) {
  const { supabase } = await requireUser();
  const { data: rows, error } = await (supabase as any)
    .from("worker_participant_familiarity")
    .select("participant_id, shadow_shifts_completed, shadow_shifts_required, is_cleared_for_independent, cleared_at, participant_profiles(preferred_name)")
    .eq("worker_id", workerId)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (rows || []).map((r: any) => ({
    participant_id: r.participant_id,
    participant_name: r.participant_profiles?.preferred_name || "Participant",
    completed: Number(r.shadow_shifts_completed || 0),
    required: Number(r.shadow_shifts_required || 3),
    is_cleared_for_independent: !!r.is_cleared_for_independent,
    cleared_at: r.cleared_at,
  }));
}

export async function fastTrackClearWorkerForParticipantAction(input: {
  organization_id: string;
  worker_id: string;
  participant_id: string;
}) {
  const { supabase, user } = await requireUser();
  const { error } = await (supabase as any).from("worker_participant_familiarity").upsert(
    {
      organization_id: input.organization_id,
      worker_id: input.worker_id,
      participant_id: input.participant_id,
      is_cleared_for_independent: true,
      cleared_at: new Date().toISOString(),
      cleared_by_user_id: user.id,
      shadow_shifts_completed: 3,
    },
    { onConflict: "worker_id,participant_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/team/${input.worker_id}/training`);
  return { success: true };
}
