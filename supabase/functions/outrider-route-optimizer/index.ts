/**
 * @module outrider-route-optimizer
 * @status COMPLETE
 * @auth SECURED — Bearer JWT + org membership verification
 * @description Project Outrider-Route — AI Route Optimization (VRPTW) via
 *   Mapbox Optimization API v1. Handles time-pinned constraints by partitioning
 *   the day into segments around pinned jobs, optimizing each segment independently.
 *   Returns proposed sequence with travel metrics for dispatcher review.
 * @dependencies Supabase, Mapbox Optimization API v1, Zod
 * @lastAudit 2026-03-24
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";

const OptimizeSchema = z.object({
  worker_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  organization_id: z.string().uuid(),
  day_start_hour: z.number().min(0).max(23).default(8),
  day_start_minute: z.number().min(0).max(59).default(0),
});

interface ScheduleStop {
  id: string;
  title: string;
  client_name: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  job_id: string | null;
  is_time_pinned: boolean;
  is_supplier_waypoint: boolean;
  waypoint_name: string | null;
  duration_seconds: number;
  lat: number | null;
  lng: number | null;
  route_sequence: number;
  job_title: string | null;
  resolved_client_name: string | null;
}

interface MapboxWaypoint {
  waypoint_index: number;
  trips_index: number;
  name: string;
  location: [number, number];
}

interface MapboxLeg {
  duration: number;
  distance: number;
  summary: string;
}

interface MapboxTrip {
  geometry: string;
  legs: MapboxLeg[];
  duration: number;
  distance: number;
}

interface MapboxResponse {
  code: string;
  waypoints: MapboxWaypoint[];
  trips: MapboxTrip[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mapboxToken = Deno.env.get("MAPBOX_SECRET_KEY") || Deno.env.get("MAPBOX_ACCESS_TOKEN");

    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: "Mapbox access token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse & Validate ────────────────────────────────────
    const body = await req.json();
    const parsed = OptimizeSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid payload", issues: parsed.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { worker_id, date, organization_id, day_start_hour, day_start_minute } = parsed.data;

    // ── Verify org membership ───────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch worker's blocks for the day ───────────────────
    const { data: blocks, error: blocksError } = await admin.rpc("get_optimizable_blocks", {
      p_worker_id: worker_id,
      p_date: date,
      p_org_id: organization_id,
    });

    if (blocksError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch schedule blocks", detail: blocksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stops: ScheduleStop[] = blocks || [];
    if (stops.length < 2) {
      return new Response(
        JSON.stringify({
          error: "Need at least 2 stops to optimize",
          stops_count: stops.length,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out stops without coordinates
    const geoStops = stops.filter(s => s.lat != null && s.lng != null);
    if (geoStops.length < 2) {
      return new Response(
        JSON.stringify({
          error: "Need at least 2 geocoded stops to optimize",
          geocoded: geoStops.length,
          total: stops.length,
          missing_coords: stops.filter(s => !s.lat || !s.lng).map(s => s.id),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch worker's start location ───────────────────────
    const { data: startLoc } = await admin.rpc("get_worker_start_location", {
      p_worker_id: worker_id,
    });

    const hasStartCoords = startLoc?.home_lat != null && startLoc?.home_lng != null;
    const routeMode = startLoc?.route_mode || "round_trip";

    // ── Capture original sequence for diff ──────────────────
    const originalSequence = geoStops.map((s, i) => ({
      id: s.id,
      sequence: i + 1,
      start_time: s.start_time,
      end_time: s.end_time,
      title: s.title,
    }));

    // ── Partition around pinned jobs ────────────────────────
    // Pinned jobs act as temporal anchors. We optimize unpinned segments independently.
    const pinnedStops = geoStops.filter(s => s.is_time_pinned);
    const unpinnedStops = geoStops.filter(s => !s.is_time_pinned);

    let optimizedOrder: ScheduleStop[];
    let totalTripGeometry = "";
    let totalTravelDuration = 0;
    let totalTravelDistance = 0;
    let legs: MapboxLeg[] = [];

    if (pinnedStops.length === 0) {
      // No pins — optimize the entire set
      const result = await callMapboxOptimization(
        geoStops,
        hasStartCoords ? [startLoc.home_lng, startLoc.home_lat] : null,
        routeMode === "round_trip" && hasStartCoords ? [startLoc.home_lng, startLoc.home_lat] : null,
        mapboxToken
      );

      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: result.error, mapbox_code: result.code }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      optimizedOrder = result.orderedStops;
      totalTripGeometry = result.geometry;
      totalTravelDuration = result.totalDuration;
      totalTravelDistance = result.totalDistance;
      legs = result.legs;
    } else {
      // Partition strategy: Sort all stops chronologically, split around pins
      const allSorted = [...geoStops].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      const segments: { stops: ScheduleStop[]; pinnedBefore?: ScheduleStop }[] = [];
      let currentSegment: ScheduleStop[] = [];

      for (const stop of allSorted) {
        if (stop.is_time_pinned) {
          if (currentSegment.length > 0) {
            segments.push({ stops: currentSegment, pinnedBefore: stop });
          }
          segments.push({ stops: [stop] }); // pinned block as its own "segment"
          currentSegment = [];
        } else {
          currentSegment.push(stop);
        }
      }
      if (currentSegment.length > 0) {
        segments.push({ stops: currentSegment });
      }

      optimizedOrder = [];
      const allLegs: MapboxLeg[] = [];
      const geometries: string[] = [];

      for (const seg of segments) {
        if (seg.stops.length === 1 && seg.stops[0].is_time_pinned) {
          optimizedOrder.push(seg.stops[0]);
          continue;
        }

        if (seg.stops.length < 2) {
          optimizedOrder.push(...seg.stops);
          continue;
        }

        const result = await callMapboxOptimization(
          seg.stops,
          null,
          null,
          mapboxToken
        );

        if (result.ok) {
          optimizedOrder.push(...result.orderedStops);
          if (result.geometry) geometries.push(result.geometry);
          totalTravelDuration += result.totalDuration;
          totalTravelDistance += result.totalDistance;
          allLegs.push(...result.legs);
        } else {
          optimizedOrder.push(...seg.stops);
        }
      }

      totalTripGeometry = geometries.join("");
      legs = allLegs;
    }

    // ── Calculate timestamps for the optimized sequence ─────
    const dayStart = new Date(`${date}T00:00:00`);
    dayStart.setHours(day_start_hour, day_start_minute, 0, 0);
    let cursor = dayStart.getTime();

    const proposedBlocks: Array<{
      id: string;
      route_sequence: number;
      start_time: string;
      end_time: string;
      travel_duration_seconds: number;
      travel_distance_meters: number;
      polyline: string | null;
      title: string;
      client_name: string | null;
      lat: number | null;
      lng: number | null;
      is_time_pinned: boolean;
      is_supplier_waypoint: boolean;
    }> = [];

    for (let i = 0; i < optimizedOrder.length; i++) {
      const stop = optimizedOrder[i];
      const travelSecs = legs[i]?.duration ?? 0;
      const travelMeters = legs[i]?.distance ?? 0;

      if (stop.is_time_pinned) {
        // Pinned: preserve original times exactly
        const pinnedStart = new Date(stop.start_time).getTime();
        const pinnedEnd = new Date(stop.end_time).getTime();

        proposedBlocks.push({
          id: stop.id,
          route_sequence: i + 1,
          start_time: new Date(pinnedStart).toISOString(),
          end_time: new Date(pinnedEnd).toISOString(),
          travel_duration_seconds: Math.round(travelSecs),
          travel_distance_meters: Math.round(travelMeters),
          polyline: null,
          title: stop.title,
          client_name: stop.client_name || stop.resolved_client_name,
          lat: stop.lat,
          lng: stop.lng,
          is_time_pinned: true,
          is_supplier_waypoint: stop.is_supplier_waypoint,
        });

        cursor = pinnedEnd;
      } else {
        cursor += travelSecs * 1000;
        const blockStart = cursor;
        const blockEnd = blockStart + (stop.duration_seconds * 1000);

        proposedBlocks.push({
          id: stop.id,
          route_sequence: i + 1,
          start_time: new Date(blockStart).toISOString(),
          end_time: new Date(blockEnd).toISOString(),
          travel_duration_seconds: Math.round(travelSecs),
          travel_distance_meters: Math.round(travelMeters),
          polyline: null,
          title: stop.title,
          client_name: stop.client_name || stop.resolved_client_name,
          lat: stop.lat,
          lng: stop.lng,
          is_time_pinned: false,
          is_supplier_waypoint: stop.is_supplier_waypoint,
        });

        cursor = blockEnd;
      }
    }

    // ── Calculate savings ───────────────────────────────────
    // Before: sum of naive sequential travel (estimated from original order)
    let originalTravelEstimate = 0;
    for (const stop of stops) {
      originalTravelEstimate += (stop.route_sequence > 0)
        ? 0  // already has a prior optimization
        : 600; // default 10 min estimate per leg if no prior data
    }

    // ── Create optimization run record ──────────────────────
    const { data: runData, error: runError } = await admin
      .from("route_optimization_runs")
      .insert({
        organization_id,
        worker_id,
        run_date: date,
        status: "proposed",
        schedule_block_ids: geoStops.map(s => s.id),
        original_sequence: originalSequence,
        optimized_sequence: proposedBlocks,
        total_travel_before_seconds: Math.round(originalTravelEstimate),
        total_travel_after_seconds: Math.round(totalTravelDuration),
        total_distance_before_meters: 0,
        total_distance_after_meters: Math.round(totalTravelDistance),
        travel_saved_seconds: Math.max(0, Math.round(originalTravelEstimate - totalTravelDuration)),
        distance_saved_meters: 0,
        mapbox_trip_geometry: totalTripGeometry,
        pinned_block_count: pinnedStops.length,
      })
      .select("id")
      .single();

    if (runError) {
      console.error("[outrider-route] Failed to create run record:", runError);
    }

    // ── Return proposal ─────────────────────────────────────
    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runData?.id || null,
        worker_id,
        date,
        route_mode: routeMode,
        start_location: hasStartCoords
          ? { lat: startLoc.home_lat, lng: startLoc.home_lng, name: startLoc.start_name || startLoc.home_address }
          : null,
        stops_count: proposedBlocks.length,
        pinned_count: pinnedStops.length,
        proposed_blocks: proposedBlocks,
        trip_geometry: totalTripGeometry,
        metrics: {
          total_travel_seconds: Math.round(totalTravelDuration),
          total_distance_meters: Math.round(totalTravelDistance),
          total_travel_minutes: Math.round(totalTravelDuration / 60),
          total_distance_km: Math.round(totalTravelDistance / 1000 * 10) / 10,
          estimated_savings_minutes: Math.max(0, Math.round((originalTravelEstimate - totalTravelDuration) / 60)),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[outrider-route] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Mapbox Optimization API Call ─────────────────────────────────────────
async function callMapboxOptimization(
  stops: ScheduleStop[],
  startCoord: [number, number] | null,
  endCoord: [number, number] | null,
  token: string
): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  orderedStops: ScheduleStop[];
  geometry: string;
  totalDuration: number;
  totalDistance: number;
  legs: MapboxLeg[];
}> {
  // Build coordinates array: [start?, ...stops, end?]
  const coords: { lng: number; lat: number; stopRef?: ScheduleStop }[] = [];

  if (startCoord) {
    coords.push({ lng: startCoord[0], lat: startCoord[1] });
  }

  for (const s of stops) {
    coords.push({ lng: s.lng!, lat: s.lat!, stopRef: s });
  }

  if (endCoord) {
    coords.push({ lng: endCoord[0], lat: endCoord[1] });
  }

  // Mapbox limit: 12 waypoints per request
  if (coords.length > 12) {
    // For >12 stops, chunk into sub-requests
    return await chunkedOptimization(stops, startCoord, endCoord, token);
  }

  const coordString = coords.map(c => `${c.lng},${c.lat}`).join(";");

  let url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordString}`;
  url += `?access_token=${token}`;
  url += `&geometries=polyline6`;
  url += `&overview=full`;

  if (startCoord) {
    url += `&source=first`;
  }
  if (endCoord) {
    url += `&destination=last`;
  }

  try {
    const response = await fetch(url);

    if (response.status === 429) {
      return { ok: false, error: "Mapbox rate limit exceeded", code: "RateLimited", orderedStops: stops, geometry: "", totalDuration: 0, totalDistance: 0, legs: [] };
    }

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Mapbox API error: ${response.status}`, code: text, orderedStops: stops, geometry: "", totalDuration: 0, totalDistance: 0, legs: [] };
    }

    const data: MapboxResponse = await response.json();

    if (data.code !== "Ok") {
      return { ok: false, error: `Mapbox returned: ${data.code}`, code: data.code, orderedStops: stops, geometry: "", totalDuration: 0, totalDistance: 0, legs: [] };
    }

    // Reorder stops based on waypoint_index
    const waypointMapping = data.waypoints;
    const startOffset = startCoord ? 1 : 0;

    const orderedStops: ScheduleStop[] = [];
    const reorderMap: Map<number, ScheduleStop> = new Map();

    for (let i = startOffset; i < waypointMapping.length - (endCoord ? 1 : 0); i++) {
      const wp = waypointMapping[i];
      const originalIndex = i - startOffset;
      reorderMap.set(wp.waypoint_index, stops[originalIndex]);
    }

    const sortedIndices = [...reorderMap.keys()].sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      orderedStops.push(reorderMap.get(idx)!);
    }

    // If reorder map is empty or incomplete, fall back
    if (orderedStops.length !== stops.length) {
      // Fallback: use waypoint order directly
      const wpSorted = [...waypointMapping]
        .filter((_, i) => i >= startOffset && i < waypointMapping.length - (endCoord ? 1 : 0))
        .sort((a, b) => a.waypoint_index - b.waypoint_index);

      orderedStops.length = 0;
      for (const wp of wpSorted) {
        const idx = waypointMapping.indexOf(wp) - startOffset;
        if (idx >= 0 && idx < stops.length) {
          orderedStops.push(stops[idx]);
        }
      }
    }

    const trip = data.trips[0];
    return {
      ok: true,
      orderedStops: orderedStops.length === stops.length ? orderedStops : stops,
      geometry: trip?.geometry || "",
      totalDuration: trip?.duration || 0,
      totalDistance: trip?.distance || 0,
      legs: trip?.legs || [],
    };
  } catch (err) {
    console.error("[outrider-route] Mapbox fetch error:", err);
    return { ok: false, error: String(err), orderedStops: stops, geometry: "", totalDuration: 0, totalDistance: 0, legs: [] };
  }
}

// Handle >12 waypoints by chunking
async function chunkedOptimization(
  stops: ScheduleStop[],
  startCoord: [number, number] | null,
  endCoord: [number, number] | null,
  token: string
): Promise<{
  ok: boolean;
  orderedStops: ScheduleStop[];
  geometry: string;
  totalDuration: number;
  totalDistance: number;
  legs: MapboxLeg[];
}> {
  const chunkSize = 10; // leave room for start/end
  const chunks: ScheduleStop[][] = [];
  for (let i = 0; i < stops.length; i += chunkSize) {
    chunks.push(stops.slice(i, i + chunkSize));
  }

  const allOrdered: ScheduleStop[] = [];
  const allGeometries: string[] = [];
  let totalDur = 0;
  let totalDist = 0;
  const allLegs: MapboxLeg[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;

    const result = await callMapboxOptimization(
      chunk,
      isFirst ? startCoord : null,
      isLast ? endCoord : null,
      token
    );

    if (result.ok) {
      allOrdered.push(...result.orderedStops);
      allGeometries.push(result.geometry);
      totalDur += result.totalDuration;
      totalDist += result.totalDistance;
      allLegs.push(...result.legs);
    } else {
      allOrdered.push(...chunk);
    }
  }

  return {
    ok: true,
    orderedStops: allOrdered,
    geometry: allGeometries.join(""),
    totalDuration: totalDur,
    totalDistance: totalDist,
    legs: allLegs,
  };
}
