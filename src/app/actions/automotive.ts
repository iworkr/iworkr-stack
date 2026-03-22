/**
 * @module Automotive Server Actions
 * @status COMPLETE
 * @description Project Outrider — automotive dashboard for transit logs, SOS events, and fleet telemetry
 * @exports fetchTransitLogsAction, fetchSosEventsAction, fetchFleetTelemetryAction, acknowledgeSOSAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// Project Outrider — Server Actions for Automotive Dashboard
// ============================================================================
// Admin-facing actions to view transit logs, SOS events, and fleet telemetry.
// ============================================================================

/* ── Helpers ──────────────────────────────────────────── */

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ── Get Transit Logs (Admin) ─────────────────────────── */

export async function getTransitLogs(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    userId?: string;
    vehicleId?: string;
  }
) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);

    if (!["owner", "admin"].includes(role)) {
      return { data: null, error: "Admin access required", count: 0 };
    }

    let query = (supabase as any)
      .from("vehicle_transit_logs")
      .select(
        `
        *,
        profiles:user_id (full_name, email),
        fleet_vehicles:vehicle_id (name, registration_number)
      `
      )
      .eq("organization_id", orgId)
      .order("connection_started_at", { ascending: false })
      .range(
        options?.offset || 0,
        (options?.offset || 0) + (options?.limit || 50) - 1
      );

    if (options?.userId) query = query.eq("user_id", options.userId);
    if (options?.vehicleId)
      query = query.eq("vehicle_id", options.vehicleId);

    const { data, error } = await query;
    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: data?.length || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

/* ── Get SOS Events ───────────────────────────────────── */

export async function getSOSEvents(
  orgId: string,
  options?: { status?: string; limit?: number }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("automotive_sos_events")
      .select(
        `
        *,
        profiles:user_id (full_name, email, phone),
        fleet_vehicles:vehicle_id (name, registration_number)
      `
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(options?.limit || 50);

    if (options?.status) query = query.eq("status", options.status);

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Acknowledge SOS Event ────────────────────────────── */

export async function acknowledgeSOSEvent(
  orgId: string,
  eventId: string
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("automotive_sos_events")
      .update({
        status: "acknowledged",
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Resolve SOS Event ────────────────────────────────── */

export async function resolveSOSEvent(
  orgId: string,
  eventId: string,
  resolution: string,
  isFalseAlarm?: boolean
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("automotive_sos_events")
      .update({
        status: isFalseAlarm ? "false_alarm" : "resolved",
        resolution_notes: resolution,
      })
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get Fleet Mileage Summary ────────────────────────── */

export async function getFleetMileageSummary(orgId: string) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);

    if (!["owner", "admin"].includes(role)) {
      return { data: null, error: "Admin access required" };
    }

    const { data, error } = await (supabase as any)
      .from("vehicle_transit_logs")
      .select("vehicle_id, distance_traveled_km, duration_minutes")
      .eq("organization_id", orgId)
      .not("vehicle_id", "is", null);

    if (error) return { data: null, error: error.message };

    // Aggregate by vehicle
    const summary: Record<
      string,
      { totalKm: number; totalMinutes: number; trips: number }
    > = {};

    for (const log of data || []) {
      const vid = log.vehicle_id;
      if (!summary[vid]) {
        summary[vid] = { totalKm: 0, totalMinutes: 0, trips: 0 };
      }
      summary[vid].totalKm += Number(log.distance_traveled_km || 0);
      summary[vid].totalMinutes += Number(log.duration_minutes || 0);
      summary[vid].trips += 1;
    }

    return { data: summary, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
