/**
 * @module CareHouses Server Actions
 * @status COMPLETE
 * @description SIL/SDA house management — facility CRUD, resident assignments, petty cash, and house rules
 * @exports createHouseAction, fetchHousesAction, updateHouseAction, deleteHouseAction, assignResidentAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ───────────────────────────────────────────────── */

export interface CareHouse {
  id: string;
  organization_id: string;
  name: string;
  address: Record<string, string>;
  house_phone: string | null;
  petty_cash_balance: number;
  house_rules: string | null;
  status: "active" | "inactive";
  created_at: string;
  participant_count?: number;
  staff_count?: number;
}

export interface HouseParticipant {
  id: string;
  house_id: string;
  participant_id: string;
  is_primary_residence: boolean;
  move_in_date: string;
  status: string;
  participant_name?: string;
  ndis_number?: string;
}

export interface HouseStaffMember {
  id: string;
  house_id: string;
  worker_id: string;
  role: "leader" | "core_team" | "float_pool";
  assigned_at: string;
  worker_name?: string;
}

export interface HouseNote {
  id: string;
  house_id: string;
  author_id: string;
  content: string;
  category: "shift_handover" | "maintenance" | "groceries" | "general";
  is_pinned: boolean;
  created_at: string;
  author_name?: string;
}

export interface PettyCashEntry {
  id: string;
  house_id: string;
  author_id: string;
  amount: number;
  description: string;
  category: string;
  receipt_url: string | null;
  balance_after: number;
  created_at: string;
  author_name?: string;
}

/* ── Houses CRUD ─────────────────────────────────────────── */

export async function fetchHouses(orgId: string): Promise<CareHouse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("care_houses")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("name");
  if (error) return [];

  const houses = data || [];
  const houseIds = houses.map((h: any) => h.id);
  if (houseIds.length === 0) return houses;

  const [{ data: pCounts }, { data: sCounts }] = await Promise.all([
    (supabase as any)
      .from("house_participants")
      .select("house_id")
      .in("house_id", houseIds)
      .eq("status", "active"),
    (supabase as any)
      .from("house_staff")
      .select("house_id")
      .in("house_id", houseIds),
  ]);

  const pMap = new Map<string, number>();
  for (const p of pCounts || []) pMap.set(p.house_id, (pMap.get(p.house_id) || 0) + 1);
  const sMap = new Map<string, number>();
  for (const s of sCounts || []) sMap.set(s.house_id, (sMap.get(s.house_id) || 0) + 1);

  return houses.map((h: any) => ({
    ...h,
    participant_count: pMap.get(h.id) || 0,
    staff_count: sMap.get(h.id) || 0,
  }));
}

export async function fetchHouseDetail(houseId: string): Promise<CareHouse | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("care_houses")
    .select("*")
    .eq("id", houseId)
    .maybeSingle();
  return data || null;
}

export async function createHouse(payload: {
  organization_id: string;
  name: string;
  address?: Record<string, string>;
  house_phone?: string;
  house_rules?: string;
}): Promise<{ success: boolean; house?: CareHouse; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("care_houses")
    .insert({
      organization_id: payload.organization_id,
      name: payload.name,
      address: payload.address || {},
      house_phone: payload.house_phone || null,
      house_rules: payload.house_rules || null,
    })
    .select("*")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, house: data };
}

/* ── House Participants ──────────────────────────────────── */

export async function fetchHouseParticipants(houseId: string): Promise<HouseParticipant[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("house_participants")
    .select("*, participant_profiles:participant_id(id, ndis_number, clients:client_id(name))")
    .eq("house_id", houseId)
    .eq("status", "active");
  return (data || []).map((hp: any) => ({
    ...hp,
    participant_name: hp.participant_profiles?.clients?.name || "Unknown",
    ndis_number: hp.participant_profiles?.ndis_number || null,
    participant_profiles: undefined,
  }));
}

export async function addParticipantToHouse(
  houseId: string,
  participantId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("house_participants")
    .insert({ house_id: houseId, participant_id: participantId })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeParticipantFromHouse(
  houseId: string,
  participantId: string,
): Promise<{ success: boolean }> {
  const supabase = await createServerSupabaseClient();
  await (supabase as any)
    .from("house_participants")
    .update({ status: "transferred", move_out_date: new Date().toISOString().slice(0, 10) })
    .eq("house_id", houseId)
    .eq("participant_id", participantId);
  return { success: true };
}

/* ── House Staff ─────────────────────────────────────────── */

export async function fetchHouseStaff(houseId: string): Promise<HouseStaffMember[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("house_staff")
    .select("*, profiles:worker_id(full_name)")
    .eq("house_id", houseId)
    .order("role");
  return (data || []).map((hs: any) => ({
    ...hs,
    worker_name: hs.profiles?.full_name || "Unknown",
    profiles: undefined,
  }));
}

export async function addStaffToHouse(
  houseId: string,
  workerId: string,
  role: "leader" | "core_team" | "float_pool" = "core_team",
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("house_staff")
    .insert({ house_id: houseId, worker_id: workerId, role })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateStaffRole(
  houseId: string,
  workerId: string,
  role: "leader" | "core_team" | "float_pool",
): Promise<{ success: boolean }> {
  const supabase = await createServerSupabaseClient();
  await (supabase as any)
    .from("house_staff")
    .update({ role })
    .eq("house_id", houseId)
    .eq("worker_id", workerId);
  return { success: true };
}

export async function removeStaffFromHouse(
  houseId: string,
  workerId: string,
): Promise<{ success: boolean }> {
  const supabase = await createServerSupabaseClient();
  await (supabase as any)
    .from("house_staff")
    .delete()
    .eq("house_id", houseId)
    .eq("worker_id", workerId);
  return { success: true };
}

/* ── House Notes ─────────────────────────────────────────── */

export async function fetchHouseNotes(houseId: string): Promise<HouseNote[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("house_notes")
    .select("*, profiles:author_id(full_name)")
    .eq("house_id", houseId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []).map((n: any) => ({
    ...n,
    author_name: n.profiles?.full_name || "Unknown",
    profiles: undefined,
  }));
}

export async function createHouseNote(
  houseId: string,
  content: string,
  category: "shift_handover" | "maintenance" | "groceries" | "general" = "general",
  isPinned: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("house_notes")
    .insert({
      house_id: houseId,
      author_id: user?.id,
      content,
      category,
      is_pinned: isPinned,
    });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleNotePin(noteId: string, pinned: boolean): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await (supabase as any)
    .from("house_notes")
    .update({ is_pinned: pinned })
    .eq("id", noteId);
}

/* ── Petty Cash ──────────────────────────────────────────── */

export async function fetchPettyCashLog(houseId: string): Promise<PettyCashEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase as any)
    .from("house_petty_cash_log")
    .select("*, profiles:author_id(full_name)")
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []).map((e: any) => ({
    ...e,
    author_name: e.profiles?.full_name || "Unknown",
    profiles: undefined,
  }));
}

export async function deductPettyCash(
  houseId: string,
  amount: number,
  description: string,
  category: string = "general",
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("rpc_house_petty_cash_deduct", {
    p_house_id: houseId,
    p_amount: amount,
    p_description: description,
    p_category: category,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, new_balance: data?.new_balance };
}

export async function topUpPettyCash(
  houseId: string,
  amount: number,
  description: string = "Top-up",
): Promise<{ success: boolean; new_balance?: number; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("rpc_house_petty_cash_topup", {
    p_house_id: houseId,
    p_amount: amount,
    p_description: description,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, new_balance: data?.new_balance };
}

/* ── House Roster (filtered schedule_blocks) ─────────────── */

export async function fetchHouseRoster(
  houseId: string,
  orgId: string,
  dateFrom: string,
  dateTo: string,
) {
  const supabase = await createServerSupabaseClient();

  const { data: houseParticipants } = await (supabase as any)
    .from("house_participants")
    .select("participant_id")
    .eq("house_id", houseId)
    .eq("status", "active");

  const participantIds = (houseParticipants || []).map((hp: any) => hp.participant_id);
  if (participantIds.length === 0) return [];

  const { data } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, title, start_time, end_time, status, shift_group_id, target_ratio, technician_id, participant_id, profiles:technician_id(full_name)")
    .eq("organization_id", orgId)
    .in("participant_id", participantIds)
    .gte("start_time", dateFrom)
    .lte("start_time", dateTo)
    .order("start_time", { ascending: true });

  return (data || []).map((s: any) => ({
    ...s,
    worker_name: s.profiles?.full_name || null,
    profiles: undefined,
  }));
}
