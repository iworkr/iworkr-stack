/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

export interface TravelEstimate {
  distance_km: number;
  duration_minutes: number;
  source: "google_maps" | "haversine";
}

export interface TravelApportionment {
  travel_time_minutes: number;
  travel_distance_km: number;
  // Worker payroll
  worker_travel_pay: number;       // base_rate * (travel_time / 60)
  worker_km_allowance: number;     // distance_km * travel_rate_per_km
  // NDIS billing
  ndis_travel_time_revenue: number;   // NDIS Provider Travel Time line item
  ndis_travel_km_revenue: number;     // NDIS Provider Travel Non-Labour Costs
  total_travel_cost: number;
  total_travel_revenue: number;
}

/* ── Google Maps Distance Matrix ──────────────────────── */

export async function calculateTravelTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<TravelEstimate> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&units=metric&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (
        data.status === "OK" &&
        data.rows?.[0]?.elements?.[0]?.status === "OK"
      ) {
        const element = data.rows[0].elements[0];
        return {
          distance_km: Math.round((element.distance.value / 1000) * 10) / 10,
          duration_minutes: Math.round(element.duration.value / 60),
          source: "google_maps",
        };
      }
    } catch (err) {
      console.error("[Travel] Google Maps API error, falling back to Haversine:", err);
    }
  }

  // Fallback: Haversine calculation
  const distanceKm = haversineKm(originLat, originLng, destLat, destLng);
  const durationMinutes = Math.round((distanceKm / 40) * 60); // ~40 km/h average

  return {
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_minutes: durationMinutes,
    source: "haversine",
  };
}

/* ── Travel Apportionment for a Shift ─────────────────── */

export async function calculateTravelApportionment(
  orgId: string,
  workerId: string,
  scheduleBlockId: string,
  participantLat: number,
  participantLng: number,
): Promise<TravelApportionment | null> {
  const supabase = await createServerSupabaseClient();

  // 1. Determine origin — previous shift end location or worker's home
  const { data: block } = await (supabase as any)
    .from("schedule_blocks")
    .select("start_time")
    .eq("id", scheduleBlockId)
    .single();

  if (!block) return null;

  let originLat: number | null = null;
  let originLng: number | null = null;

  // Check for a previous shift ending before this one starts
  const { data: prevBlock } = await (supabase as any)
    .from("schedule_blocks")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("technician_id", workerId)
    .lt("end_time", block.start_time)
    .neq("status", "cancelled")
    .order("end_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prevBlock?.metadata?.location_lat && prevBlock?.metadata?.location_lng) {
    originLat = parseFloat(prevBlock.metadata.location_lat);
    originLng = parseFloat(prevBlock.metadata.location_lng);
  }

  // Fallback to worker home address
  if (!originLat || !originLng) {
    const { data: staff } = await (supabase as any)
      .from("staff_profiles")
      .select("home_lat, home_lng")
      .eq("user_id", workerId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (staff?.home_lat && staff?.home_lng) {
      originLat = parseFloat(staff.home_lat);
      originLng = parseFloat(staff.home_lng);
    }
  }

  if (!originLat || !originLng) return null;

  // 2. Calculate travel
  const travel = await calculateTravelTime(originLat, originLng, participantLat, participantLng);

  // 3. Get worker's base rate for travel time pay
  const { data: staffProfile } = await (supabase as any)
    .from("staff_profiles")
    .select("base_hourly_rate, employment_type")
    .eq("user_id", workerId)
    .eq("organization_id", orgId)
    .maybeSingle();

  let baseRate = staffProfile ? parseFloat(staffProfile.base_hourly_rate) : 0;
  if (staffProfile?.employment_type === "casual") baseRate *= 1.25;

  // 4. Get km allowance rate from award_rules
  let kmRate = 0.96; // SCHADS default
  try {
    const { data: ruleVal } = await (supabase as any).rpc("get_award_rule", {
      p_organization_id: orgId,
      p_rule_type: "travel_rate_per_km",
    });
    if (ruleVal) kmRate = parseFloat(ruleVal);
  } catch { /* use default */ }

  // 5. NDIS travel line items
  // Provider Travel Time: 01_799_0107_1_1
  // Provider Travel Non-Labour Costs (per km): 01_799_0107_1_1 (typically separate)
  let ndisTimeRate = 0;
  let ndisKmRate = 0;

  try {
    // Travel time rate
    const { data: travelTimeItem } = await (supabase as any)
      .from("ndis_catalogue")
      .select("base_rate_national")
      .eq("support_item_number", "01_799_0107_1_1")
      .is("effective_to", null)
      .maybeSingle();
    if (travelTimeItem) ndisTimeRate = parseFloat(travelTimeItem.base_rate_national) || 0;

    // Travel km rate (non-labour costs)
    const { data: travelKmItem } = await (supabase as any)
      .from("ndis_catalogue")
      .select("base_rate_national")
      .ilike("support_item_name", "%travel%non%labour%")
      .is("effective_to", null)
      .maybeSingle();
    if (travelKmItem) ndisKmRate = parseFloat(travelKmItem.base_rate_national) || 0;
  } catch { /* ignore */ }

  // 6. Calculate apportionment
  const travelHours = travel.duration_minutes / 60;
  const workerTravelPay = Math.round(baseRate * travelHours * 100) / 100;
  const workerKmAllowance = Math.round(travel.distance_km * kmRate * 100) / 100;
  const ndisTimeRevenue = Math.round(ndisTimeRate * travelHours * 100) / 100;
  const ndisKmRevenue = Math.round(ndisKmRate * travel.distance_km * 100) / 100;

  const result: TravelApportionment = {
    travel_time_minutes: travel.duration_minutes,
    travel_distance_km: travel.distance_km,
    worker_travel_pay: workerTravelPay,
    worker_km_allowance: workerKmAllowance,
    ndis_travel_time_revenue: ndisTimeRevenue,
    ndis_travel_km_revenue: ndisKmRevenue,
    total_travel_cost: Math.round((workerTravelPay + workerKmAllowance) * 100) / 100,
    total_travel_revenue: Math.round((ndisTimeRevenue + ndisKmRevenue) * 100) / 100,
  };

  // 7. Update the shift financial ledger with travel data
  await (supabase as any)
    .from("shift_financial_ledgers")
    .update({
      travel_distance_km: travel.distance_km,
      travel_duration_mins: travel.duration_minutes,
      travel_cost: result.total_travel_cost,
      travel_revenue: result.total_travel_revenue,
    })
    .eq("schedule_block_id", scheduleBlockId);

  return result;
}

/* ── Haversine Helper ─────────────────────────────────── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
