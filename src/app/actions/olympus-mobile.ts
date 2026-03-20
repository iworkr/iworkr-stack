"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type MobileTelemetryRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  url_path: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
};

export type MobileStatsResult = {
  dauToday: number;
  mauMonth: number;
  avgSessionSeconds: number | null;
  distinctVersionCount: number;
  /** DAU per calendar day (UTC), last 30 days — padded with zeros */
  dau: { date: string; count: number }[];
  screens: { screen: string; count: number }[];
  versions: { version: string; count: number }[];
  sessions: {
    user_id: string | null;
    url_path: string | null;
    duration_ms: number | null;
    created_at: string;
    user_agent: string | null;
  }[];
};

const EMPTY: MobileStatsResult = {
  dauToday: 0,
  mauMonth: 0,
  avgSessionSeconds: null,
  distinctVersionCount: 0,
  dau: [],
  screens: [],
  versions: [],
  sessions: [],
};

async function verifySuperAdmin() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminSupabaseClient();
    const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];

    try {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, email, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
          return { id: user.id, email: user.email || "" };
        }
        return null;
      }

      if (
        profile?.is_super_admin ||
        SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")
      ) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    } catch {
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }
  } catch {
    return null;
  }
}

function isMobileTelemetryRow(row: {
  user_agent: string | null;
  payload: unknown;
}): boolean {
  const ua = (row.user_agent ?? "").toLowerCase();
  if (ua.includes("dart") || ua.includes("flutter")) return true;
  const p = row.payload as Record<string, unknown> | null;
  const plat = typeof p?.platform === "string" ? p.platform : "";
  if (plat === "mobile_ios" || plat === "mobile_android") return true;
  return false;
}

function extractDurationMs(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const candidates = [
    p.session_duration_ms,
    p.duration_ms,
    p.session_duration,
    p.screen_time_ms,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    if (typeof c === "string" && c.trim() !== "") {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function appVersionFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown";
  const p = payload as Record<string, unknown>;
  const v = p.app_version ?? p.version ?? p.appVersion;
  if (typeof v === "string" && v.trim()) return v.trim();
  return "unknown";
}

const SELECT =
  "id, created_at, user_id, url_path, user_agent, payload";

/**
 * Merged fetch: Flutter/Dart user-agents OR payload.platform mobile stores.
 * Dedupes by row id. Uses two queries to avoid missing payload-only rows.
 */
async function fetchMobileTelemetryRows(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  sinceIso: string,
  limitPerQuery = 4000,
): Promise<MobileTelemetryRow[]> {
  const [uaRes, platRes] = await Promise.all([
    admin
      .from("system_telemetry")
      .select(SELECT)
      .gte("created_at", sinceIso)
      .or("user_agent.ilike.%Dart%,user_agent.ilike.%Flutter%")
      .order("created_at", { ascending: false })
      .limit(limitPerQuery),
    admin
      .from("system_telemetry")
      .select(SELECT)
      .gte("created_at", sinceIso)
      .or("payload->>platform.eq.mobile_ios,payload->>platform.eq.mobile_android")
      .order("created_at", { ascending: false })
      .limit(limitPerQuery),
  ]);

  if (uaRes.error) console.error("[olympus-mobile] UA query:", uaRes.error);
  if (platRes.error) console.error("[olympus-mobile] platform query:", platRes.error);

  const map = new Map<string, MobileTelemetryRow>();
  for (const row of [...(uaRes.data ?? []), ...(platRes.data ?? [])]) {
    const r = row as MobileTelemetryRow;
    if (!isMobileTelemetryRow(r)) continue;
    map.set(r.id, r);
  }
  return Array.from(map.values());
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function padDauSeries(
  rows: MobileTelemetryRow[],
  dayCount: number,
): { date: string; count: number }[] {
  const now = new Date();
  const series: { date: string; count: number }[] = [];
  const dauMap = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.user_id) continue;
    const date = row.created_at.slice(0, 10);
    if (!dauMap.has(date)) dauMap.set(date, new Set());
    dauMap.get(date)!.add(row.user_id);
  }

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = utcDateString(d);
    const set = dauMap.get(key);
    series.push({ date: key, count: set ? set.size : 0 });
  }
  return series;
}

export async function getMobileStats(
  days = 30,
): Promise<MobileStatsResult | { error: string }> {
  const caller = await verifySuperAdmin();
  if (!caller) return { error: "Unauthorized" };

  const admin = createAdminSupabaseClient();
  const now = Date.now();
  const since = new Date(now - days * 86400_000).toISOString();
  const since30 = new Date(now - 30 * 86400_000).toISOString();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const sinceMonth = monthStart.toISOString();

  const todayStr = utcDateString(new Date(now));

  try {
    const [rowsRange, rows30, rowsMonth] = await Promise.all([
      fetchMobileTelemetryRows(admin, since),
      fetchMobileTelemetryRows(admin, since30),
      fetchMobileTelemetryRows(admin, sinceMonth),
    ]);

    const dau = padDauSeries(rows30, 30);

    const dauTodaySet = new Set<string>();
    for (const row of rows30) {
      if (row.created_at.slice(0, 10) === todayStr && row.user_id) {
        dauTodaySet.add(row.user_id);
      }
    }

    const mauSet = new Set<string>();
    for (const row of rowsMonth) {
      if (row.user_id) mauSet.add(row.user_id);
    }

    const screenMap = new Map<string, number>();
    const versionMap = new Map<string, number>();
    const durations: number[] = [];

    for (const row of rowsRange) {
      if (row.url_path) {
        screenMap.set(row.url_path, (screenMap.get(row.url_path) || 0) + 1);
      }
      const ver = appVersionFromPayload(row.payload);
      versionMap.set(ver, (versionMap.get(ver) || 0) + 1);
      const dur = extractDurationMs(row.payload);
      if (dur != null) durations.push(dur);
    }

    const avgSessionSeconds =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length / 1000
        : null;

    const screens = Array.from(screenMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([screen, count]) => ({ screen, count }));

    const versions = Array.from(versionMap.entries()).map(([version, count]) => ({
      version,
      count,
    }));

    const distinctVersionCount = versionMap.size;

    const sessions = [...rowsRange]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 50)
      .map((r) => ({
        user_id: r.user_id,
        url_path: r.url_path,
        duration_ms: extractDurationMs(r.payload),
        created_at: r.created_at,
        user_agent: r.user_agent,
      }));

    return {
      dauToday: dauTodaySet.size,
      mauMonth: mauSet.size,
      avgSessionSeconds,
      distinctVersionCount,
      dau,
      screens,
      versions,
      sessions,
    };
  } catch (e) {
    console.error("[olympus-mobile] getMobileStats:", e);
    return EMPTY;
  }
}
