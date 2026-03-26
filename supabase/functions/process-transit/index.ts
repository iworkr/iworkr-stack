/**
 * @module process-transit
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() validates calling user
 * @description Project Astrolabe/Orion: GPS transit claim processor with route arbitration, variance fraud lock, and MMM zoning cap for travel billing
 * @dependencies Mapbox Directions API, Google Maps Distance Matrix API, Supabase
 * @lastAudit 2026-03-22
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const ENGINE_VERSION = "astrolabe-v1";
const GRACE_PERIOD_SECONDS = 10 * 60;       // 10-minute grace for traffic/parking
const DISTANCE_VARIANCE_THRESHOLD_PERCENT = 15;
const NON_LABOR_RATE_PER_KM = 0.97;         // NDIS Schedule 2024-25 $/km
const LABOR_RATE_PER_MINUTE = 0.7342;       // ~$44.05/hr Level 2.1 SCHADS base / 60

// NDIS Provider Travel codes (2024-25 Support Catalogue)
const NDIS_LABOR_CODE = "01_799_0104_1_1";
const NDIS_NON_LABOR_CODE = "01_799_0104_1_1_KM";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TransitPayload {
  organization_id: string;
  worker_id: string;
  transit_type: "PROVIDER_TRAVEL" | "PARTICIPANT_TRANSPORT";
  origin_shift_id?: string;
  destination_shift_id?: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  device_start_time: string;
  device_end_time: string;
  claimed_distance_km?: number;
  route_polyline?: string;
  device_os?: string;
  app_version?: string;
}

interface GoogleDistanceResult {
  distanceMeters: number;
  durationSeconds: number;
  source: "mapbox_directions" | "google_maps" | "haversine";
}

interface MmmZone {
  zone_class: string;
  zone_name: string;
  max_travel_minutes: number;
}

async function callMapboxDirections(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<GoogleDistanceResult | null> {
  const token = Deno.env.get("MAPBOX_ACCESS_TOKEN") ?? Deno.env.get("NEXT_PUBLIC_MAPBOX_TOKEN");
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=polyline&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      source: "mapbox_directions",
    };
  } catch {
    return null;
  }
}

// ─── Google Maps Distance Matrix ───────────────────────────────────────────────
async function callGoogleDistanceMatrix(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<GoogleDistanceResult> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.warn("[Astrolabe] No Google Maps API key — falling back to Haversine");
    return haversineFallback(startLat, startLng, endLat, endLng);
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${startLat},${startLng}` +
      `&destinations=${endLat},${endLng}` +
      `&mode=driving&units=metric` +
      `&key=${apiKey}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (
      data.status === "OK" &&
      data.rows?.[0]?.elements?.[0]?.status === "OK"
    ) {
      const el = data.rows[0].elements[0];
      return {
        distanceMeters: el.distance.value,
        durationSeconds: el.duration.value,
        source: "google_maps",
      };
    }

    console.warn("[Astrolabe] Google Maps non-OK status:", data.status);
  } catch (err) {
    console.error("[Astrolabe] Google Maps API error:", err);
  }

  return haversineFallback(startLat, startLng, endLat, endLng);
}

async function callBestRouteDistance(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<GoogleDistanceResult> {
  const mapbox = await callMapboxDirections(startLat, startLng, endLat, endLng);
  if (mapbox) return mapbox;
  return callGoogleDistanceMatrix(startLat, startLng, endLat, endLng);
}

// Haversine fallback — bird-flight distance at ~40 km/h average driving speed
function haversineFallback(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): GoogleDistanceResult {
  const R = 6371000; // earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const distanceMeters = 2 * R * Math.asin(Math.sqrt(a));
  const durationSeconds = Math.round((distanceMeters / 1000 / 40) * 3600); // 40 km/h

  return { distanceMeters: Math.round(distanceMeters), durationSeconds, source: "haversine" };
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: CORS,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role for DB writes (the function validates auth separately)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT to get the calling user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: CORS,
      });
    }

    // ── Parse payload ─────────────────────────────────────────────────────────
    const body: TransitPayload = await req.json();

    const {
      organization_id, worker_id, transit_type,
      origin_shift_id, destination_shift_id,
      start_lat, start_lng, end_lat, end_lng,
      device_start_time, device_end_time,
      claimed_distance_km,
      route_polyline, device_os, app_version,
    } = body;

    if (!organization_id || !worker_id || !start_lat || !start_lng || !end_lat || !end_lng) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: CORS,
      });
    }

    // ── Step 1: Insert raw travel log (the PostGIS spatial truth) ─────────────
    const { data: logData, error: logError } = await supabase
      .from("travel_logs")
      .insert({
        organization_id,
        worker_id,
        transit_type,
        origin_shift_id: origin_shift_id ?? null,
        destination_shift_id: destination_shift_id ?? null,
        start_geom: `SRID=4326;POINT(${start_lng} ${start_lat})`,
        end_geom: `SRID=4326;POINT(${end_lng} ${end_lat})`,
        device_start_time,
        device_end_time,
        // Only store route polyline for PARTICIPANT_TRANSPORT (privacy protection)
        route_polyline: transit_type === "PARTICIPANT_TRANSPORT" ? (route_polyline ?? null) : null,
        device_os: device_os ?? null,
        app_version: app_version ?? null,
        raw_payload: body,
      })
      .select("id")
      .single();

    if (logError || !logData) {
      console.error("[Astrolabe] travel_logs insert error:", logError);
      return new Response(JSON.stringify({ error: "Failed to persist travel log", detail: logError?.message }), {
        status: 500, headers: CORS,
      });
    }

    const travelLogId = logData.id as string;

    // ── Step 2: Route Arbitration (Mapbox first, Google fallback, then Haversine)
    const routing = await callBestRouteDistance(start_lat, start_lng, end_lat, end_lng);

    // ── Step 3: Variance Lock (Fraud Prevention) ──────────────────────────────
    const deviceStartMs = new Date(device_start_time).getTime();
    const deviceEndMs = new Date(device_end_time).getTime();
    const actualDurationSeconds = Math.round((deviceEndMs - deviceStartMs) / 1000);
    const varianceSeconds = actualDurationSeconds - routing.durationSeconds;
    const calculatedDistanceKm = Math.round((routing.distanceMeters / 1000) * 1000) / 1000;
    const variancePercentage =
      claimed_distance_km && calculatedDistanceKm > 0
        ? Math.abs(((claimed_distance_km - calculatedDistanceKm) / calculatedDistanceKm) * 100)
        : null;

    let billableLaborSeconds = routing.durationSeconds;
    let claimStatus: string;
    let flaggedReason: string | null = null;

    if (varianceSeconds > GRACE_PERIOD_SECONDS) {
      // Worker took significantly longer — cap at API estimate (fraud prevention)
      claimStatus = "FLAGGED_VARIANCE";
      flaggedReason = `Actual transit (${Math.round(actualDurationSeconds / 60)} min) exceeded API estimate (${Math.round(routing.durationSeconds / 60)} min) by ${Math.round(varianceSeconds / 60)} minutes. Capped at API estimate.`;
      billableLaborSeconds = routing.durationSeconds;
    } else {
      // Within tolerance — use actual time (may be slightly > API due to traffic)
      claimStatus = "VERIFIED_CLEAN";
      billableLaborSeconds = Math.min(actualDurationSeconds, routing.durationSeconds + GRACE_PERIOD_SECONDS);
    }

    if (variancePercentage != null && variancePercentage > DISTANCE_VARIANCE_THRESHOLD_PERCENT) {
      claimStatus = "FLAGGED_VARIANCE";
      const distanceNote = `Claimed ${claimed_distance_km?.toFixed(2)} km vs calculated ${calculatedDistanceKm.toFixed(2)} km (${variancePercentage.toFixed(1)}% variance; threshold ${DISTANCE_VARIANCE_THRESHOLD_PERCENT}%).`;
      flaggedReason = flaggedReason ? `${flaggedReason} ${distanceNote}` : distanceNote;
    }

    // ── Step 4: MMM Zoning Cap ────────────────────────────────────────────────
    // Check destination coordinates against NDIS Modified Monash Model zones
    let mmmZone: string | null = null;
    let mmmCapMinutes = 30; // default to metro cap

    const { data: zoneData } = await supabase.rpc("get_mmm_zone_for_point", {
      p_lat: end_lat,
      p_lng: end_lng,
    });

    if (zoneData && zoneData.length > 0) {
      const zone = zoneData[0] as MmmZone;
      mmmZone = zone.zone_class;
      mmmCapMinutes = zone.max_travel_minutes;
    }

    // Apply MMM cap
    const mmmCapSeconds = mmmCapMinutes * 60;
    if (billableLaborSeconds > mmmCapSeconds) {
      const originalMinutes = Math.round(billableLaborSeconds / 60);
      billableLaborSeconds = mmmCapSeconds;
      if (claimStatus !== "FLAGGED_VARIANCE") {
        // Only update flag if not already flagged for variance
        claimStatus = "VERIFIED_CLEAN"; // Still clean — MMM cap is expected
      }
      const capNote = `MMM zone ${mmmZone ?? "unknown"} cap applied: ${originalMinutes} min → ${mmmCapMinutes} min.`;
      flaggedReason = flaggedReason ? `${flaggedReason} ${capNote}` : capNote;
    }

    const billableLaborMinutes = Math.ceil(billableLaborSeconds / 60);
    const billableNonLaborKm = Math.round((routing.distanceMeters / 1000) * 100) / 100;

    // ── Step 5: Calculate Financial Values ────────────────────────────────────
    const calculatedLaborCost = parseFloat(
      (billableLaborMinutes * LABOR_RATE_PER_MINUTE).toFixed(2)
    );
    const calculatedNonLaborCost = parseFloat(
      (billableNonLaborKm * NON_LABOR_RATE_PER_KM).toFixed(2)
    );

    // ── Step 6: Fetch origin/destination labels for UI display ────────────────
    let originLabel = "Unknown origin";
    let destinationLabel = "Unknown destination";
    let workerName = "Worker";

    const [originShift, destShift, workerProfile] = await Promise.all([
      origin_shift_id
        ? supabase
            .from("schedule_blocks")
            .select("title, client_name")
            .eq("id", origin_shift_id)
            .single()
        : Promise.resolve({ data: null }),
      destination_shift_id
        ? supabase
            .from("schedule_blocks")
            .select("title, client_name")
            .eq("id", destination_shift_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", worker_id)
        .single(),
    ]);

    if (originShift.data) {
      originLabel = (originShift.data as any).title ?? (originShift.data as any).client_name ?? originLabel;
    }
    if (destShift.data) {
      destinationLabel = (destShift.data as any).title ?? (destShift.data as any).client_name ?? destinationLabel;
    }
    if (workerProfile.data) {
      workerName = (workerProfile.data as any).full_name ?? workerName;
    }

    // ── Step 7: Insert verified travel claim ──────────────────────────────────
    const { data: claimData, error: claimError } = await supabase
      .from("travel_claims")
      .insert({
        organization_id,
        workspace_id: organization_id,
        travel_log_id: travelLogId,
        start_geom: `SRID=4326;POINT(${start_lng} ${start_lat})`,
        end_geom: `SRID=4326;POINT(${end_lng} ${end_lat})`,
        worker_id,
        api_verified_distance_meters: routing.distanceMeters,
        api_verified_duration_seconds: routing.durationSeconds,
        api_source: routing.source,
        claimed_distance_km: claimed_distance_km ?? null,
        calculated_distance_km: calculatedDistanceKm,
        variance_percentage: variancePercentage != null ? Number(variancePercentage.toFixed(3)) : null,
        orion_status:
          claimStatus === "FLAGGED_VARIANCE"
            ? "FLAGGED"
            : claimStatus === "BILLED"
              ? "BILLED"
              : claimStatus === "APPROVED" || claimStatus === "OVERRIDDEN"
                ? "APPROVED"
                : "PENDING",
        mmm_zone: mmmZone,
        mmm_zone_cap_minutes: mmmCapMinutes,
        actual_duration_seconds: actualDurationSeconds,
        variance_seconds: varianceSeconds,
        grace_period_seconds: GRACE_PERIOD_SECONDS,
        billable_labor_minutes: billableLaborMinutes,
        billable_non_labor_km: billableNonLaborKm,
        ndis_labor_code: NDIS_LABOR_CODE,
        ndis_non_labor_code: NDIS_NON_LABOR_CODE,
        labor_rate_per_minute: LABOR_RATE_PER_MINUTE,
        non_labor_rate_per_km: NON_LABOR_RATE_PER_KM,
        calculated_labor_cost: calculatedLaborCost,
        calculated_non_labor_cost: calculatedNonLaborCost,
        status: claimStatus,
        flagged_reason: flaggedReason,
        origin_label: originLabel,
        destination_label: destinationLabel,
        worker_name: workerName,
        engine_version: ENGINE_VERSION,
      })
      .select("id, total_claim_value")
      .single();

    if (claimError || !claimData) {
      console.error("[Astrolabe] travel_claims insert error:", claimError);
      return new Response(JSON.stringify({ error: "Failed to persist travel claim", detail: claimError?.message }), {
        status: 500, headers: CORS,
      });
    }

    // ── Step 8: Return result ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok: true,
        travel_log_id: travelLogId,
        claim_id: (claimData as any).id,
        status: claimStatus,
        billable_labor_minutes: billableLaborMinutes,
        billable_non_labor_km: billableNonLaborKm,
        calculated_labor_cost: calculatedLaborCost,
        calculated_non_labor_cost: calculatedNonLaborCost,
        total_claim_value: (claimData as any).total_claim_value,
        api_distance_meters: routing.distanceMeters,
        api_duration_seconds: routing.durationSeconds,
        claimed_distance_km: claimed_distance_km ?? null,
        calculated_distance_km: calculatedDistanceKm,
        variance_percentage: variancePercentage,
        variance_seconds: varianceSeconds,
        mmm_zone: mmmZone,
        flagged_reason: flaggedReason,
        engine_version: ENGINE_VERSION,
      }),
      { headers: CORS },
    );
  } catch (err) {
    console.error("[Astrolabe] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: CORS },
    );
  }
});
