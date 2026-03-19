// Edge Function: calculate-dynamic-yield
// Computes dynamic margin pricing using fleet utilization, weather severity,
// and client elasticity — with strict gouging-prevention clamps.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENWEATHER_KEY = Deno.env.get("OPENWEATHERMAP_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WeatherAlert {
  event?: string;
  severity?: string;
  description?: string;
}

const SEVERITY_MAP: Record<string, number> = {
  cyclone: 1.0, hurricane: 1.0, tornado: 1.0, tsunami: 1.0,
  evacuation: 1.0, "flash flood": 0.9, flood: 0.9,
  "severe thunderstorm": 0.8, "severe storm": 0.8,
  hail: 0.7, blizzard: 0.7,
  "extreme heat": 0.6, heatwave: 0.6, "heat wave": 0.6,
  "high wind": 0.5, gale: 0.5,
  thunderstorm: 0.4,
  "heavy rain": 0.3,
  rain: 0.1, shower: 0.1, drizzle: 0.05,
};

function mapWeatherSeverity(
  alerts: WeatherAlert[]
): { index: number; description: string } {
  let max = 0;
  let desc = "Clear";

  for (const alert of alerts) {
    const event = (alert.event ?? "").toLowerCase();
    for (const [keyword, weight] of Object.entries(SEVERITY_MAP)) {
      if (event.includes(keyword) && weight > max) {
        max = weight;
        desc = alert.event ?? keyword;
      }
    }
  }
  return { index: max, description: desc };
}

async function fetchWeather(
  lat: number,
  lng: number
): Promise<{ index: number; description: string }> {
  if (!OPENWEATHER_KEY) return { index: 0, description: "No API key" };

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,daily&appid=${OPENWEATHER_KEY}`
    );
    if (!res.ok) return { index: 0, description: "API error" };

    const data = await res.json();
    const alerts: WeatherAlert[] = data.alerts ?? [];
    if (alerts.length === 0) return { index: 0, description: "Clear" };
    return mapWeatherSeverity(alerts);
  } catch {
    return { index: 0, description: "Fetch failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    const body = await req.json();
    const {
      organization_id,
      profile_id,
      client_id,
      lat,
      lng,
      quote_id,
      proposal_id,
    } = body as {
      organization_id: string;
      profile_id?: string;
      client_id?: string;
      lat?: number;
      lng?: number;
      quote_id?: string;
      proposal_id?: string;
    };

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 1. Get yield profile ──────────────────────────────
    let profileQuery = supabase
      .from("yield_profiles")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("is_active", true);

    if (profile_id) {
      profileQuery = profileQuery.eq("id", profile_id);
    }

    const { data: profiles } = await profileQuery.limit(1);
    const profile = profiles?.[0];

    if (!profile) {
      return new Response(
        JSON.stringify({
          margin: 0.4,
          surge_modifier: 0,
          was_clamped: false,
          error: "No active yield profile — using 40% default",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Fleet utilization from cache ───────────────────
    const { data: cacheRow } = await supabase
      .from("fleet_utilization_cache")
      .select("utilization_ratio, calculated_at")
      .eq("organization_id", organization_id)
      .eq("trade_category", profile.trade_category ?? "ALL")
      .maybeSingle();

    const fleetUtil: number = cacheRow?.utilization_ratio ?? 0.5;

    // If cache is older than 30 minutes, trigger async refresh
    if (
      !cacheRow ||
      Date.now() - new Date(cacheRow.calculated_at).getTime() > 30 * 60 * 1000
    ) {
      supabase.rpc("refresh_fleet_utilization_cache", {
        p_org_id: organization_id,
      }).then(() => {});
    }

    // ── 3. Weather severity ───────────────────────────────
    let weatherSeverity = 0;
    let weatherDesc = "Clear";
    if (lat != null && lng != null) {
      const wx = await fetchWeather(lat, lng);
      weatherSeverity = wx.index;
      weatherDesc = wx.description;
    }

    // ── 4. Client elasticity ──────────────────────────────
    let clientElasticity = 0.5;
    if (client_id) {
      const { data: quotes } = await supabase
        .from("quotes")
        .select("status")
        .eq("client_id", client_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (quotes && quotes.length > 0) {
        const accepted = quotes.filter(
          (q: { status: string }) => q.status === "accepted"
        ).length;
        clientElasticity = accepted / quotes.length;
      }
    }

    // ── 5. Calculate surge modifier ───────────────────────
    const alpha: number = profile.sensitivity_weight_fleet;
    const beta: number = profile.sensitivity_weight_weather;
    const gamma: number = profile.sensitivity_weight_client;

    const surgeModifier = alpha * fleetUtil + beta * weatherSeverity + gamma * clientElasticity;
    const rawMargin = profile.base_margin * (1 + surgeModifier);

    // ── 6. Cryptographic clamp ────────────────────────────
    let finalMargin = rawMargin;
    let wasClamped = false;
    let clampDirection: string | null = null;

    if (finalMargin > profile.max_margin_ceiling) {
      finalMargin = profile.max_margin_ceiling;
      wasClamped = true;
      clampDirection = "ceiling";
    } else if (finalMargin < profile.min_margin_floor) {
      finalMargin = profile.min_margin_floor;
      wasClamped = true;
      clampDirection = "floor";
    }

    const calcTimeMs = Date.now() - startMs;

    // ── 7. Persist audit log ──────────────────────────────
    const logPayload = {
      organization_id,
      quote_id: quote_id ?? null,
      proposal_id: proposal_id ?? null,
      yield_profile_id: profile.id,
      fleet_utilization_at_calc: fleetUtil,
      weather_severity_index: weatherSeverity,
      weather_description: weatherDesc,
      client_historical_conversion: clientElasticity,
      surge_modifier: surgeModifier,
      base_margin_used: profile.base_margin,
      raw_margin_calculated: rawMargin,
      calculated_margin_applied: finalMargin,
      margin_floor_used: profile.min_margin_floor,
      margin_ceiling_used: profile.max_margin_ceiling,
      was_clamped: wasClamped,
      clamp_direction: clampDirection,
      human_override: false,
      calculation_time_ms: calcTimeMs,
    };

    await supabase.from("quote_yield_logs").insert(logPayload);

    // ── 8. Return result ──────────────────────────────────
    return new Response(
      JSON.stringify({
        margin: Number(finalMargin.toFixed(4)),
        base_margin: profile.base_margin,
        surge_modifier: Number(surgeModifier.toFixed(4)),
        raw_margin: Number(rawMargin.toFixed(4)),
        fleet_utilization: fleetUtil,
        weather_severity: weatherSeverity,
        weather_description: weatherDesc,
        client_elasticity: clientElasticity,
        was_clamped: wasClamped,
        clamp_direction: clampDirection,
        margin_floor: profile.min_margin_floor,
        margin_ceiling: profile.max_margin_ceiling,
        profile_id: profile.id,
        profile_name: profile.profile_name,
        calculation_time_ms: calcTimeMs,
        log_id: logPayload.quote_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
