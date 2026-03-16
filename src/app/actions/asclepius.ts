"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Project Asclepius — Advanced eMAR Server Actions
// ═══════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────

export interface MedicationProfile {
  id: string;
  participant_id: string;
  participant_name?: string;
  medication_name: string;
  generic_name?: string;
  dosage: string;
  form: string;
  route: string;
  frequency: string;
  time_slots: string[];
  is_s8_controlled: boolean;
  is_prn: boolean;
  pack_type: string;
  prn_min_gap_hours?: number | null;
  prn_max_doses_24h?: number | null;
  prn_reason?: string | null;
  special_instructions?: string | null;
  prescribing_doctor?: string | null;
  pharmacy?: string | null;
  is_active: boolean;
  inventory?: InventoryStatus | null;
}

export interface InventoryStatus {
  id: string;
  current_stock_count: number;
  daily_consumption_rate: number;
  remaining_days: number;
  reorder_threshold_days: number;
  linked_pharmacy_name?: string | null;
  last_restocked_at?: string | null;
  is_low_stock: boolean;
  is_critical: boolean;
}

export interface PharmacyOrder {
  id: string;
  participant_name: string;
  pharmacy_name: string;
  medication_count: number;
  status: string;
  transmitted_at: string;
  received_at?: string | null;
}

export interface S8AuditEntry {
  id: string;
  medication_name: string;
  participant_name: string;
  primary_worker: string;
  witness_worker: string;
  administered_at: string;
  stock_before: number;
  stock_after: number;
}

// ── Fetch medications with inventory for a participant ────────

export async function fetchMedicationProfiles(
  organizationId: string,
  participantId?: string
): Promise<MedicationProfile[]> {
  const supabase = await createServerSupabaseClient();

  let query = (supabase as any)
    .from("participant_medications")
    .select(`
      *,
      participant:participant_profiles(preferred_name),
      inventory:medication_inventory(
        id, current_stock_count, daily_consumption_rate,
        reorder_threshold_days, linked_pharmacy_name, last_restocked_at
      )
    `)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("medication_name");

  if (participantId) {
    query = query.eq("participant_id", participantId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((row: any): MedicationProfile => {
    const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
    const stockCount = inv?.current_stock_count ?? 0;
    const dailyRate = inv?.daily_consumption_rate ?? 1;
    const remainingDays = dailyRate > 0 ? Math.floor(stockCount / dailyRate) : 999;
    const threshold = inv?.reorder_threshold_days ?? 3;

    return {
      id: row.id,
      participant_id: row.participant_id,
      participant_name: row.participant?.preferred_name || undefined,
      medication_name: row.medication_name,
      generic_name: row.generic_name,
      dosage: row.dosage,
      form: row.form || "tablet",
      route: row.route,
      frequency: row.frequency,
      time_slots: row.time_slots || [],
      is_s8_controlled: row.is_s8_controlled || false,
      is_prn: row.is_prn || false,
      pack_type: row.pack_type || "loose_box",
      prn_min_gap_hours: row.prn_min_gap_hours,
      prn_max_doses_24h: row.prn_max_doses_24h,
      prn_reason: row.prn_reason,
      special_instructions: row.special_instructions,
      prescribing_doctor: row.prescribing_doctor,
      pharmacy: row.pharmacy,
      is_active: row.is_active,
      inventory: inv
        ? {
            id: inv.id,
            current_stock_count: stockCount,
            daily_consumption_rate: dailyRate,
            remaining_days: remainingDays,
            reorder_threshold_days: threshold,
            linked_pharmacy_name: inv.linked_pharmacy_name,
            last_restocked_at: inv.last_restocked_at,
            is_low_stock: remainingDays <= threshold,
            is_critical: remainingDays <= 1,
          }
        : null,
    };
  });
}

// ── Update medication S8 / PRN / Webster config ──────────────

export async function updateMedicationConfig(
  medicationId: string,
  updates: {
    is_s8_controlled?: boolean;
    pack_type?: string;
    form?: string;
    prn_min_gap_hours?: number | null;
    prn_max_doses_24h?: number | null;
  },
  organizationId?: string
) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("participant_medications")
    .update(updates)
    .eq("id", medicationId);

  // Defense-in-depth: scope to org when provided
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/medications");
}

// ── Upsert inventory record ──────────────────────────────────

export async function upsertMedicationInventory(input: {
  medication_id: string;
  organization_id: string;
  participant_id: string;
  current_stock_count: number;
  daily_consumption_rate: number;
  reorder_threshold_days?: number;
  linked_pharmacy_name?: string;
  linked_pharmacy_email?: string;
  linked_pharmacy_fax?: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("medication_inventory")
    .upsert(
      {
        medication_id: input.medication_id,
        organization_id: input.organization_id,
        participant_id: input.participant_id,
        current_stock_count: input.current_stock_count,
        daily_consumption_rate: input.daily_consumption_rate,
        reorder_threshold_days: input.reorder_threshold_days || 3,
        linked_pharmacy_name: input.linked_pharmacy_name || null,
        linked_pharmacy_email: input.linked_pharmacy_email || null,
        linked_pharmacy_fax: input.linked_pharmacy_fax || null,
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "medication_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/medications");
}

// ── Fetch low-stock medications (inventory alerts) ───────────

export async function fetchLowStockAlerts(organizationId: string) {
  const admin = createAdminSupabaseClient() as any;

  const { data, error } = await admin
    .from("medication_inventory")
    .select(`
      *,
      medication:participant_medications(medication_name, dosage, participant_id),
      participant:participant_profiles(preferred_name)
    `)
    .eq("organization_id", organizationId)
    .order("current_stock_count", { ascending: true });

  if (error) return [];

  return (data || [])
    .map((row: any) => {
      const dailyRate = row.daily_consumption_rate || 1;
      const remainingDays = dailyRate > 0 ? Math.floor(row.current_stock_count / dailyRate) : 999;
      return {
        ...row,
        remaining_days: remainingDays,
        medication_name: row.medication?.medication_name,
        dosage: row.medication?.dosage,
        participant_name: row.participant?.preferred_name,
        is_critical: remainingDays <= 1,
        is_low: remainingDays <= row.reorder_threshold_days,
      };
    })
    .filter((r: any) => r.is_low);
}

// ── Fetch S8 DD Book (Audit Trail) ───────────────────────────

export async function fetchS8AuditLedger(organizationId: string): Promise<S8AuditEntry[]> {
  const admin = createAdminSupabaseClient() as any;

  const { data, error } = await admin
    .from("medication_administration_records")
    .select(`
      id, administered_at, stock_count_before, stock_count_after,
      medication:participant_medications!medication_administration_records_medication_id_fkey(medication_name),
      participant:participant_profiles!medication_administration_records_participant_id_fkey(preferred_name),
      primary:profiles!medication_administration_records_worker_id_fkey(full_name),
      witness:profiles!medication_administration_records_witness_id_fkey(full_name)
    `)
    .eq("organization_id", organizationId)
    .eq("is_s8_administration", true)
    .order("administered_at", { ascending: false })
    .limit(100);

  if (error) return [];

  return (data || []).map((row: any): S8AuditEntry => ({
    id: row.id,
    medication_name: row.medication?.medication_name || "Unknown",
    participant_name: row.participant?.preferred_name || "Unknown",
    primary_worker: row.primary?.full_name || "Unknown",
    witness_worker: row.witness?.full_name || "N/A",
    administered_at: row.administered_at,
    stock_before: row.stock_count_before || 0,
    stock_after: row.stock_count_after || 0,
  }));
}

// ── Fetch pharmacy orders ────────────────────────────────────

export async function fetchPharmacyOrders(organizationId: string): Promise<PharmacyOrder[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("pharmacy_orders")
    .select("*, participant:participant_profiles(preferred_name)")
    .eq("organization_id", organizationId)
    .order("transmitted_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return (data || []).map((row: any): PharmacyOrder => ({
    id: row.id,
    participant_name: row.participant?.preferred_name || "Unknown",
    pharmacy_name: row.pharmacy_name,
    medication_count: row.medication_ids?.length || 0,
    status: row.status,
    transmitted_at: row.transmitted_at,
    received_at: row.received_at,
  }));
}

// ── Update pharmacy order status ─────────────────────────────

export async function updatePharmacyOrderStatus(
  orderId: string,
  status: string,
  organizationId?: string
) {
  const supabase = await createServerSupabaseClient();

  const updates: Record<string, any> = { status };
  if (status === "received") updates.received_at = new Date().toISOString();
  if (status === "acknowledged") updates.acknowledged_at = new Date().toISOString();

  let query = (supabase as any)
    .from("pharmacy_orders")
    .update(updates)
    .eq("id", orderId);

  // Defense-in-depth: scope to org when provided
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/medications");
}

// ── Set Clinical PIN for a worker ────────────────────────────

export async function setClinicalPin(
  userId: string,
  organizationId: string,
  pin: string
) {
  const admin = createAdminSupabaseClient();

  // SHA-256 hash the PIN
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { error } = await (admin as any)
    .from("staff_profiles")
    .update({ clinical_pin_hash: pinHash })
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}
