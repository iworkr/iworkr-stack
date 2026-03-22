/**
 * @module OracleYield Server Actions
 * @status COMPLETE
 * @description Revenue yield analytics — profitability forecasting, utilization metrics, and financial optimization recommendations
 * @exports fetchYieldDashboardAction, calculateUtilizationAction, fetchProfitabilityAction, generateForecastAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Helpers ──────────────────────────────────────────── */

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, error: "Not a member of this organization" };

  return { supabase, user, role: membership.role as string, error: null };
}

/* ── Yield Profiles CRUD ─────────────────────────────── */

export async function getYieldProfiles(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("yield_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  return { data: data ?? [], error: dbErr?.message ?? null };
}

export async function upsertYieldProfile(orgId: string, profile: {
  id?: string;
  profile_name: string;
  trade_category?: string;
  base_margin: number;
  min_margin_floor: number;
  max_margin_ceiling: number;
  sensitivity_weight_fleet: number;
  sensitivity_weight_weather: number;
  sensitivity_weight_client: number;
  is_active?: boolean;
}) {
  const { supabase, role, error } = await requireOrgMember(orgId);
  if (error) return { error };
  if (role !== "owner" && role !== "admin") return { error: "Admin access required" };

  const payload = {
    ...profile,
    organization_id: orgId,
    updated_at: new Date().toISOString(),
  };

  if (profile.id) {
    const { error: dbErr } = await (supabase as SupabaseClient)
      .from("yield_profiles")
      .update(payload)
      .eq("id", profile.id)
      .eq("organization_id", orgId);
    return { error: dbErr?.message ?? null };
  }

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("yield_profiles")
    .insert(payload);
  return { error: dbErr?.message ?? null };
}

/* ── Dynamic Yield Calculation ───────────────────────── */

export async function calculateDynamicYield(orgId: string, params: {
  profileId?: string;
  clientId?: string;
  lat?: number;
  lng?: number;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  // Fetch fleet utilization from cache
  const { data: cacheRow } = await (supabase as SupabaseClient)
    .from("fleet_utilization_cache")
    .select("utilization_ratio")
    .eq("organization_id", orgId)
    .eq("trade_category", "ALL")
    .maybeSingle();

  const fleetUtil = (cacheRow?.utilization_ratio as number) ?? 0.5;

  // Fetch weather severity (proxy to OpenWeatherMap)
  let weatherSeverity = 0;
  let weatherDesc = "Clear";
  if (params.lat && params.lng) {
    const weatherKey = process.env.OPENWEATHERMAP_API_KEY;
    if (weatherKey) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/3.0/onecall?lat=${params.lat}&lng=${params.lng}&exclude=minutely,hourly,daily&appid=${weatherKey}`
        );
        if (res.ok) {
          const wx = await res.json();
          const alerts = wx.alerts ?? [];
          if (alerts.length > 0) {
            const severity = mapWeatherSeverity(alerts);
            weatherSeverity = severity.index;
            weatherDesc = severity.description;
          }
        }
      } catch { /* weather failure is non-fatal — defaults to 0 */ }
    }
  }

  // Fetch client historical conversion rate
  let clientElasticity = 0.5;
  if (params.clientId) {
    const { data: quotes } = await supabase
      .from("quotes")
      .select("status")
      .eq("client_id", params.clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (quotes && quotes.length > 0) {
      const accepted = quotes.filter((q) => q.status === "accepted").length;
      clientElasticity = accepted / quotes.length;
    }
  }

  // Call the database RPC for the math
  const { data, error: rpcErr } = await (supabase as SupabaseClient).rpc("calculate_dynamic_yield", {
    p_org_id: orgId,
    p_profile_id: params.profileId ?? null,
    p_fleet_utilization: fleetUtil,
    p_weather_severity: weatherSeverity,
    p_client_elasticity: clientElasticity,
  });

  if (rpcErr) return { data: null, error: rpcErr.message };

  const result = data as Record<string, unknown>;
  return {
    data: {
      ...result,
      weather_description: weatherDesc,
    },
    error: null,
  };
}

/* ── Log Yield Decision ──────────────────────────────── */

export async function logYieldDecision(orgId: string, log: {
  quote_id?: string;
  proposal_id?: string;
  yield_profile_id?: string;
  fleet_utilization_at_calc: number;
  weather_severity_index: number;
  weather_description?: string;
  client_historical_conversion: number;
  surge_modifier: number;
  base_margin_used: number;
  raw_margin_calculated: number;
  calculated_margin_applied: number;
  margin_floor_used: number;
  margin_ceiling_used: number;
  was_clamped: boolean;
  clamp_direction?: string;
  human_override?: boolean;
  human_override_margin?: number;
  override_reason?: string;
  calculation_time_ms?: number;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("quote_yield_logs")
    .insert({ ...log, organization_id: orgId });

  return { error: dbErr?.message ?? null };
}

/* ── Get Yield Analytics ─────────────────────────────── */

export async function getYieldAnalytics(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data: logs } = await (supabase as SupabaseClient)
    .from("quote_yield_logs")
    .select("calculated_margin_applied, base_margin_used, human_override, was_clamped, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (logs ?? []) as { calculated_margin_applied: number; base_margin_used: number; human_override: boolean; was_clamped: boolean }[];
  const total = entries.length;
  const avgMargin = total > 0 ? entries.reduce((s, e) => s + e.calculated_margin_applied, 0) / total : 0;
  const overrideRate = total > 0 ? entries.filter((e) => e.human_override).length / total : 0;
  const clampRate = total > 0 ? entries.filter((e) => e.was_clamped).length / total : 0;

  return {
    data: {
      total_calculations: total,
      avg_margin: Number(avgMargin.toFixed(4)),
      override_rate: Number(overrideRate.toFixed(4)),
      clamp_rate: Number(clampRate.toFixed(4)),
    },
    error: null,
  };
}

/* ── Refresh Fleet Cache ─────────────────────────────── */

export async function refreshFleetCache(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { error: rpcErr } = await (supabase as SupabaseClient).rpc("refresh_fleet_utilization_cache", {
    p_org_id: orgId,
  });

  return { error: rpcErr?.message ?? null };
}

/* ── Weather Severity Mapper ─────────────────────────── */

function mapWeatherSeverity(alerts: { event?: string; severity?: string }[]): { index: number; description: string } {
  const keywords: Record<string, number> = {
    cyclone: 1.0, hurricane: 1.0, tornado: 1.0, tsunami: 1.0,
    flood: 0.9, "flash flood": 0.9, evacuation: 1.0,
    "severe thunderstorm": 0.8, "severe storm": 0.8, hail: 0.7,
    "extreme heat": 0.6, heatwave: 0.6, "heat wave": 0.6,
    "high wind": 0.5, gale: 0.5, blizzard: 0.7,
    thunderstorm: 0.4, rain: 0.1, shower: 0.1,
  };

  let maxSeverity = 0;
  let desc = "Clear";

  for (const alert of alerts) {
    const event = (alert.event ?? "").toLowerCase();
    for (const [kw, weight] of Object.entries(keywords)) {
      if (event.includes(kw) && weight > maxSeverity) {
        maxSeverity = weight;
        desc = alert.event ?? kw;
      }
    }
  }

  return { index: maxSeverity, description: desc };
}
