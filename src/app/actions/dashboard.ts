/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/* ── Types ───────────────────────────────────────────── */

export interface DashboardStats {
  revenue_current: number;
  revenue_previous: number;
  revenue_growth_pct: number;
  active_jobs_count: number;
  unassigned_jobs_count: number;
  total_jobs_count: number;
}

export interface DailyRevenuePoint {
  date: string;
  amount: number;
  invoice_count: number;
}

export interface ScheduleItem {
  id: string;
  job_id: string | null;
  title: string;
  client_name: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  status: string;
  travel_minutes: number;
  notes: string | null;
}

export interface AIInsight {
  type: "warning" | "alert" | "info" | "success";
  title: string;
  body: string;
  action: string | null;
  action_route: string | null;
  priority: number;
}

export interface TeamMemberStatus {
  user_id: string;
  name: string;
  initials: string;
  avatar_url: string | null;
  status: "on_job" | "en_route" | "idle";
  current_task: string | null;
}

export interface DispatchPin {
  id: string;
  task: string;
  status: string;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  name: string | null;
  technician_id: string | null;
  dispatch_status: "on_job" | "en_route";
}

/* ── Dashboard Stats ─────────────────────────────────── */

export async function getDashboardStats(orgId: string, rangeStart?: string, rangeEnd?: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_org_id: orgId,
      ...(rangeStart ? { p_range_start: rangeStart } : {}),
      ...(rangeEnd ? { p_range_end: rangeEnd } : {}),
    });

    if (error) {
      logger.error("Failed to fetch dashboard stats", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: data as DashboardStats, error: null };
  } catch (error: any) {
    logger.error("Dashboard stats error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch dashboard stats" };
  }
}

/* ── Daily Revenue Chart ─────────────────────────────── */

export async function getDailyRevenueChart(orgId: string, days: number = 30) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_daily_revenue_chart", {
      p_org_id: orgId,
      p_days: days,
    });

    if (error) {
      logger.error("Failed to fetch revenue chart", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: (data || []) as DailyRevenuePoint[], error: null };
  } catch (error: any) {
    logger.error("Revenue chart error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch revenue chart" };
  }
}

/* ── My Schedule ─────────────────────────────────────── */

export async function getMySchedule(limit: number = 5) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("get_my_schedule", {
      p_user_id: user.id,
      p_limit: limit,
    });

    if (error) {
      logger.error("Failed to fetch schedule", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: (data || []) as ScheduleItem[], error: null };
  } catch (error: any) {
    logger.error("Schedule error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch schedule" };
  }
}

/* ── AI Insights ─────────────────────────────────────── */

export async function getAIInsights(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_ai_insights", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch insights", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: (data || []) as AIInsight[], error: null };
  } catch (error: any) {
    logger.error("Insights error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch insights" };
  }
}

/* ── Team Status ─────────────────────────────────────── */

export async function getTeamStatus(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_team_status", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch team status", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: (data || []) as TeamMemberStatus[], error: null };
  } catch (error: any) {
    logger.error("Team status error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch team status" };
  }
}

/* ── Aggregated Dashboard Snapshot ───────────────────── */

export async function getDashboardSnapshot(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_dashboard_snapshot", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch dashboard snapshot", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    logger.error("Dashboard snapshot error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch dashboard snapshot" };
  }
}

/* ── Dashboard Layout Persistence ───────────────────── */

export async function saveDashboardLayout(layout: any) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { error } = await supabase.rpc("save_dashboard_layout", {
      p_layout: layout,
    });

    if (error) {
      logger.error("Failed to save layout", "dashboard", undefined, { error: error.message });
      return { error: error.message };
    }

    return { error: null };
  } catch (error: any) {
    logger.error("Save layout error", "dashboard", error);
    return { error: error.message || "Failed to save dashboard layout" };
  }
}

export async function loadDashboardLayout() {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_dashboard_layout");

    if (error) {
      logger.error("Failed to load layout", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error("Load layout error", "dashboard", error);
    return { data: null, error: error.message || "Failed to load dashboard layout" };
  }
}

/* ── Live Dispatch ───────────────────────────────────── */

export async function getLiveDispatch(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_live_dispatch", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch dispatch", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: (data || []) as DispatchPin[], error: null };
  } catch (error: any) {
    logger.error("Dispatch error", "dashboard", error);
    return { data: null, error: error.message || "Failed to fetch dispatch data" };
  }
}

/** Footprint trail for dispatch map: path + optional timestamps per tech */
export interface FootprintTrailRow {
  technician_id: string;
  path: Array<{ lat: number; lng: number }>;
  timestamps?: number[] | null;
}

export async function getFootprintTrails(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const { data, error } = await supabase
      .from("footprint_trails")
      .select("technician_id, path, timestamps")
      .eq("organization_id", orgId);

    if (error) {
      logger.error("Failed to fetch footprint trails", "dashboard", undefined, { error: error.message });
      return { data: [], error: error.message };
    }
    const rows = (data || []) as FootprintTrailRow[];
    const trails = rows
      .filter((r) => Array.isArray(r.path) && r.path.length >= 2)
      .map((r) => ({
        techId: r.technician_id,
        path: r.path as { lat: number; lng: number }[],
        timestamps: r.timestamps ?? undefined,
      }));
    return { data: trails, error: null };
  } catch (error: any) {
    logger.error("Footprint trails error", "dashboard", error);
    return { data: [], error: error.message || "Failed to fetch footprint trails" };
  }
}

/** Snap raw GPS path to roads (Google Roads API). Call on-demand when footprints are toggled; cache in frontend. */
export async function snapFootprintToRoads(path: Array<{ lat: number; lng: number }>) {
  try {
    if (path.length < 2) return { data: path, error: null };
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
    if (!key) return { data: path, error: "Missing Google Maps API key" };
    const pathStr = path.map((p) => `${p.lat},${p.lng}`).join("|");
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathStr)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return { data: path, error: `Roads API: ${res.status} ${text}` };
    }
    const json = (await res.json()) as { snappedPoints?: Array<{ location: { latitude: number; longitude: number } }> };
    const snapped =
      json.snappedPoints?.map((p) => ({ lat: p.location.latitude, lng: p.location.longitude })) ?? path;
    return { data: snapped.length >= 2 ? snapped : path, error: null };
  } catch (error: any) {
    return { data: path, error: error?.message ?? "Snap to roads failed" };
  }
}
