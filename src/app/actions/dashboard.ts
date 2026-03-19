"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  DashboardStatsSchema,
  DailyRevenuePointSchema,
  ScheduleItemSchema,
  AIInsightSchema,
  DispatchPinSchema,
  DashboardSnapshotSchema,
  DashboardLayoutSchema,
  FootprintTrailRowSchema,
} from "@/lib/schemas/dashboard";

/* ── Re-export types from schema (single source of truth) ── */
export type { DashboardStats, DailyRevenuePoint, ScheduleItem, AIInsight, DispatchPin, FootprintTrailRow } from "@/lib/schemas/dashboard";
export type { DashboardSnapshot } from "@/lib/schemas/dashboard";

/* ── Auth guard helper ──────────────────────────────── */

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, user: null, error: "Unauthorized" as const };

  return { supabase, user, error: null };
}

/* ── Dashboard Stats ─────────────────────────────────── */

export async function getDashboardStats(orgId: string, rangeStart?: string, rangeEnd?: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_org_id: orgId,
      ...(rangeStart ? { p_range_start: rangeStart } : {}),
      ...(rangeEnd ? { p_range_end: rangeEnd } : {}),
    });

    if (error) {
      logger.error("Failed to fetch dashboard stats", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = DashboardStatsSchema.safeParse(data);
    if (!parsed.success) {
      logger.error("Dashboard stats schema mismatch", "dashboard", undefined, { issues: parsed.error.issues });
      return { data: null, error: "Data validation failed" };
    }
    return { data: parsed.data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch dashboard stats";
    logger.error("Dashboard stats error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Daily Revenue Chart ─────────────────────────────── */

export async function getDailyRevenueChart(orgId: string, days: number = 30) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_daily_revenue_chart", {
      p_org_id: orgId,
      p_days: days,
    });

    if (error) {
      logger.error("Failed to fetch revenue chart", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = z.array(DailyRevenuePointSchema).safeParse(data || []);
    return { data: parsed.success ? parsed.data : [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch revenue chart";
    logger.error("Revenue chart error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── My Schedule ─────────────────────────────────────── */

export async function getMySchedule(limit: number = 5) {
  try {
    const supabase = await createServerSupabaseClient();
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

    const parsed = z.array(ScheduleItemSchema).safeParse(data || []);
    return { data: parsed.success ? parsed.data : [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch schedule";
    logger.error("Schedule error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── AI Insights ─────────────────────────────────────── */

export async function getAIInsights(orgId: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_ai_insights", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch insights", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = z.array(AIInsightSchema).safeParse(data || []);
    return { data: parsed.success ? parsed.data : [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch insights";
    logger.error("Insights error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Team Status ─────────────────────────────────────── */

export async function getTeamStatus(orgId: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_team_status", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch team status", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = z.array(z.object({
      user_id: z.string(),
      name: z.string(),
      initials: z.string(),
      avatar_url: z.string().nullable().optional(),
      status: z.enum(["on_job", "en_route", "idle"]).catch("idle"),
      current_task: z.string().nullable().optional(),
    })).safeParse(data || []);
    return { data: parsed.success ? parsed.data : [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch team status";
    logger.error("Team status error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Aggregated Dashboard Snapshot ───────────────────── */

export async function getDashboardSnapshot(orgId: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_dashboard_snapshot", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch dashboard snapshot", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    type Snapshot = z.infer<typeof DashboardSnapshotSchema>;
    const parsed = DashboardSnapshotSchema.safeParse(data);
    if (!parsed.success) {
      logger.error("Dashboard snapshot schema mismatch", "dashboard", undefined, { issues: parsed.error.issues });
      return { data: data as Snapshot, error: null };
    }
    return { data: parsed.data as Snapshot, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch dashboard snapshot";
    logger.error("Dashboard snapshot error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Dashboard Layout Persistence ───────────────────── */

export async function saveDashboardLayout(layout: unknown) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const parsed = DashboardLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      return { error: `Invalid layout: ${parsed.error.issues.map(i => i.message).join(", ")}` };
    }

    const { error } = await supabase.rpc("save_dashboard_layout", {
      p_layout: parsed.data,
    });

    if (error) {
      logger.error("Failed to save layout", "dashboard", undefined, { error: error.message });
      return { error: error.message };
    }

    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save dashboard layout";
    logger.error("Save layout error", "dashboard", err instanceof Error ? err : undefined);
    return { error: message };
  }
}

export async function loadDashboardLayout() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("get_dashboard_layout");

    if (error) {
      logger.error("Failed to load layout", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = DashboardLayoutSchema.safeParse(data);
    return { data: parsed.success ? parsed.data : null, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard layout";
    logger.error("Load layout error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Live Dispatch ───────────────────────────────────── */

export async function getLiveDispatch(orgId: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: null, error: authErr };

    const { data, error } = await supabase.rpc("get_live_dispatch", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("Failed to fetch dispatch", "dashboard", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const parsed = z.array(DispatchPinSchema).safeParse(data || []);
    return { data: parsed.success ? parsed.data : [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch dispatch data";
    logger.error("Dispatch error", "dashboard", err instanceof Error ? err : undefined);
    return { data: null, error: message };
  }
}

/* ── Fleet Position Update ──────────────────────────── */

export async function updateFleetPosition(
  orgId: string,
  lat: number,
  lng: number,
  opts?: {
    heading?: number;
    speed?: number;
    accuracy?: number;
    battery?: number;
    status?: string;
  }
) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { success: false, error: authErr };

    const { error } = await supabase.rpc("update_fleet_position" as never, {
      p_org_id: orgId,
      p_lat: lat,
      p_lng: lng,
      p_heading: opts?.heading ?? null,
      p_speed: opts?.speed ?? null,
      p_accuracy: opts?.accuracy ?? null,
      p_battery: opts?.battery ?? null,
      p_status: opts?.status ?? "idle",
    } as never);
    if (error) {
      logger.error("Fleet position update failed", "dispatch", undefined, { error: error.message });
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update position";
    logger.error("Fleet position error", "dispatch", err instanceof Error ? err : undefined);
    return { success: false, error: message };
  }
}

/* ── Footprint Trails ───────────────────────────────── */

export async function getFootprintTrails(orgId: string) {
  try {
    const { supabase, error: authErr } = await requireOrgMember(orgId);
    if (authErr) return { data: [], error: authErr };

    const { data, error } = await supabase
      .from("footprint_trails")
      .select("technician_id, path, timestamps")
      .eq("organization_id", orgId);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
        logger.warn("footprint_trails table not found — returning empty trails", "dashboard");
        return { data: [], error: null };
      }
      logger.error("Failed to fetch footprint trails", "dashboard", undefined, { error: error.message });
      return { data: [], error: error.message };
    }

    const parsed = z.array(FootprintTrailRowSchema).safeParse(data || []);
    const rows = parsed.success ? parsed.data : [];
    const trails = rows
      .filter((r) => Array.isArray(r.path) && r.path.length >= 2)
      .map((r) => ({
        techId: r.technician_id,
        path: r.path,
        timestamps: r.timestamps ?? undefined,
      }));
    return { data: trails, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch footprint trails";
    logger.error("Footprint trails error", "dashboard", err instanceof Error ? err : undefined);
    return { data: [], error: message };
  }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

export async function snapFootprintToRoads(path: Array<{ lat: number; lng: number }>) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: path, error: "Unauthorized" };

    if (path.length < 2) return { data: path, error: null };

    let coords = path.map((p) => `${p.lng},${p.lat}`);
    if (coords.length > 100) {
      const step = Math.ceil(coords.length / 100);
      coords = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
    }
    const coordStr = coords.join(";");

    const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordStr}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return { data: path, error: `Map Matching API: ${res.status} ${text}` };
    }
    const json = await res.json();
    const matchedCoords = json?.matchings?.[0]?.geometry?.coordinates;
    if (!matchedCoords || matchedCoords.length < 2) return { data: path, error: null };

    const snapped = (matchedCoords as [number, number][]).map((c) => ({ lat: c[1], lng: c[0] }));
    return { data: snapped, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Snap to roads failed";
    return { data: path, error: message };
  }
}
