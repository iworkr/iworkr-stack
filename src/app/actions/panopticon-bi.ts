/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Auth Helper ────────────────────────────────────── */

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ── Types ───────────────────────────────────────────── */

export type AnalyticsSummary = {
  total_revenue: number;
  total_cogs: number;
  blended_margin_pct: number;
  unbilled_wip: number;
  labor_utilization_pct: number;
  overtime_leakage: number;
  job_count: number;
  last_refresh: string | null;
  period_months: number;
};

export type CategoryMetric = {
  job_category: string;
  job_count: number;
  revenue: number;
  cogs: number;
  margin: number;
  avg_margin_pct: number;
};

export type RevenueTrend = {
  created_month: string;
  revenue: number;
  cogs: number;
  margin: number;
  job_count: number;
};

export type WorkerLeaderboardEntry = {
  worker_id: string;
  worker_name: string;
  branch: string;
  total_hours: number;
  total_cost: number;
  billable_hours: number;
  avg_utilization_pct: number;
  overtime_hours: number;
  overtime_cost: number;
};

export type PivotRow = Record<string, any>;

export type RefreshResult = {
  view: string;
  status: string;
  rows?: number;
  duration_ms?: number;
  error?: string;
};

/* ── 1. Analytics Summary ───────────────────────────── */

export async function getAnalyticsSummary(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_analytics_summary", {
      p_org_id: orgId,
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as AnalyticsSummary, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch analytics summary" };
  }
}

/* ── 2. Profitability by Category ───────────────────── */

export async function getProfitabilityByCategory(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_profitability_by_category", {
      p_org_id: orgId,
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as CategoryMetric[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch profitability by category" };
  }
}

/* ── 3. Revenue Trend ───────────────────────────────── */

export async function getRevenueTrend(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_revenue_trend", {
      p_org_id: orgId,
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as RevenueTrend[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch revenue trend" };
  }
}

/* ── 4. Worker Leaderboard ──────────────────────────── */

export async function getWorkerLeaderboard(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_worker_leaderboard", {
      p_org_id: orgId,
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as WorkerLeaderboardEntry[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch worker leaderboard" };
  }
}

/* ── 5. Pivot Data ──────────────────────────────────── */

export async function getPivotData(orgId: string, source: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_pivot_data", {
      p_org_id: orgId,
      p_source: source,
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as PivotRow[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch pivot data" };
  }
}

/* ── 6. Refresh Analytics Views ─────────────────────── */

export async function refreshAnalyticsViews(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("refresh_analytics_views", {
      p_org_id: orgId,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as RefreshResult[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to refresh analytics views" };
  }
}

/* ── 7. Refresh History ─────────────────────────────── */

export async function getRefreshHistory(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("analytics_refresh_log")
      .select("*")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch refresh history" };
  }
}

/* ── 8. Job Drill-Down ──────────────────────────────── */

export async function getJobDrillDown(orgId: string, jobId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("organization_id", orgId)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch job drill-down" };
  }
}

/* ── 9. Worker Drill-Down ───────────────────────────── */

export async function getWorkerDrillDown(orgId: string, workerId: string, month?: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("timesheet_pay_lines")
      .select("*")
      .eq("organization_id", orgId)
      .eq("worker_id", workerId);

    if (month) {
      const startDate = `${month}-01`;
      const [year, mon] = month.split("-").map(Number);
      const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
      query = query.gte("shift_date", startDate).lt("shift_date", nextMonth);
    }

    const { data, error } = await query.order("shift_date", { ascending: false }).limit(100);

    if (error) return { data: null, error: error.message };
    return { data: data as any[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch worker drill-down" };
  }
}

/* ── 10. NDIS Burn Data ─────────────────────────────── */

export async function getNdisBurnData(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_pivot_data", {
      p_org_id: orgId,
      p_source: "ndis_fund_burn",
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as PivotRow[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch NDIS burn data" };
  }
}

/* ── 11. Estimate vs Actual ─────────────────────────── */

export async function getEstimateVsActualData(orgId: string, months?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_pivot_data", {
      p_org_id: orgId,
      p_source: "trade_estimate_vs_actual",
      p_months: months ?? 6,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as PivotRow[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch estimate vs actual data" };
  }
}

/* ── 12. Last Refresh Time ──────────────────────────── */

export async function getLastRefreshTime() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("analytics_refresh_log")
      .select("finished_at, started_at, duration_ms")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };

    const lastRefresh = data?.finished_at ?? null;
    // Estimate next refresh — assume hourly cadence
    let nextRefreshEstimate: string | null = null;
    if (lastRefresh) {
      const last = new Date(lastRefresh);
      last.setHours(last.getHours() + 1);
      nextRefreshEstimate = last.toISOString();
    }

    return {
      data: {
        last_refresh: lastRefresh,
        next_refresh_estimate: nextRefreshEstimate,
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch last refresh time" };
  }
}
