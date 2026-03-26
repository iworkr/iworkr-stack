/**
 * @module Route Optimization Server Actions
 * @status COMPLETE
 * @description Project Outrider-Route — Server actions for AI route optimization,
 *   supplier waypoints, time-pinning, and commit operations.
 * @exports optimizeWorkerRoute, commitOptimizedRoute, togglePinBlock, addSupplierWaypoint, getOptimizationHistory, getOptimizableBlocks
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface OptimizableStop {
  id: string;
  title: string;
  client_name: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  job_id: string | null;
  is_time_pinned: boolean;
  is_supplier_waypoint: boolean;
  waypoint_name: string | null;
  duration_seconds: number;
  lat: number | null;
  lng: number | null;
  route_sequence: number;
  job_title: string | null;
  resolved_client_name: string | null;
}

export interface ProposedBlock {
  id: string;
  route_sequence: number;
  start_time: string;
  end_time: string;
  travel_duration_seconds: number;
  travel_distance_meters: number;
  polyline: string | null;
  title: string;
  client_name: string | null;
  lat: number | null;
  lng: number | null;
  is_time_pinned: boolean;
  is_supplier_waypoint: boolean;
}

export interface OptimizationResult {
  ok: boolean;
  error?: string;
  run_id?: string;
  worker_id?: string;
  date?: string;
  route_mode?: string;
  start_location?: {
    lat: number;
    lng: number;
    name: string | null;
  } | null;
  stops_count?: number;
  pinned_count?: number;
  proposed_blocks?: ProposedBlock[];
  trip_geometry?: string;
  metrics?: {
    total_travel_seconds: number;
    total_distance_meters: number;
    total_travel_minutes: number;
    total_distance_km: number;
    estimated_savings_minutes: number;
  };
}

export interface OptimizationRun {
  id: string;
  worker_id: string;
  run_date: string;
  status: string;
  total_travel_before_seconds: number;
  total_travel_after_seconds: number;
  travel_saved_seconds: number;
  distance_saved_meters: number;
  pinned_block_count: number;
  committed_at: string | null;
  created_at: string;
}

export interface DispatchableWorker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
}

/* ═══════════════════════════════════════════════════════════════════
   1) GET OPTIMIZABLE BLOCKS — Fetch worker's day agenda with coordinates
   ═══════════════════════════════════════════════════════════════════ */

export async function getOptimizableBlocks(
  workerId: string,
  date: string,
  orgId: string
): Promise<{ blocks: OptimizableStop[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any).rpc("get_optimizable_blocks", {
      p_worker_id: workerId,
      p_date: date,
      p_org_id: orgId,
    });
    if (error) return { blocks: [], error: error.message };
    return { blocks: data || [] };
  } catch {
    return { blocks: [], error: "Failed to fetch blocks" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   2) OPTIMIZE ROUTE — Call the Edge Function for Mapbox TSP
   ═══════════════════════════════════════════════════════════════════ */

export async function optimizeWorkerRoute(
  workerId: string,
  date: string,
  orgId: string,
  dayStartHour = 8,
  dayStartMinute = 0
): Promise<OptimizationResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { ok: false, error: "Not authenticated" };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/outrider-route-optimizer`;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        worker_id: workerId,
        date,
        organization_id: orgId,
        day_start_hour: dayStartHour,
        day_start_minute: dayStartMinute,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        error: result.error || `Optimization failed (${response.status})`,
      };
    }

    return result as OptimizationResult;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Optimization request failed",
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   3) COMMIT OPTIMIZED ROUTE — Persist the proposed sequence
   ═══════════════════════════════════════════════════════════════════ */

export async function commitOptimizedRoute(
  runId: string,
  proposedBlocks: ProposedBlock[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc("commit_optimized_route", {
      p_run_id: runId,
      p_blocks: proposedBlocks.map((b) => ({
        id: b.id,
        start_time: b.start_time,
        end_time: b.end_time,
        route_sequence: b.route_sequence,
        travel_duration_seconds: b.travel_duration_seconds,
        travel_distance_meters: b.travel_distance_meters,
        polyline: b.polyline,
      })),
      p_committed_by: user.id,
    });

    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/dispatch");
    return { ok: true, ...(data || {}) };
  } catch {
    return { ok: false, error: "Failed to commit route" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   4) TOGGLE PIN — Lock/unlock a block's time constraint
   ═══════════════════════════════════════════════════════════════════ */

export async function togglePinBlock(
  blockId: string,
  pinned: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ is_time_pinned: pinned, updated_at: new Date().toISOString() } as any)
      .eq("id", blockId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/schedule");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to toggle pin" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   5) ADD SUPPLIER WAYPOINT — Insert a zero-duration stop for parts pickup
   ═══════════════════════════════════════════════════════════════════ */

export async function addSupplierWaypoint(
  orgId: string,
  workerId: string,
  date: string,
  supplierName: string,
  lat: number,
  lng: number,
  address: string
): Promise<{ ok: boolean; error?: string; blockId?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const startTime = new Date(`${date}T12:00:00`);
    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        organization_id: orgId,
        technician_id: workerId,
        title: `Supplier: ${supplierName}`,
        client_name: supplierName,
        location: address,
        start_time: startTime.toISOString(),
        end_time: startTime.toISOString(),
        status: "scheduled",
        is_supplier_waypoint: true,
        waypoint_name: supplierName,
        travel_minutes: 0,
        metadata: { supplier_lat: lat, supplier_lng: lng },
      } as any)
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/schedule");
    return { ok: true, blockId: data?.id };
  } catch {
    return { ok: false, error: "Failed to add supplier waypoint" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   6) GET WORKER START LOCATION — Fetch home/depot coordinates
   ═══════════════════════════════════════════════════════════════════ */

export async function getWorkerStartLocation(
  workerId: string
): Promise<{
  home_lat: number | null;
  home_lng: number | null;
  home_address: string | null;
  start_name: string | null;
  route_mode: string;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any).rpc("get_worker_start_location", {
      p_worker_id: workerId,
    });
    if (error) return { home_lat: null, home_lng: null, home_address: null, start_name: null, route_mode: "round_trip", error: error.message };
    return data || { home_lat: null, home_lng: null, home_address: null, start_name: null, route_mode: "round_trip" };
  } catch {
    return { home_lat: null, home_lng: null, home_address: null, start_name: null, route_mode: "round_trip", error: "Failed to fetch start location" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   7) OPTIMIZATION HISTORY — Past runs for a worker
   ═══════════════════════════════════════════════════════════════════ */

export async function getOptimizationHistory(
  orgId: string,
  workerId?: string,
  limit = 20
): Promise<{ runs: OptimizationRun[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("route_optimization_runs")
      .select("id, worker_id, run_date, status, total_travel_before_seconds, total_travel_after_seconds, travel_saved_seconds, distance_saved_meters, pinned_block_count, committed_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workerId) {
      query = query.eq("worker_id", workerId);
    }

    const { data, error } = await query;
    if (error) return { runs: [], error: error.message };
    return { runs: data || [] };
  } catch {
    return { runs: [], error: "Failed to fetch history" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   8) GET DAILY WORKERS — List workers with blocks on a given date
   ═══════════════════════════════════════════════════════════════════ */

export async function getWorkersWithBlocks(
  orgId: string,
  date: string
): Promise<{
  workers: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    block_count: number;
    has_coordinates: boolean;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: blocks, error } = await supabase
      .from("schedule_blocks")
      .select(`
        technician_id,
        job_id,
        jobs!job_id(location_lat, location_lng, site_lat, site_lng)
      `)
      .eq("organization_id", orgId)
      .gte("start_time", `${date}T00:00:00`)
      .lt("start_time", `${date}T23:59:59`)
      .not("status", "eq", "cancelled") as any;

    if (error) return { workers: [], error: error.message };

    const workerMap = new Map<string, { count: number; hasCoords: boolean }>();
    for (const b of blocks || []) {
      if (!b.technician_id) continue;
      const current = workerMap.get(b.technician_id) || { count: 0, hasCoords: false };
      current.count++;
      const job = b.jobs;
      if (job && (job.location_lat || job.site_lat)) {
        current.hasCoords = true;
      }
      workerMap.set(b.technician_id, current);
    }

    const workerIds = [...workerMap.keys()];
    if (workerIds.length === 0) return { workers: [] };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", workerIds);

    const workers = (profiles || []).map((p) => {
      const w = workerMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name || "Unknown",
        avatar_url: p.avatar_url,
        block_count: w?.count || 0,
        has_coordinates: w?.hasCoords || false,
      };
    }).sort((a, b) => b.block_count - a.block_count);

    return { workers };
  } catch {
    return { workers: [], error: "Failed to fetch workers" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   9) GET DISPATCHABLE WORKERS — Branch-scoped technician selector
   ═══════════════════════════════════════════════════════════════════ */

export async function getDispatchableWorkers(
  orgId: string,
  branchId: string | null
): Promise<{ workers: DispatchableWorker[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const rpc = supabase as any;

    const { data, error } = await rpc.rpc("get_dispatchable_workers", {
      p_workspace_id: orgId,
      p_branch_id: branchId,
    });

    if (error) return { workers: [], error: error.message };

    const rows = (data || []) as Array<{
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      role?: string | null;
    }>;

    const workers = rows.map((row) => {
      const first = row.first_name || "";
      const last = row.last_name || "";
      const composed = `${first} ${last}`.trim();
      return {
        id: row.id,
        first_name: first,
        last_name: last,
        full_name: row.full_name || composed || "Unnamed worker",
        role: row.role || "worker",
      };
    });

    return { workers };
  } catch (e) {
    return {
      workers: [],
      error: e instanceof Error ? e.message : "Failed to fetch dispatchable workers",
    };
  }
}
