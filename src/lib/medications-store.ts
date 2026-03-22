/**
 * @store MedicationsStore
 * @status COMPLETE
 * @description eMAR state — participant medications and administration records (Nightingale Phase 2)
 * @resetSafe YES — reset() method available for workspace switching
 * @lastAudit 2026-03-22
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { isFresh } from "@/lib/cache-utils";

/* ── Types ────────────────────────────────────────────── */

export type MedicationRoute = "oral" | "sublingual" | "topical" | "inhaled" | "subcutaneous" | "intramuscular" | "rectal" | "ophthalmic" | "otic" | "nasal" | "transdermal" | "other";

export type MedicationFrequency = "once_daily" | "twice_daily" | "three_times_daily" | "four_times_daily" | "every_morning" | "every_night" | "weekly" | "fortnightly" | "monthly" | "prn" | "other";

export type MAROutcome = "given" | "refused" | "absent" | "withheld" | "self_administered" | "prn_given" | "not_available" | "other";

export interface ParticipantMedication {
  id: string;
  organization_id: string;
  participant_id: string;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  route: MedicationRoute;
  frequency: MedicationFrequency;
  time_slots: string[];
  prescribing_doctor: string | null;
  pharmacy: string | null;
  start_date: string | null;
  end_date: string | null;
  is_prn: boolean;
  prn_reason: string | null;
  special_instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MAREntry {
  id: string;
  organization_id: string;
  medication_id: string;
  participant_id: string;
  worker_id: string;
  shift_id: string | null;
  outcome: MAROutcome;
  administered_at: string;
  notes: string | null;
  prn_effectiveness: string | null;
  prn_followup_at: string | null;
  prn_followup_done: boolean;
  witness_id: string | null;
  created_at: string;
  // Joined
  medication_name?: string;
  worker_name?: string;
}

/* ── Helpers ─────────────────────────────────────────── */

export const ROUTE_LABELS: Record<MedicationRoute, string> = {
  oral: "Oral", sublingual: "Sublingual", topical: "Topical", inhaled: "Inhaled",
  subcutaneous: "Subcutaneous", intramuscular: "Intramuscular", rectal: "Rectal",
  ophthalmic: "Ophthalmic", otic: "Otic", nasal: "Nasal", transdermal: "Transdermal", other: "Other",
};

export const FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  once_daily: "Once Daily", twice_daily: "Twice Daily", three_times_daily: "3x Daily",
  four_times_daily: "4x Daily", every_morning: "Every Morning", every_night: "Every Night",
  weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", prn: "PRN (As Needed)", other: "Other",
};

export const OUTCOME_LABELS: Record<MAROutcome, string> = {
  given: "Given", refused: "Refused", absent: "Absent", withheld: "Withheld",
  self_administered: "Self-administered", prn_given: "PRN Given", not_available: "Not Available", other: "Other",
};

export const OUTCOME_COLORS: Record<MAROutcome, string> = {
  given: "text-emerald-400", refused: "text-rose-400", absent: "text-amber-400", withheld: "text-amber-400",
  self_administered: "text-emerald-400", prn_given: "text-sky-400", not_available: "text-zinc-400", other: "text-zinc-400",
};

/* ── Store ───────────────────────────────────────────── */

interface MedicationsState {
  medications: ParticipantMedication[];
  marEntries: MAREntry[];
  loading: boolean;
  error: string | null;
  _lastFetchedAt: number | null;
  selectedParticipantId: string | null;

  loadMedications: (orgId: string, participantId?: string) => Promise<void>;
  loadMAREntries: (orgId: string, participantId: string, dateRange?: { from: string; to: string }) => Promise<void>;
  createMedication: (params: Omit<ParticipantMedication, "id" | "created_at" | "updated_at">) => Promise<ParticipantMedication | null>;
  updateMedication: (id: string, updates: Partial<ParticipantMedication>) => Promise<boolean>;
  recordAdministration: (params: Omit<MAREntry, "id" | "created_at">) => Promise<MAREntry | null>;
  setSelectedParticipantId: (id: string | null) => void;

  /** Reset all state for workspace switching */
  reset: () => void;
}

export const useMedicationsStore = create<MedicationsState>()(
  persist(
  (set, get) => ({
  medications: [],
  marEntries: [],
  loading: false,
  error: null,
  _lastFetchedAt: null,
  selectedParticipantId: null,

  loadMedications: async (orgId, participantId) => {
    // SWR: skip if data is fresh for the same participant
    const state = get();
    if (
      isFresh(state._lastFetchedAt) &&
      state.selectedParticipantId === (participantId ?? null) &&
      state.medications.length > 0
    ) return;

    // Don't show loading spinner if we have cached data
    const hasCache = state.medications.length > 0;
    set({ loading: !hasCache, error: null });
    try {
      const supabase = createClient();
      let query = supabase
        .from("participant_medications")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("medication_name");

      if (participantId) {
        query = query.eq("participant_id", participantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      set({ medications: (data ?? []) as ParticipantMedication[], loading: false, _lastFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  loadMAREntries: async (orgId, participantId, dateRange) => {
    try {
      const supabase = createClient();
      let query = supabase
        .from("medication_administration_records")
        .select("*, participant_medications!medication_id ( medication_name ), profiles!worker_id ( full_name )")
        .eq("organization_id", orgId)
        .eq("participant_id", participantId)
        .order("administered_at", { ascending: false })
        .limit(200);

      if (dateRange) {
        query = query.gte("administered_at", dateRange.from).lte("administered_at", dateRange.to);
      }

      const { data, error } = await query;
      if (error) throw error;

      const entries: MAREntry[] = (data ?? []).map((row: Record<string, unknown>) => {
        const med = row.participant_medications as Record<string, unknown> | null;
        const profile = row.profiles as Record<string, unknown> | null;
        return {
          ...row,
          medication_name: (med?.medication_name as string) ?? null,
          worker_name: (profile?.full_name as string) ?? null,
        } as MAREntry;
      });

      set({ marEntries: entries });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  createMedication: async (params) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("participant_medications")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      const med = data as ParticipantMedication;
      set((s) => ({ medications: [...s.medications, med] }));
      return med;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updateMedication: async (id, updates) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("participant_medications")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      set((s) => ({ medications: s.medications.map((m) => m.id === id ? { ...m, ...updates } : m) }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  recordAdministration: async (params) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("medication_administration_records")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      const entry = data as MAREntry;
      set((s) => ({ marEntries: [entry, ...s.marEntries] }));
      return entry;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  setSelectedParticipantId: (id) => set({ selectedParticipantId: id }),

  reset: () => {
    set({
      medications: [],
      marEntries: [],
      loading: false,
      error: null,
      _lastFetchedAt: null,
      selectedParticipantId: null,
    });
  },
  }),
  {
    name: "iworkr-medications",
    partialize: (state) => ({
      medications: state.medications,
      _lastFetchedAt: state._lastFetchedAt,
      selectedParticipantId: state.selectedParticipantId,
    }),
  }
  )
);
