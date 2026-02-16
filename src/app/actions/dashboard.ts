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
