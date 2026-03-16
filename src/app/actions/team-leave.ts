"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CreateLeaveRequestSchema = z.object({
  organization_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  leave_type: z.enum(["annual", "sick", "rdo", "unpaid", "compassionate"]),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  is_full_day: z.boolean().default(true),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  reason: z.string().max(2000).optional(),
  medical_cert_url: z.string().url().optional(),
  source: z.enum(["manual", "mobile", "emergency_sick"]).optional(),
  emergency_reported: z.boolean().optional(),
});

const ReviewLeaveRequestSchema = z.object({
  leave_request_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "cancelled"]),
  manager_notes: z.string().max(2000).optional(),
});

async function requireAuthedUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listLeaveRequestsAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("leave_requests")
      .select(`
        *,
        worker:profiles!leave_requests_worker_id_fkey(id, full_name, email),
        balance:leave_balances_cache!leave_balances_cache_worker_id_fkey(worker_id, annual_leave_hours, sick_leave_hours, last_synced_at)
      `)
      .eq("organization_id", organizationId)
      .order("emergency_reported", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[equinox] listLeaveRequestsAction", error);
    return [];
  }
}

export async function listLeaveWorkersAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("organization_members")
      .select("user_id, role, status, profiles(full_name, email)")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({
      id: row.user_id as string,
      name: row.profiles?.full_name || row.profiles?.email || "Worker",
      role: row.role as string,
    }));
  } catch (error) {
    console.error("[equinox] listLeaveWorkersAction", error);
    return [];
  }
}

export async function createLeaveRequestAction(input: z.infer<typeof CreateLeaveRequestSchema>) {
  const parsed = CreateLeaveRequestSchema.parse(input);
  const { supabase } = await requireAuthedUser();

  const startDate = new Date(parsed.start_date);
  const endDate = new Date(parsed.end_date);
  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const { data, error } = await (supabase as any)
    .from("leave_requests")
    .insert({
      ...parsed,
      source: parsed.source ?? "manual",
      emergency_reported: parsed.emergency_reported ?? false,
      days,
      start_at: parsed.start_at ?? `${parsed.start_date}T00:00:00.000Z`,
      end_at: parsed.end_at ?? `${parsed.end_date}T23:59:59.999Z`,
      status: (parsed.source ?? "manual") === "emergency_sick" ? "approved" : "pending",
      approved_at: (parsed.source ?? "manual") === "emergency_sick" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/team/leave");
  revalidatePath("/dashboard/schedule");
  return data;
}

export async function reportEmergencySickAction(input: {
  organization_id: string;
  worker_id?: string;
  reason?: string;
}) {
  const { supabase, user } = await requireAuthedUser();
  const workerId = input.worker_id || user.id;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await (supabase as any)
    .from("leave_requests")
    .insert({
      organization_id: input.organization_id,
      worker_id: workerId,
      user_id: workerId,
      leave_type: "sick",
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      is_full_day: true,
      days: 1,
      reason: input.reason || "Emergency sick call",
      source: "emergency_sick",
      emergency_reported: true,
      status: "approved",
      approved_at: now.toISOString(),
      approved_by: workerId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const dropRes = await (supabase as any).rpc("execute_drop_and_cover_leave", {
    p_leave_request_id: data.id,
  });

  await supabase.functions.invoke("send-push", {
    body: {
      record: {
        user_id: workerId,
        title: "Rest mode activated",
        body: "Your emergency sick report has been logged. Today’s shifts are now in cover search.",
        type: "leave_emergency_ack",
      },
    },
  });

  revalidatePath("/dashboard/team/leave");
  revalidatePath("/dashboard/schedule");
  return {
    leave_request: data,
    drop_cover_result: dropRes?.data ?? null,
  };
}

export async function calculateLeaveImpactAction(input: {
  worker_id: string;
  start_at: string;
  end_at: string;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("calculate_leave_impact", {
    p_worker_id: input.worker_id,
    p_start_date: input.start_at,
    p_end_date: input.end_at,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reviewLeaveRequestAction(input: z.infer<typeof ReviewLeaveRequestSchema>) {
  const parsed = ReviewLeaveRequestSchema.parse(input);
  const { supabase, user } = await requireAuthedUser();

  const updates: Record<string, any> = {
    status: parsed.status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    manager_notes: parsed.manager_notes ?? null,
  };
  if (parsed.status === "approved") {
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await (supabase as any)
    .from("leave_requests")
    .update(updates)
    .eq("id", parsed.leave_request_id)
    .eq("organization_id", parsed.organization_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (parsed.status === "approved") {
    await (supabase as any).rpc("execute_drop_and_cover_leave", {
      p_leave_request_id: parsed.leave_request_id,
    });
  }

  revalidatePath("/dashboard/team/leave");
  revalidatePath("/dashboard/schedule");
  return data;
}

export async function triggerLeaveShadowInjectionAction(input: {
  organization_id: string;
  period_start: string;
  period_end: string;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any).rpc("inject_leave_shadow_entries", {
    p_organization_id: input.organization_id,
    p_period_start: input.period_start,
    p_period_end: input.period_end,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return { inserted: Number(data || 0) };
}

// ── Telemetry & Triage (Project Aegis-Leave) ────────────────────────────────

export async function getLeaveTriageDataAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("leave_requests")
      .select(`
        *,
        worker:profiles!leave_requests_worker_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq("organization_id", organizationId)
      .order("emergency_reported", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[aegis-leave] getLeaveTriageDataAction", error);
    return [];
  }
}

export async function getLeaveTelemetryAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();

    // Get pending requests
    const { data: pending } = await (supabase as any)
      .from("leave_requests")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    // Calculate impact for all pending leave requests
    const { data: impactData } = await (supabase as any)
      .from("leave_requests")
      .select("id, worker_id, start_at, end_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    let totalImpactedShifts = 0;
    let totalParticipants = 0;
    let totalRevenue = 0;

    if (impactData && impactData.length > 0) {
      for (const req of impactData) {
        try {
          const { data: impact } = await (supabase as any).rpc("calculate_leave_impact", {
            p_worker_id: req.worker_id,
            p_start_date: req.start_at || `${req.start_date}T00:00:00.000Z`,
            p_end_date: req.end_at || `${req.end_date}T23:59:59.999Z`,
          });
          if (impact) {
            totalImpactedShifts += impact.impacted_shift_count || 0;
            totalParticipants += impact.unique_participants_affected || 0;
            totalRevenue += parseFloat(impact.revenue_at_risk) || 0;
          }
        } catch {
          // Skip individual impact calc failures
        }
      }
    }

    return {
      pending_requests: (pending || []).length,
      impacted_shifts_7d: totalImpactedShifts,
      participants_affected: totalParticipants,
      revenue_at_risk: Math.round(totalRevenue * 100) / 100,
    };
  } catch (error) {
    console.error("[aegis-leave] getLeaveTelemetryAction", error);
    return {
      pending_requests: 0,
      impacted_shifts_7d: 0,
      participants_affected: 0,
      revenue_at_risk: 0,
    };
  }
}

export async function getOrphanedShiftsForLeaveAction(
  workerId: string,
  startAt: string,
  endAt: string,
) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("schedule_blocks")
      .select("id, title, start_time, end_time, participant_id, participant_profiles(preferred_name, full_name)")
      .eq("assigned_to", workerId)
      .gte("start_time", startAt)
      .lte("end_time", endAt)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[aegis-leave] getOrphanedShiftsForLeaveAction", error);
    return [];
  }
}

export async function syncLeaveBalanceCacheAction(input: {
  organization_id: string;
  worker_id: string;
  annual_leave_hours?: number;
  sick_leave_hours?: number;
}) {
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("leave_balances_cache")
    .upsert({
      organization_id: input.organization_id,
      worker_id: input.worker_id,
      annual_leave_hours: input.annual_leave_hours ?? 0,
      sick_leave_hours: input.sick_leave_hours ?? 0,
      external_source: "xero",
      external_payload: {
        mode: "manual-cache-update",
      },
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "worker_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/team/leave");
  return data;
}
