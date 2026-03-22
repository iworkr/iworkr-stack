/**
 * @store IncidentsStore
 * @status COMPLETE
 * @description Incident reporting, investigation, and resolution state (Nightingale Phase 2)
 * @resetSafe NO — No reset() method for workspace switching
 * @lastAudit 2026-03-22
 */

import { create } from "zustand";
import { isFresh } from "./cache-utils";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────── */

export type IncidentCategory = "fall" | "medication_error" | "behavioral" | "environmental" | "injury" | "near_miss" | "property_damage" | "abuse_allegation" | "restrictive_practice" | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "reported" | "under_review" | "investigation" | "resolved" | "closed";

export interface Incident {
  id: string;
  organization_id: string;
  participant_id: string | null;
  worker_id: string;
  shift_id: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  location: string | null;
  occurred_at: string;
  reported_at: string;
  witnesses: unknown[];
  immediate_actions: string | null;
  photos: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  is_reportable: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  participant_name?: string;
  worker_name?: string;
  reviewer_name?: string;
}

/* ── Helpers ─────────────────────────────────────────── */

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  fall: "Fall", medication_error: "Medication Error", behavioral: "Behavioral",
  environmental: "Environmental", injury: "Injury", near_miss: "Near Miss",
  property_damage: "Property Damage", abuse_allegation: "Abuse Allegation",
  restrictive_practice: "Restrictive Practice", other: "Other",
};

export const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string; bg: string; border: string }> = {
  low: { label: "Low", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  critical: { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; bg: string }> = {
  reported: { label: "Reported", color: "text-amber-400", bg: "bg-amber-500/10" },
  under_review: { label: "Under Review", color: "text-sky-400", bg: "bg-sky-500/10" },
  investigation: { label: "Investigation", color: "text-purple-400", bg: "bg-purple-500/10" },
  resolved: { label: "Resolved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  closed: { label: "Closed", color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

/* ── Store ───────────────────────────────────────────── */

interface IncidentsState {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  _lastFetchedAt: number | null;

  // Filters
  severityFilter: IncidentSeverity | "all";
  statusFilter: IncidentStatus | "all";
  categoryFilter: IncidentCategory | "all";

  // Actions
  loadFromServer: (orgId: string) => Promise<void>;
  createIncident: (params: CreateIncidentParams) => Promise<Incident | null>;
  updateIncident: (id: string, updates: Partial<Incident>) => Promise<boolean>;
  setSeverityFilter: (f: IncidentSeverity | "all") => void;
  setStatusFilter: (f: IncidentStatus | "all") => void;
  setCategoryFilter: (f: IncidentCategory | "all") => void;
}

export interface CreateIncidentParams {
  organization_id: string;
  participant_id?: string;
  worker_id: string;
  shift_id?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location?: string;
  occurred_at: string;
  immediate_actions?: string;
}

export const useIncidentsStore = create<IncidentsState>((set, get) => ({
  incidents: [],
  loading: false,
  error: null,
  _lastFetchedAt: null,
  severityFilter: "all",
  statusFilter: "all",
  categoryFilter: "all",

  loadFromServer: async (orgId) => {
    if (isFresh(get()._lastFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("incidents")
        .select("*, profiles!worker_id ( full_name )")
        .eq("organization_id", orgId)
        .order("occurred_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const incidents: Incident[] = (data ?? []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as Record<string, unknown> | null;
        return {
          ...row,
          worker_name: (profile?.full_name as string) ?? null,
        } as Incident;
      });

      set({ incidents, loading: false, _lastFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createIncident: async (params) => {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("incidents")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      const incident = data as Incident;
      set((s) => ({ incidents: [incident, ...s.incidents] }));
      return incident;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updateIncident: async (id, updates) => {
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("incidents")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      set((s) => ({ incidents: s.incidents.map((i) => i.id === id ? { ...i, ...updates } : i) }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  setSeverityFilter: (f) => set({ severityFilter: f }),
  setStatusFilter: (f) => set({ statusFilter: f }),
  setCategoryFilter: (f) => set({ categoryFilter: f }),
}));

/* ── Selectors ───────────────────────────────────────── */

export function useFilteredIncidents() {
  const incidents = useIncidentsStore((s) => s.incidents);
  const severity = useIncidentsStore((s) => s.severityFilter);
  const status = useIncidentsStore((s) => s.statusFilter);
  const category = useIncidentsStore((s) => s.categoryFilter);

  return incidents.filter((i) => {
    if (severity !== "all" && i.severity !== severity) return false;
    if (status !== "all" && i.status !== status) return false;
    if (category !== "all" && i.category !== category) return false;
    return true;
  });
}
