/**
 * @module Chronos-Lock Server Actions
 * @status COMPLETE
 * @description Geofenced T&A anomaly management — CRUD, bulk approval, spatial verification
 * @exports fetchAnomaliesAction, resolveAnomalyAction, bulkApproveCleanTimesheetsAction, fetchAnomalyStatsAction
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimesheetAnomaly {
  id: string;
  organization_id: string;
  time_entry_id: string | null;
  timesheet_id: string | null;
  worker_id: string;
  job_id: string | null;
  shift_id: string | null;
  anomaly_type: "GEOFENCE_BREACH" | "GPS_UNAVAILABLE" | "TEMPORAL_SPOOFING" | "MOCK_LOCATION";
  recorded_distance_meters: number | null;
  recorded_location: any;
  job_location: any;
  worker_justification: string | null;
  device_accuracy_meters: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  worker_name?: string;
  worker_email?: string;
  worker_avatar?: string | null;
  job_title?: string;
  job_location_lat?: number;
  job_location_lng?: number;
  job_location_name?: string;
  clock_in_location?: { lat: number; lng: number; accuracy_m?: number } | null;
}

export interface AnomalyStats {
  pending: number;
  approved: number;
  rejected: number;
  total_breaches_7d: number;
  avg_distance: number | null;
}

// ── Fetch Anomalies ──────────────────────────────────────────────────────────

export async function fetchAnomaliesAction(
  orgId: string,
  status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL",
  limit = 50,
) {
  const supabase = await createServerSupabaseClient();

  const selectStr = [
    "*",
    "worker:profiles!worker_id(full_name, email, avatar_url)",
    "job:jobs!job_id(title, location, location_lat, location_lng, site_lat, site_lng)",
    "time_entry:time_entries!time_entry_id(clock_in, clock_out, clock_in_location, clock_out_location, clock_in_distance_meters, server_verified_distance, is_spatial_violation)",
  ].join(", ");

  // Table not yet in generated types — will resolve after migration + type regen
  const sb = supabase as any;

  let query = sb
    .from("timesheet_anomalies")
    .select(selectStr)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[chronos-lock] fetchAnomalies:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    ...row,
    worker_name: row.worker?.full_name || "Unknown",
    worker_email: row.worker?.email || "",
    worker_avatar: row.worker?.avatar_url || null,
    job_title: row.job?.title || "Unknown Job",
    job_location_lat: row.job?.site_lat ?? row.job?.location_lat ?? null,
    job_location_lng: row.job?.site_lng ?? row.job?.location_lng ?? null,
    job_location_name: row.job?.location || "",
    clock_in_location: row.time_entry?.clock_in_location || null,
  })) as TimesheetAnomaly[];
}

// ── Fetch Single Anomaly ─────────────────────────────────────────────────────

export async function fetchAnomalyByIdAction(anomalyId: string) {
  const supabase = await createServerSupabaseClient();

  const selectStr = [
    "*",
    "worker:profiles!worker_id(full_name, email, avatar_url)",
    "job:jobs!job_id(title, location, location_lat, location_lng, site_lat, site_lng)",
    "time_entry:time_entries!time_entry_id(clock_in, clock_out, clock_in_location, clock_out_location, clock_in_distance_meters, server_verified_distance, is_spatial_violation, status)",
  ].join(", ");

  const sb = supabase as any;
  const { data, error } = await sb
    .from("timesheet_anomalies")
    .select(selectStr)
    .eq("id", anomalyId)
    .single();

  if (error) {
    console.error("[chronos-lock] fetchAnomalyById:", error);
    return null;
  }

  return {
    ...data,
    worker_name: (data as any).worker?.full_name || "Unknown",
    worker_email: (data as any).worker?.email || "",
    worker_avatar: (data as any).worker?.avatar_url || null,
    job_title: (data as any).job?.title || "Unknown Job",
    job_location_lat:
      (data as any).job?.site_lat ?? (data as any).job?.location_lat ?? null,
    job_location_lng:
      (data as any).job?.site_lng ?? (data as any).job?.location_lng ?? null,
    job_location_name: (data as any).job?.location || "",
    clock_in_location: (data as any).time_entry?.clock_in_location || null,
  } as TimesheetAnomaly;
}

// ── Resolve Anomaly (Approve / Reject) ───────────────────────────────────────

export async function resolveAnomalyAction(
  anomalyId: string,
  action: "APPROVED" | "REJECTED",
  notes?: string,
  updateJobLocation?: boolean,
) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const sb = supabase as any;

  const { data: anomaly, error: fetchError } = await sb
    .from("timesheet_anomalies")
    .select("*")
    .eq("id", anomalyId)
    .single();

  if (fetchError || !anomaly) {
    return { error: "Anomaly not found" };
  }

  // Update anomaly status
  const { error: updateError } = await sb
    .from("timesheet_anomalies")
    .update({
      status: action,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes || null,
    })
    .eq("id", anomalyId);

  if (updateError) {
    return { error: updateError.message };
  }

  if (action === "APPROVED") {
    // Clear the spatial violation flag on the time entry
    if (anomaly.time_entry_id) {
      await sb
        .from("time_entries")
        .update({
          is_spatial_violation: false,
          is_geofence_override: true,
          geofence_override_reason: notes || "Approved by dispatcher",
          exception_resolved: true,
          exception_resolved_by: user.id,
        } as any)
        .eq("id", anomaly.time_entry_id);
    }

    // Optionally update the job's location to the worker's reported position
    if (updateJobLocation && anomaly.job_id && anomaly.clock_in_location) {
      const loc =
        typeof anomaly.clock_in_location === "string"
          ? JSON.parse(anomaly.clock_in_location)
          : anomaly.clock_in_location;

      if (loc?.lat && loc?.lng) {
        await sb
          .from("jobs")
          .update({
            site_lat: loc.lat,
            site_lng: loc.lng,
          } as any)
          .eq("id", anomaly.job_id);
      }
    }
  }

  if (action === "REJECTED") {
    // Nullify the time entry — mark as disputed
    if (anomaly.time_entry_id) {
      await sb
        .from("time_entries")
        .update({
          status: "disputed",
          exception_type: "geofence_breach",
          exception_notes: `Rejected: ${notes || "Spatial violation confirmed"}`,
        } as any)
        .eq("id", anomaly.time_entry_id);
    }
  }

  revalidatePath("/dashboard/timesheets/anomalies");
  return { success: true };
}

// ── Bulk Approve Clean Timesheets ────────────────────────────────────────────

export async function bulkApproveCleanTimesheetsAction(
  orgId: string,
  periodStart: string,
  periodEnd: string,
) {
  const supabase = await createServerSupabaseClient();

  const sb = supabase as any;
  const { data, error } = await sb.rpc("bulk_approve_clean_timesheets", {
    p_organization_id: orgId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) {
    console.error("[chronos-lock] bulkApprove:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/timesheets");
  return data as { approved_count: number; quarantined_count: number };
}

// ── Anomaly Stats ────────────────────────────────────────────────────────────

export async function fetchAnomalyStatsAction(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { data, error } = await sb.rpc("get_anomaly_stats", {
    p_organization_id: orgId,
  });

  if (error) {
    console.error("[chronos-lock] fetchAnomalyStats:", error);
    return { pending: 0, approved: 0, rejected: 0, total_breaches_7d: 0, avg_distance: null };
  }

  return data as AnomalyStats;
}

// ── Verify Distance Server-Side ──────────────────────────────────────────────

export async function verifyClockDistanceAction(
  jobId: string,
  lat: number,
  lng: number,
) {
  const supabase = await createServerSupabaseClient();

  const sb = supabase as any;
  const { data, error } = await sb.rpc("verify_clock_distance", {
    p_job_id: jobId,
    p_lat: lat,
    p_lng: lng,
  });

  if (error) {
    console.error("[chronos-lock] verifyDistance:", error);
    return null;
  }

  return data as number;
}

// ── Fetch Anomalies for Worker (Mobile API) ──────────────────────────────────

export async function fetchWorkerAnomaliesAction(workerId: string, limit = 20) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { data, error } = await sb
    .from("timesheet_anomalies")
    .select("id, anomaly_type, recorded_distance_meters, status, worker_justification, created_at")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[chronos-lock] fetchWorkerAnomalies:", error);
    return [];
  }

  return data || [];
}
