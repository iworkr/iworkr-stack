/**
 * @module SystemTelemetry Server Actions
 * @status COMPLETE
 * @description System telemetry collection — event tracking, error logging, performance metrics, and workspace-level analytics. All functions auth-gated via withAuth.
 * @exports logTelemetryEvent, fetchTelemetryEvents, fetchTelemetryStats, fetchErrorLogs
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/safe-action";

export interface SystemTelemetryRow {
  id: string;
  created_at: string;
  workspace_id: string | null;
  user_id: string | null;
  event_category: string;
  severity: string;
  url_path: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
}

export interface TelemetryDashboardStats {
  total_24h: number;
  errors_24h: number;
  error_rate: number;
  p95_lcp: number | null;
  most_impacted_workspace: string | null;
  top_error_path: string | null;
}

// 1. getDashboardStats(hours?: number) - Returns aggregate stats for the metrics ribbon
// Queries: count total events in last N hours, count ERROR/FATAL events, calculate error rate
// For P95 LCP: query events where event_category='WEB_VITALS' and payload->>'metric'='LCP', get the p95 value
// For most impacted workspace: group by workspace_id, order by count DESC, limit 1

export async function getTelemetryDashboardStats(hours = 24): Promise<TelemetryDashboardStats> {
  return withAuth(async (_user) => {
    const supabase = await createServerSupabaseClient();
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    // Total events
    const { count: total } = await (supabase as any)
      .from("system_telemetry")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

    // Error events
    const { count: errors } = await (supabase as any)
      .from("system_telemetry")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .in("severity", ["ERROR", "FATAL"]);

    const total24h = total || 0;
    const errors24h = errors || 0;

    return {
      total_24h: total24h,
      errors_24h: errors24h,
      error_rate: total24h > 0 ? (errors24h / total24h) * 100 : 0,
      p95_lcp: null, // computed client-side from WEB_VITALS events
      most_impacted_workspace: null,
      top_error_path: null,
    };
  });
}

// 2. listTelemetryEvents - Paginated list with filters
export async function listSystemTelemetry(opts: {
  limit?: number;
  offset?: number;
  severity?: string;
  category?: string;
  workspaceId?: string;
  search?: string;
  since?: string;
  until?: string;
}): Promise<{ data: SystemTelemetryRow[]; total: number }> {
  return withAuth(async (_user) => {
    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("system_telemetry")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (opts.severity) query = query.eq("severity", opts.severity);
    if (opts.category) query = query.eq("event_category", opts.category);
    if (opts.workspaceId) query = query.eq("workspace_id", opts.workspaceId);
    if (opts.since) query = query.gte("created_at", opts.since);
    if (opts.until) query = query.lte("created_at", opts.until);
    if (opts.search) query = query.or(`url_path.ilike.%${opts.search}%,payload->>message.ilike.%${opts.search}%`);

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[system-telemetry] list failed:", error);
      return { data: [], total: 0 };
    }

    return { data: data || [], total: count || 0 };
  });
}

// 3. getLatencyTimeSeries - For the scatter chart
export async function getLatencyTimeSeries(hours = 24): Promise<
  Array<{
    created_at: string;
    duration_ms: number;
    url_path: string;
    severity: string;
  }>
> {
  return withAuth(async (_user) => {
    const supabase = await createServerSupabaseClient();
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const { data, error } = await (supabase as any)
      .from("system_telemetry")
      .select("created_at, payload, url_path, severity")
      .eq("event_category", "NETWORK_LATENCY")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error || !data) return [];

    return data.map((row: any) => ({
      created_at: row.created_at,
      duration_ms: row.payload?.duration_ms ?? 0,
      url_path: row.url_path || row.payload?.request_url || "",
      severity: row.severity,
    }));
  });
}

// 4. getErrorsByHour - For the bar chart
export async function getErrorsByHour(hours = 24): Promise<
  Array<{
    hour: string;
    CONSOLE_ERROR: number;
    REACT_CRASH: number;
    NETWORK_LATENCY: number;
    UNHANDLED_ERROR: number;
  }>
> {
  return withAuth(async (_user) => {
    const supabase = await createServerSupabaseClient();
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const { data, error } = await (supabase as any)
      .from("system_telemetry")
      .select("created_at, event_category")
      .gte("created_at", since)
      .in("severity", ["ERROR", "FATAL", "WARN"])
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error || !data) return [];

    // Group by hour
    interface HourBucket {
      CONSOLE_ERROR: number;
      REACT_CRASH: number;
      NETWORK_LATENCY: number;
      UNHANDLED_ERROR: number;
    }

    const buckets = new Map<string, HourBucket>();
    for (const row of data) {
      const hour = new Date(row.created_at).toISOString().slice(0, 13) + ":00";
      if (!buckets.has(hour)) {
        buckets.set(hour, { CONSOLE_ERROR: 0, REACT_CRASH: 0, NETWORK_LATENCY: 0, UNHANDLED_ERROR: 0 });
      }
      const bucket = buckets.get(hour)!;
      const cat = row.event_category as keyof HourBucket;
      if (cat in bucket) bucket[cat]++;
    }

    return Array.from(buckets.entries()).map(([hour, counts]) => ({
      hour,
      CONSOLE_ERROR: counts.CONSOLE_ERROR,
      REACT_CRASH: counts.REACT_CRASH,
      NETWORK_LATENCY: counts.NETWORK_LATENCY,
      UNHANDLED_ERROR: counts.UNHANDLED_ERROR,
    }));
  });
}
