/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Project Panopticon — Telemetry Server Actions
 *
 * These actions power the Olympus Health Dashboard.
 * All require is_super_admin verification.
 */

/* ── Helpers ────────────────────────────────────────────────── */

function err(msg: string) {
  return { data: null, error: msg };
}

type NormalizedConsoleEntry = {
  level: string;
  message: string;
  timestamp: string;
};

function normalizeConsoleBuffer(
  input: unknown,
  fallbackTimestamp: string,
): NormalizedConsoleEntry[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry): NormalizedConsoleEntry => {
      if (typeof entry === "string") {
        return {
          level: "log",
          message: entry,
          timestamp: fallbackTimestamp,
        };
      }

      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const level = typeof obj.level === "string" && obj.level.trim().length > 0
          ? obj.level
          : "log";
        const message =
          typeof obj.message === "string"
            ? obj.message
            : JSON.stringify(obj);
        const timestamp =
          typeof obj.timestamp === "string" && obj.timestamp.length > 0
            ? obj.timestamp
            : fallbackTimestamp;
        return { level, message, timestamp };
      }

      return {
        level: "log",
        message: String(entry),
        timestamp: fallbackTimestamp,
      };
    })
    .slice(0, 200);
}

function normalizeTelemetryRow<T extends Record<string, unknown>>(row: T): T {
  const fallbackTimestamp =
    typeof row.event_timestamp === "string" && row.event_timestamp.length > 0
      ? row.event_timestamp
      : new Date().toISOString();

  return {
    ...row,
    console_buffer: normalizeConsoleBuffer(row.console_buffer, fallbackTimestamp),
  };
}

async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];
  const admin = createAdminSupabaseClient();

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      // Column may not exist yet — fallback to email check
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }

    if (!profile?.is_super_admin) {
      if (SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    }
    return { id: user.id, email: profile.email };
  } catch {
    if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
      return { id: user.id, email: user.email || "" };
    }
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   TELEMETRY HEALTH STATS (Top-Level Metrics)
   ═══════════════════════════════════════════════════════════════ */

export async function getTelemetryHealthStats() {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Time boundaries
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const h1 = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      total24h,
      fatal24h,
      unresolved,
      affectedOrgs,
      totalAllTime,
      last1h,
    ] = await Promise.all([
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", h24),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", h24).eq("severity", "fatal"),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).eq("status", "unresolved"),
      admin.from("telemetry_events").select("organization_id").gte("event_timestamp", h24).eq("status", "unresolved").not("organization_id", "is", null),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", h1),
    ]);

    // Unique affected orgs
    const uniqueOrgs = new Set((affectedOrgs.data || []).map((r: any) => r.organization_id));

    // Crash-free sessions estimate (simplified)
    // If we have N fatal in 24h out of total sessions, crash-free = (1 - fatal/total) * 100
    const totalEvents = total24h.count || 0;
    const fatalCount = fatal24h.count || 0;
    const crashFreeRate = totalEvents > 0
      ? ((1 - fatalCount / Math.max(totalEvents, 1)) * 100).toFixed(2)
      : "100.00";

    return {
      data: {
        crash_free_rate: parseFloat(crashFreeRate),
        total_events_24h: totalEvents,
        fatal_events_24h: fatalCount,
        unresolved_count: unresolved.count || 0,
        affected_workspaces: uniqueOrgs.size,
        events_last_hour: last1h.count || 0,
        total_all_time: totalAllTime.count || 0,
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   TELEMETRY EVENT LIST (Incident Matrix)
   ═══════════════════════════════════════════════════════════════ */

export async function listTelemetryEvents(params?: {
  limit?: number;
  offset?: number;
  severity?: string;
  status?: string;
  search?: string;
  platform?: string;
  orgId?: string;
}) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    let query = admin
      .from("telemetry_events")
      .select("*", { count: "exact" })
      .order("event_timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.severity) query = query.eq("severity", params.severity);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.platform) query = query.eq("platform", params.platform);
    if (params?.orgId) query = query.eq("organization_id", params.orgId);
    if (params?.search) {
      query = query.or(
        `error_message.ilike.%${params.search}%,error_name.ilike.%${params.search}%,route.ilike.%${params.search}%,user_email.ilike.%${params.search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return err(error.message);

    const rows = (data || []).map((row) => normalizeTelemetryRow(row));
    return { data: { rows, total: count || 0 }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   TELEMETRY EVENT DETAIL (Deep Dive Autopsy)
   ═══════════════════════════════════════════════════════════════ */

export async function getTelemetryEventDetail(eventId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("telemetry_events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (error) return err(error.message);
    if (!data) return err("Event not found");

    // If there's a screenshot, generate a signed URL
    let screenshotUrl: string | null = null;
    if (data.screenshot_path) {
      const path = data.screenshot_path.replace("telemetry_snapshots/", "");
      const { data: urlData } = await admin.storage
        .from("telemetry_snapshots")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (urlData?.signedUrl) {
        screenshotUrl = urlData.signedUrl;
      }
    }

    const normalized = normalizeTelemetryRow(data);
    return { data: { ...normalized, screenshot_url: screenshotUrl }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE TELEMETRY EVENT STATUS
   ═══════════════════════════════════════════════════════════════ */

export async function updateTelemetryEventStatus(
  eventId: string,
  status: "unresolved" | "investigating" | "resolved" | "ignored",
  notes?: string
) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    const updates: Record<string, any> = { status };
    if (status === "resolved") {
      updates.resolved_by = caller.id;
      updates.resolved_at = new Date().toISOString();
      updates.resolution_notes = notes || null;
    }

    const { data, error } = await admin
      .from("telemetry_events")
      .update(updates)
      .eq("id", eventId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    // Audit the resolution
    await admin.from("super_admin_audit_logs").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action_type: `TELEMETRY_${status.toUpperCase()}`,
      target_table: "telemetry_events",
      target_record_id: eventId,
      mutation_payload: { status, notes },
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SEVERITY BREAKDOWN (For the pulse indicator)
   ═══════════════════════════════════════════════════════════════ */

export async function getTelemetrySeverityBreakdown(hours = 24) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const [info, warning, fatal] = await Promise.all([
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", since).eq("severity", "info"),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", since).eq("severity", "warning"),
      admin.from("telemetry_events").select("id", { count: "exact", head: true }).gte("event_timestamp", since).eq("severity", "fatal"),
    ]);

    return {
      data: {
        info: info.count || 0,
        warning: warning.count || 0,
        fatal: fatal.count || 0,
        total: (info.count || 0) + (warning.count || 0) + (fatal.count || 0),
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ROUTE ERROR HOTSPOTS (Group errors by route)
   ═══════════════════════════════════════════════════════════════ */

export async function getRouteErrorHotspots(limit = 10) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get recent events grouped manually (Supabase doesn't support GROUP BY directly)
    const { data, error } = await admin
      .from("telemetry_events")
      .select("route, severity, error_name")
      .gte("event_timestamp", d7)
      .not("route", "is", null)
      .order("event_timestamp", { ascending: false })
      .limit(500);

    if (error) return err(error.message);

    // Group by route
    const routeMap = new Map<string, { count: number; fatal: number; routes: Set<string> }>();
    for (const row of data || []) {
      const route = row.route || "unknown";
      const existing = routeMap.get(route) || { count: 0, fatal: 0, routes: new Set() };
      existing.count++;
      if (row.severity === "fatal") existing.fatal++;
      if (row.error_name) existing.routes.add(row.error_name);
      routeMap.set(route, existing);
    }

    const hotspots = Array.from(routeMap.entries())
      .map(([route, stats]) => ({
        route,
        total_errors: stats.count,
        fatal_errors: stats.fatal,
        unique_errors: stats.routes.size,
        error_types: Array.from(stats.routes).slice(0, 3),
      }))
      .sort((a, b) => b.total_errors - a.total_errors)
      .slice(0, limit);

    return { data: hotspots, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}
