/**
 * @module Travel Server Actions
 * @status COMPLETE
 * @description Travel management — distance estimation, travel apportionment, allowance compilation, and route optimization
 * @exports estimateTravelAction, calculateApportionmentAction, compileTravelAllowanceSummaryAction, fetchTravelLogsAction
 * @lastAudit 2026-03-22
 */
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

export interface ShiftTravelLogRow {
  id: string;
  organization_id: string;
  shift_id: string;
  worker_id: string;
  participant_id: string | null;
  travel_type: "provider_travel" | "participant_transport";
  start_time: string;
  end_time: string | null;
  claimed_distance_km: number;
  expected_distance_km: number | null;
  variance_percent: number | null;
  variance_status: "auto_approved" | "flagged_amber" | "manual_review" | null;
  is_approved: boolean;
  payroll_wage_amount: number | null;
  payroll_allowance_amount: number | null;
  ndis_billed_amount: number | null;
  capped_billable_minutes: number | null;
  route_polyline: string | null;
  raw_breadcrumbs: Array<{ lat: number; lng: number; timestamp?: string; speed?: number }>;
  created_at: string;
  updated_at: string;
}

export async function listShiftTravelLogsAction(
  organizationId: string,
  filters?: {
    date?: string;
    worker_id?: string;
    participant_id?: string;
    travel_type?: "provider_travel" | "participant_transport";
    flagged_only?: boolean;
  },
): Promise<ShiftTravelLogRow[]> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("shift_travel_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("start_time", { ascending: false })
      .limit(500);

    if (filters?.date) {
      query = query
        .gte("start_time", `${filters.date}T00:00:00Z`)
        .lte("start_time", `${filters.date}T23:59:59Z`);
    }
    if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id);
    if (filters?.participant_id) query = query.eq("participant_id", filters.participant_id);
    if (filters?.travel_type) query = query.eq("travel_type", filters.travel_type);
    if (filters?.flagged_only) query = query.eq("variance_status", "flagged_amber");

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      ...row,
      claimed_distance_km: parseFloat(row.claimed_distance_km) || 0,
      expected_distance_km: row.expected_distance_km != null ? parseFloat(row.expected_distance_km) : null,
      variance_percent: row.variance_percent != null ? parseFloat(row.variance_percent) : null,
      payroll_wage_amount: row.payroll_wage_amount != null ? parseFloat(row.payroll_wage_amount) : null,
      payroll_allowance_amount: row.payroll_allowance_amount != null ? parseFloat(row.payroll_allowance_amount) : null,
      ndis_billed_amount: row.ndis_billed_amount != null ? parseFloat(row.ndis_billed_amount) : null,
      raw_breadcrumbs: row.raw_breadcrumbs || [],
    })) as ShiftTravelLogRow[];
  } catch (error) {
    console.error("[travel] listShiftTravelLogsAction", error);
    return [];
  }
}

export async function startShiftTravelLogAction(input: {
  organization_id: string;
  shift_id: string;
  worker_id: string;
  participant_id?: string | null;
  travel_type: "provider_travel" | "participant_transport";
  start_time: string;
  start_lat?: number;
  start_lng?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("shift_travel_logs")
    .insert({
      organization_id: input.organization_id,
      shift_id: input.shift_id,
      worker_id: input.worker_id,
      participant_id: input.participant_id || null,
      travel_type: input.travel_type,
      start_time: input.start_time,
      start_lat: input.start_lat ?? null,
      start_lng: input.start_lng ?? null,
      raw_breadcrumbs: [],
      claimed_distance_km: 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function completeShiftTravelLogAction(input: {
  log_id: string;
  end_time: string;
  end_lat?: number;
  end_lng?: number;
  raw_breadcrumbs: Array<{ lat: number; lng: number; timestamp?: string; speed?: number }>;
  claimed_distance_km?: number;
  route_polyline?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await (supabase as any)
    .from("shift_travel_logs")
    .select("*")
    .eq("id", input.log_id)
    .single();

  if (existingError) throw new Error(existingError.message);

  const breadcrumbs = input.raw_breadcrumbs || [];
  let calculatedDistance = 0;
  for (let i = 1; i < breadcrumbs.length; i++) {
    const a = breadcrumbs[i - 1];
    const b = breadcrumbs[i];
    calculatedDistance += haversineKm(a.lat, a.lng, b.lat, b.lng);
  }
  calculatedDistance = Math.round(calculatedDistance * 100) / 100;

  const expected = (input.end_lat != null && input.end_lng != null && existing?.start_lat != null && existing?.start_lng != null)
    ? await calculateTravelTime(existing.start_lat, existing.start_lng, input.end_lat, input.end_lng)
    : { distance_km: calculatedDistance, duration_minutes: 0, source: "haversine" as const };

  const claimed = input.claimed_distance_km != null
    ? Math.max(0, input.claimed_distance_km)
    : calculatedDistance;

  const minutes = Math.max(
    0,
    Math.round((new Date(input.end_time).getTime() - new Date(existing.start_time).getTime()) / 60000),
  );

  const { data, error } = await (supabase as any)
    .from("shift_travel_logs")
    .update({
      end_time: input.end_time,
      end_lat: input.end_lat ?? null,
      end_lng: input.end_lng ?? null,
      raw_breadcrumbs: breadcrumbs,
      route_polyline: input.route_polyline || null,
      calculated_distance_km: calculatedDistance,
      expected_distance_km: expected.distance_km,
      claimed_distance_km: claimed,
      travel_minutes: minutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.log_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { data: variance } = await (supabase as any).rpc("analyze_travel_variance", { p_log_id: input.log_id });
  const { data: financials } = await (supabase as any).rpc("calculate_travel_financials", { p_log_id: input.log_id });

  return { log: data, variance, financials };
}

export async function approveTravelVarianceAction(input: {
  log_id: string;
  approved: boolean;
  approval_note?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userCtx } = await supabase.auth.getUser();
  const userId = userCtx.user?.id ?? null;
  const { error } = await (supabase as any)
    .from("shift_travel_logs")
    .update({
      is_approved: input.approved,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      approval_note: input.approval_note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.log_id);
  if (error) throw new Error(error.message);

  await (supabase as any).rpc("calculate_travel_financials", { p_log_id: input.log_id });
}

export async function adjustTravelClaimDistanceAction(input: {
  log_id: string;
  claimed_distance_km: number;
  reason?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("shift_travel_logs")
    .update({
      claimed_distance_km: Math.max(0, input.claimed_distance_km),
      approval_note: input.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.log_id);
  if (error) throw new Error(error.message);

  await (supabase as any).rpc("analyze_travel_variance", { p_log_id: input.log_id });
  await (supabase as any).rpc("calculate_travel_financials", { p_log_id: input.log_id });
}

export async function compileTravelAllowanceSummaryAction(input: {
  organization_id: string;
  period_start: string;
  period_end: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("shift_travel_logs")
    .select("worker_id, claimed_distance_km, payroll_allowance_amount")
    .eq("organization_id", input.organization_id)
    .eq("is_approved", true)
    .gte("start_time", `${input.period_start}T00:00:00Z`)
    .lte("start_time", `${input.period_end}T23:59:59Z`);
  if (error) throw new Error(error.message);

  const summary = new Map<string, { worker_id: string; total_km: number; total_allowance: number }>();
  for (const row of data || []) {
    const workerId = row.worker_id as string;
    const km = parseFloat(row.claimed_distance_km) || 0;
    const allowance = parseFloat(row.payroll_allowance_amount) || 0;
    const current = summary.get(workerId) || { worker_id: workerId, total_km: 0, total_allowance: 0 };
    current.total_km += km;
    current.total_allowance += allowance;
    summary.set(workerId, current);
  }

  return Array.from(summary.values()).map((s) => ({
    ...s,
    total_km: Math.round(s.total_km * 100) / 100,
    total_allowance: Math.round(s.total_allowance * 100) / 100,
    xero_earning_rate_hint: "KILOMETER_ALLOWANCE_TAX_FREE",
  }));
}
