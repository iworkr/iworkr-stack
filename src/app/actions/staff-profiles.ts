/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

export interface StaffProfile {
  id: string;
  user_id: string;
  organization_id: string;
  employment_type: "full_time" | "part_time" | "casual";
  schads_level: string;
  base_hourly_rate: number;
  max_weekly_hours: number;
  contracted_hours: number | null;
  qualifications: string[];
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  availability: Record<string, { start: string; end: string }[]>;
  emergency_contact: any;
  date_of_birth: string | null;
  superannuation_fund: string | null;
  superannuation_number: string | null;
  visa_status: string | null;
  vehicle_registration: string | null;
  license_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffProfileWithMeta extends StaffProfile {
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  branch: string;
  status: string;
  skills: string[];
  joined_at: string;
  credential_summary: {
    total: number;
    verified: number;
    expired: number;
    pending: number;
    expiring_soon: number;
  };
  weekly_hours_scheduled: number;
}

export interface SchadsRate {
  id: number;
  effective_date: string;
  level_code: string;
  base_rate: number;
  casual_loading: number;
  description: string | null;
}

export interface EligibleWorker {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  schads_level: string;
  base_hourly_rate: number;
  employment_type: string;
  qualifications: string[];
  distance_km: number | null;
  weekly_hours: number;
  max_weekly_hours: number;
  projected_cost_per_hour: number;
  credential_status: "compliant" | "non_compliant";
  fatigue_compliant: boolean;
  last_shift_end: string | null;
}

/* ── Get Staff Profile (full dossier) ─────────────────── */

export async function getStaffProfile(
  userId: string,
  orgId: string,
): Promise<StaffProfileWithMeta | null> {
  const supabase = await createServerSupabaseClient();

  // Fetch staff_profiles
  const { data: sp } = await (supabase as any)
    .from("staff_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  // Fetch organization_members data
  const { data: member } = await (supabase as any)
    .from("organization_members")
    .select("role, branch, status, skills, hourly_rate, joined_at")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  // Fetch profile
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name, email, avatar_url, phone")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !member) return null;

  // Credential summary
  const { data: creds } = await (supabase as any)
    .from("worker_credentials")
    .select("verification_status, expiry_date")
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const credList = creds || [];
  const credSummary = {
    total: credList.length,
    verified: credList.filter((c: any) => c.verification_status === "verified").length,
    expired: credList.filter((c: any) => c.verification_status === "expired" || (c.expiry_date && c.expiry_date < today)).length,
    pending: credList.filter((c: any) => c.verification_status === "pending").length,
    expiring_soon: credList.filter((c: any) => c.verification_status === "verified" && c.expiry_date && c.expiry_date >= today && c.expiry_date <= thirtyDaysOut).length,
  };

  // Weekly hours scheduled
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: blocks } = await (supabase as any)
    .from("schedule_blocks")
    .select("start_time, end_time")
    .eq("organization_id", orgId)
    .eq("technician_id", userId)
    .gte("start_time", weekStart.toISOString())
    .lt("end_time", weekEnd.toISOString())
    .neq("status", "cancelled");

  const weeklyHours = (blocks || []).reduce((sum: number, b: any) => {
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    return sum + (end - start) / 3600000;
  }, 0);

  // Build the merged result
  const staffData: StaffProfileWithMeta = {
    // Staff profile fields (or defaults if no profile exists yet)
    id: sp?.id || "",
    user_id: userId,
    organization_id: orgId,
    employment_type: sp?.employment_type || "casual",
    schads_level: sp?.schads_level || "2.1",
    base_hourly_rate: parseFloat(sp?.base_hourly_rate) || parseFloat(member.hourly_rate) || 0,
    max_weekly_hours: sp?.max_weekly_hours || 38,
    contracted_hours: sp?.contracted_hours || null,
    qualifications: sp?.qualifications || [],
    home_address: sp?.home_address || null,
    home_lat: sp?.home_lat ? parseFloat(sp.home_lat) : null,
    home_lng: sp?.home_lng ? parseFloat(sp.home_lng) : null,
    availability: sp?.availability || {},
    emergency_contact: sp?.emergency_contact || null,
    date_of_birth: sp?.date_of_birth || null,
    superannuation_fund: sp?.superannuation_fund || null,
    superannuation_number: sp?.superannuation_number || null,
    visa_status: sp?.visa_status || null,
    vehicle_registration: sp?.vehicle_registration || null,
    license_number: sp?.license_number || null,
    notes: sp?.notes || null,
    created_at: sp?.created_at || new Date().toISOString(),
    updated_at: sp?.updated_at || new Date().toISOString(),
    // Meta from organization_members + profiles
    full_name: profile.full_name || "",
    email: profile.email || "",
    avatar_url: profile.avatar_url || null,
    phone: profile.phone || null,
    role: member.role || "technician",
    branch: member.branch || "HQ",
    status: member.status || "active",
    skills: member.skills || [],
    joined_at: member.joined_at || "",
    credential_summary: credSummary,
    weekly_hours_scheduled: Math.round(weeklyHours * 10) / 10,
  };

  return staffData;
}

/* ── Upsert Staff Profile ─────────────────────────────── */

export async function upsertStaffProfile(data: {
  user_id: string;
  organization_id: string;
  employment_type: string;
  schads_level: string;
  base_hourly_rate?: number;
  max_weekly_hours?: number;
  contracted_hours?: number | null;
  qualifications?: string[];
  home_address?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  availability?: Record<string, any>;
  emergency_contact?: any;
  date_of_birth?: string | null;
  superannuation_fund?: string | null;
  superannuation_number?: string | null;
  visa_status?: string | null;
  vehicle_registration?: string | null;
  license_number?: string | null;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Auto-lookup SCHADS rate if no explicit rate provided
  let rate = data.base_hourly_rate;
  if (!rate || rate <= 0) {
    const { data: rateRow } = await (supabase as any).rpc("get_schads_rate_with_loading", {
      p_level_code: data.schads_level,
      p_employment_type: data.employment_type,
    });
    rate = parseFloat(rateRow) || 0;
  }

  const { error } = await (supabase as any)
    .from("staff_profiles")
    .upsert({
      user_id: data.user_id,
      organization_id: data.organization_id,
      employment_type: data.employment_type,
      schads_level: data.schads_level,
      base_hourly_rate: rate,
      max_weekly_hours: data.max_weekly_hours ?? 38,
      contracted_hours: data.contracted_hours,
      qualifications: data.qualifications || [],
      home_address: data.home_address,
      home_lat: data.home_lat,
      home_lng: data.home_lng,
      availability: data.availability || {},
      emergency_contact: data.emergency_contact,
      date_of_birth: data.date_of_birth,
      superannuation_fund: data.superannuation_fund,
      superannuation_number: data.superannuation_number,
      visa_status: data.visa_status,
      vehicle_registration: data.vehicle_registration,
      license_number: data.license_number,
      notes: data.notes,
    }, { onConflict: "user_id,organization_id" });

  if (error) return { success: false, error: error.message };

  // Also sync hourly_rate to organization_members for backwards compatibility
  await (supabase as any)
    .from("organization_members")
    .update({ hourly_rate: rate })
    .eq("user_id", data.user_id)
    .eq("organization_id", data.organization_id);

  return { success: true };
}

/* ── Get All SCHADS Rates ─────────────────────────────── */

export async function getSchadsRates(
  effectiveDate?: string,
): Promise<SchadsRate[]> {
  const supabase = await createServerSupabaseClient();
  const date = effectiveDate || new Date().toISOString().split("T")[0];

  const { data, error } = await (supabase as any)
    .from("schads_award_rates")
    .select("*")
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .order("level_code");

  if (error) return [];

  // Deduplicate: keep only the most recent rate per level_code
  const seen = new Set<string>();
  const result: SchadsRate[] = [];
  for (const row of (data || [])) {
    if (!seen.has(row.level_code)) {
      seen.add(row.level_code);
      result.push({
        ...row,
        base_rate: parseFloat(row.base_rate) || 0,
        casual_loading: parseFloat(row.casual_loading) || 1.25,
      });
    }
  }

  return result.sort((a, b) => a.level_code.localeCompare(b.level_code, undefined, { numeric: true }));
}

/* ── Get Single SCHADS Rate ───────────────────────────── */

export async function getSchadsRateForLevel(
  levelCode: string,
  effectiveDate?: string,
): Promise<{ base_rate: number; casual_rate: number } | null> {
  const supabase = await createServerSupabaseClient();
  const date = effectiveDate || new Date().toISOString().split("T")[0];

  const { data } = await (supabase as any)
    .from("schads_award_rates")
    .select("base_rate, casual_loading")
    .eq("level_code", levelCode)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const base = parseFloat(data.base_rate) || 0;
  const loading = parseFloat(data.casual_loading) || 1.25;

  return { base_rate: base, casual_rate: Math.round(base * loading * 100) / 100 };
}

/* ── Get Staff Availability + Scheduled Hours ─────────── */

export async function getStaffAvailability(
  userId: string,
  orgId: string,
  weekStartDate?: string,
): Promise<{
  availability: Record<string, { start: string; end: string }[]>;
  scheduled_hours: number;
  max_hours: number;
  blocks: { start: string; end: string; title: string }[];
}> {
  const supabase = await createServerSupabaseClient();

  const weekStart = weekStartDate ? new Date(weekStartDate) : getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [spResult, blocksResult] = await Promise.all([
    (supabase as any)
      .from("staff_profiles")
      .select("availability, max_weekly_hours")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle(),
    (supabase as any)
      .from("schedule_blocks")
      .select("start_time, end_time, title")
      .eq("organization_id", orgId)
      .eq("technician_id", userId)
      .gte("start_time", weekStart.toISOString())
      .lt("end_time", weekEnd.toISOString())
      .neq("status", "cancelled")
      .order("start_time"),
  ]);

  const blocks = (blocksResult.data || []).map((b: any) => ({
    start: b.start_time,
    end: b.end_time,
    title: b.title,
  }));

  const scheduledHours = blocks.reduce((sum: number, b: any) => {
    return sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 3600000;
  }, 0);

  return {
    availability: spResult.data?.availability || {},
    scheduled_hours: Math.round(scheduledHours * 10) / 10,
    max_hours: spResult.data?.max_weekly_hours || 38,
    blocks,
  };
}

/* ── Get Eligible Workers (Smart Match) ───────────────── */

export async function getEligibleWorkers(filters: {
  organization_id: string;
  participant_id?: string;
  required_qualifications?: string[];
  shift_start: string;
  shift_end: string;
  participant_lat?: number;
  participant_lng?: number;
  max_distance_km?: number;
}): Promise<EligibleWorker[]> {
  const supabase = await createServerSupabaseClient();

  // 1. Get all active staff in the org
  const { data: staffRows } = await (supabase as any)
    .from("staff_profiles")
    .select("user_id, schads_level, base_hourly_rate, employment_type, qualifications, max_weekly_hours, home_lat, home_lng")
    .eq("organization_id", filters.organization_id);

  if (!staffRows || staffRows.length === 0) return [];

  // Get profile data
  const userIds = staffRows.map((s: any) => s.user_id);
  const { data: profiles } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>((profiles || []).map((p: any) => [p.id, p]));

  // Get member statuses
  const { data: members } = await (supabase as any)
    .from("organization_members")
    .select("user_id, status")
    .eq("organization_id", filters.organization_id)
    .in("user_id", userIds)
    .eq("status", "active");

  const activeUserIds = new Set((members || []).map((m: any) => m.user_id));

  // Get credential status for each worker
  const { data: allCreds } = await (supabase as any)
    .from("worker_credentials")
    .select("user_id, credential_type, verification_status, expiry_date")
    .eq("organization_id", filters.organization_id)
    .in("user_id", userIds);

  const today = new Date().toISOString().split("T")[0];
  const mandatoryCreds = ["NDIS_SCREENING", "WWCC", "FIRST_AID"];

  // Get weekly hours
  const weekStart = getWeekStart(new Date(filters.shift_start));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: weekBlocks } = await (supabase as any)
    .from("schedule_blocks")
    .select("technician_id, start_time, end_time")
    .eq("organization_id", filters.organization_id)
    .in("technician_id", userIds)
    .gte("start_time", weekStart.toISOString())
    .lt("end_time", weekEnd.toISOString())
    .neq("status", "cancelled");

  // Get last shift end for fatigue check
  const { data: recentBlocks } = await (supabase as any)
    .from("schedule_blocks")
    .select("technician_id, end_time")
    .eq("organization_id", filters.organization_id)
    .in("technician_id", userIds)
    .lt("end_time", filters.shift_start)
    .neq("status", "cancelled")
    .order("end_time", { ascending: false });

  // Build per-worker data
  const hoursMap = new Map<string, number>();
  for (const b of (weekBlocks || [])) {
    const h = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
    hoursMap.set(b.technician_id, (hoursMap.get(b.technician_id) || 0) + h);
  }

  const lastEndMap = new Map<string, string>();
  for (const b of (recentBlocks || [])) {
    if (!lastEndMap.has(b.technician_id)) lastEndMap.set(b.technician_id, b.end_time);
  }

  const results: EligibleWorker[] = [];

  for (const staff of staffRows) {
    // Filter: active member
    if (!activeUserIds.has(staff.user_id)) continue;

    const profile = profileMap.get(staff.user_id);
    if (!profile) continue;

    // Filter: qualifications
    if (filters.required_qualifications && filters.required_qualifications.length > 0) {
      const workerQuals = new Set(staff.qualifications || []);
      const missing = filters.required_qualifications.some((q: string) => !workerQuals.has(q));
      if (missing) continue;
    }

    // Credential check
    const workerCreds = (allCreds || []).filter((c: any) => c.user_id === staff.user_id);
    let credCompliant = true;
    for (const req of mandatoryCreds) {
      const cred = workerCreds.find((c: any) => c.credential_type === req);
      if (!cred || cred.verification_status !== "verified" || (cred.expiry_date && cred.expiry_date < today)) {
        credCompliant = false;
        break;
      }
    }

    // Fatigue check
    const lastEnd = lastEndMap.get(staff.user_id);
    let fatigueCompliant = true;
    if (lastEnd) {
      const gapHours = (new Date(filters.shift_start).getTime() - new Date(lastEnd).getTime()) / 3600000;
      if (gapHours < 10) fatigueCompliant = false;
    }

    // Distance check
    let distanceKm: number | null = null;
    if (filters.participant_lat && filters.participant_lng && staff.home_lat && staff.home_lng) {
      distanceKm = haversineKm(
        parseFloat(staff.home_lat), parseFloat(staff.home_lng),
        filters.participant_lat, filters.participant_lng,
      );
      if (filters.max_distance_km && distanceKm > filters.max_distance_km) continue;
    }

    const weeklyHours = Math.round((hoursMap.get(staff.user_id) || 0) * 10) / 10;
    const baseRate = parseFloat(staff.base_hourly_rate) || 0;

    results.push({
      user_id: staff.user_id,
      full_name: profile.full_name || "",
      avatar_url: profile.avatar_url,
      schads_level: staff.schads_level,
      base_hourly_rate: baseRate,
      employment_type: staff.employment_type,
      qualifications: staff.qualifications || [],
      distance_km: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
      weekly_hours: weeklyHours,
      max_weekly_hours: staff.max_weekly_hours || 38,
      projected_cost_per_hour: baseRate,
      credential_status: credCompliant ? "compliant" : "non_compliant",
      fatigue_compliant: fatigueCompliant,
      last_shift_end: lastEnd || null,
    });
  }

  // Sort: compliant first, then by distance, then by cost
  results.sort((a, b) => {
    if (a.credential_status !== b.credential_status) return a.credential_status === "compliant" ? -1 : 1;
    if (a.fatigue_compliant !== b.fatigue_compliant) return a.fatigue_compliant ? -1 : 1;
    if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
    return a.base_hourly_rate - b.base_hourly_rate;
  });

  return results;
}

/* ── Get All Staff Profiles for Org ───────────────────── */

export async function getOrgStaffProfiles(orgId: string): Promise<StaffProfileWithMeta[]> {
  const supabase = await createServerSupabaseClient();

  const { data: staffRows } = await (supabase as any)
    .from("staff_profiles")
    .select("*")
    .eq("organization_id", orgId);

  if (!staffRows || staffRows.length === 0) return [];

  const profiles: StaffProfileWithMeta[] = [];
  for (const sp of staffRows) {
    const full = await getStaffProfile(sp.user_id, orgId);
    if (full) profiles.push(full);
  }

  return profiles;
}

/* ── Helpers ──────────────────────────────────────────── */

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
