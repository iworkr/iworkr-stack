/**
 * Care Command Store — Unified state for the Nightingale Command Center
 *
 * Replaces the scattered care-plans-store, budget-store, and sentinel-store
 * with a single, powerful store that drives the new care experience.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CareSnapshot {
  timestamp: string;
  participants: { active: number };
  shifts: { today: number; scheduled: number; in_progress: number; completed: number };
  clinical: {
    observations_24h: number;
    abnormal_observations: number;
    mar_entries_24h: number;
    mar_compliance_pct: number;
    mood_distribution: Record<string, number>;
    progress_notes_7d: number;
  };
  incidents: { critical: number; high: number; total: number };
  sentinel: {
    critical: number; warning: number; info: number; total: number;
    recent: SentinelAlert[];
  };
  credentials: { expiring_30d: number; expired: number };
  budget: {
    total: number; consumed: number; quarantined: number; available: number;
    utilization_pct: number;
  };
  claims: { total_count: number; total_paid: number; total_submitted: number; total_rejected: number };
  care_plans: { active: number; needs_review: number };
}

export interface SentinelAlert {
  id: string;
  organization_id: string;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "escalated" | "dismissed" | "resolved";
  title: string;
  description: string;
  participant_id: string | null;
  worker_id: string | null;
  shift_id: string | null;
  source_table: string | null;
  source_id: string | null;
  triggered_keywords: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  type: "observation" | "medication" | "incident" | "progress_note" | "sentinel_alert";
  timestamp: string;
  title: string;
  subtitle: string;
  severity?: "critical" | "warning" | "info" | "normal";
  participant_id?: string;
  participant_name?: string;
  worker_name?: string;
  metadata: Record<string, unknown>;
}

export interface CarePlan {
  id: string;
  organization_id: string;
  participant_id: string;
  title: string;
  status: "draft" | "active" | "under_review" | "archived";
  start_date: string | null;
  review_date: string | null;
  next_review_date: string | null;
  domains: Record<string, string>;
  assessor_name: string | null;
  assessor_role: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  care_goals?: CareGoal[];
}

export interface CareGoal {
  id: string;
  care_plan_id: string;
  title: string;
  description: string | null;
  status: "not_started" | "in_progress" | "achieved" | "on_hold" | "abandoned";
  priority: number;
  target_outcome: string | null;
  support_category: string | null;
  milestones: { title: string; target_date?: string; achieved: boolean }[];
  started_at: string | null;
  achieved_at: string | null;
}

export interface BudgetAllocation {
  id: string;
  organization_id: string;
  service_agreement_id: string;
  participant_id: string;
  category: "core" | "capacity_building" | "capital";
  total_budget: number;
  consumed_budget: number;
  quarantined_budget: number;
  created_at: string;
  updated_at: string;
  participant_name?: string;
}

export interface CredentialAlert {
  id: string;
  worker_name: string;
  credential_type: string;
  expires_at: string;
  verification_status: string;
  days_until_expiry: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════

export const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", dot: "bg-rose-500", glow: "shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]" },
  warning: { label: "Warning", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500", glow: "" },
  info: { label: "Info", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500", glow: "" },
  normal: { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", glow: "" },
} as const;

export const TIMELINE_TYPE_CONFIG = {
  observation: { label: "Observation", icon: "🫀", color: "text-sky-400", bg: "bg-sky-500/8" },
  medication: { label: "Medication", icon: "💊", color: "text-purple-400", bg: "bg-purple-500/8" },
  incident: { label: "Incident", icon: "⚠️", color: "text-rose-400", bg: "bg-rose-500/8" },
  progress_note: { label: "Progress Note", icon: "📝", color: "text-emerald-400", bg: "bg-emerald-500/8" },
  sentinel_alert: { label: "Sentinel Alert", icon: "🛡️", color: "text-amber-400", bg: "bg-amber-500/8" },
} as const;

export const PLAN_STATUS_CONFIG = {
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  under_review: { label: "Under Review", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  archived: { label: "Archived", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
} as const;

export const GOAL_STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "text-zinc-400", bg: "bg-zinc-500/10" },
  in_progress: { label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10" },
  achieved: { label: "Achieved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  on_hold: { label: "On Hold", color: "text-amber-400", bg: "bg-amber-500/10" },
  abandoned: { label: "Abandoned", color: "text-rose-400", bg: "bg-rose-500/10" },
} as const;

export const BUDGET_CATEGORY_CONFIG = {
  core: { label: "Core Supports", color: "text-blue-400", bg: "bg-blue-500/10", bar: "bg-blue-500" },
  capacity_building: { label: "Capacity Building", color: "text-violet-400", bg: "bg-violet-500/10", bar: "bg-violet-500" },
  capital: { label: "Capital", color: "text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
} as const;

export const ALERT_TYPE_LABELS: Record<string, string> = {
  progress_note_keywords: "Keyword Detection",
  health_baseline_deviation: "Health Baseline",
  medication_non_compliance: "Medication Alert",
  credential_expiry_escalation: "Credential Expiry",
  budget_overrun: "Budget Overrun",
  care_plan_review_due: "Plan Review Due",
  restrictive_practice_debrief_overdue: "RP Debrief Overdue",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════════════════

interface CareCommandState {
  // Dashboard snapshot
  snapshot: CareSnapshot | null;
  snapshotLoading: boolean;
  snapshotFetchedAt: number | null;

  // Timeline
  timeline: TimelineEvent[];
  timelineLoading: boolean;
  timelineParticipantFilter: string | null;

  // Sentinel alerts (full list)
  alerts: SentinelAlert[];
  alertsLoading: boolean;

  // Care plans
  plans: CarePlan[];
  plansLoading: boolean;
  selectedPlanId: string | null;

  // Budget
  allocations: BudgetAllocation[];
  allocationsLoading: boolean;

  // Credentials
  credentialAlerts: CredentialAlert[];

  // Actions
  fetchSnapshot: (orgId: string) => Promise<void>;
  fetchTimeline: (orgId: string, participantId?: string) => Promise<void>;
  fetchAlerts: (orgId: string) => Promise<void>;
  acknowledgeAlert: (id: string, action: string, notes?: string) => Promise<void>;
  fetchPlans: (orgId: string) => Promise<void>;
  fetchAllocations: (orgId: string) => Promise<void>;
  setTimelineParticipantFilter: (id: string | null) => void;
  setSelectedPlanId: (id: string | null) => void;
}

export const useCareCommandStore = create<CareCommandState>()(
  persist(
  (set, get) => ({
  snapshot: null,
  snapshotLoading: false,
  snapshotFetchedAt: null,
  timeline: [],
  timelineLoading: false,
  timelineParticipantFilter: null,
  alerts: [],
  alertsLoading: false,
  plans: [],
  plansLoading: false,
  selectedPlanId: null,
  allocations: [],
  allocationsLoading: false,
  credentialAlerts: [],

  fetchSnapshot: async (orgId) => {
    const STALE_MS = 3 * 60 * 1000;
    const { snapshotFetchedAt } = get();
    if (snapshotFetchedAt && Date.now() - snapshotFetchedAt < STALE_MS) return;

    set({ snapshotLoading: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("care-dashboard-snapshot");
      if (error) throw error;
      set({ snapshot: data as CareSnapshot, snapshotFetchedAt: Date.now() });
    } catch (e) {
      console.error("Failed to fetch care snapshot:", e);
    } finally {
      set({ snapshotLoading: false });
    }
  },

  fetchTimeline: async (orgId, participantId) => {
    set({ timelineLoading: true });
    try {
      const supabase = createClient();
      const events: TimelineEvent[] = [];

      // Fetch all event types in parallel
      const filters = participantId ? { participant_id: participantId } : {};
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const sb = supabase as any;
      const [obsRes, incRes, notesRes, alertRes] = await Promise.all([
        sb.from("health_observations").select("*, profiles!health_observations_recorded_by_fkey(full_name)").eq("organization_id", orgId).gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(50),
        sb.from("incidents").select("*, profiles!incidents_worker_id_fkey(full_name)").eq("organization_id", orgId).gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(50),
        sb.from("progress_notes").select("*, profiles!progress_notes_worker_id_fkey(full_name)").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        sb.from("sentinel_alerts").select("*").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
      ]);

      // Map observations
      for (const o of (obsRes.data || []) as any[]) {
        if (participantId && o.participant_id !== participantId) continue;
        events.push({
          id: o.id, type: "observation", timestamp: o.recorded_at,
          title: o.observation_type?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Observation",
          subtitle: o.is_abnormal ? "⚠ Abnormal reading" : (o.notes || "Normal range"),
          severity: o.is_abnormal ? "warning" : "normal",
          participant_id: o.participant_id, worker_name: o.profiles?.full_name,
          metadata: { value_numeric: o.value_numeric, unit: o.unit, is_abnormal: o.is_abnormal },
        });
      }

      // Map incidents
      for (const i of (incRes.data || []) as any[]) {
        if (participantId && i.participant_id !== participantId) continue;
        events.push({
          id: i.id, type: "incident", timestamp: i.occurred_at,
          title: i.title, subtitle: i.description?.slice(0, 100) || "",
          severity: i.severity === "critical" ? "critical" : i.severity === "high" ? "warning" : "normal",
          participant_id: i.participant_id, worker_name: i.profiles?.full_name,
          metadata: { category: i.category, severity: i.severity, status: i.status },
        });
      }

      // Map progress notes
      for (const n of (notesRes.data || []) as any[]) {
        if (participantId && n.participant_id !== participantId) continue;
        events.push({
          id: n.id, type: "progress_note", timestamp: n.created_at,
          title: `Shift Report${n.participant_mood ? ` — ${n.participant_mood}` : ""}`,
          subtitle: n.summary?.slice(0, 100) || "",
          severity: "normal",
          participant_id: n.participant_id, worker_name: n.profiles?.full_name,
          metadata: { mood: n.participant_mood, goals: n.goals_addressed },
        });
      }

      // Map sentinel alerts
      for (const a of (alertRes.data || []) as any[]) {
        if (participantId && a.participant_id !== participantId) continue;
        events.push({
          id: a.id, type: "sentinel_alert", timestamp: a.created_at,
          title: a.title, subtitle: a.description?.slice(0, 100) || "",
          severity: a.severity,
          participant_id: a.participant_id,
          metadata: { alert_type: a.alert_type, triggered_keywords: a.triggered_keywords, status: a.status },
        });
      }

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      set({ timeline: events, timelineParticipantFilter: participantId || null });
    } catch (e) {
      console.error("Failed to fetch timeline:", e);
    } finally {
      set({ timelineLoading: false });
    }
  },

  fetchAlerts: async (orgId) => {
    set({ alertsLoading: true });
    try {
      const supabase = createClient() as any;
      const { data } = await supabase.from("sentinel_alerts").select("*").eq("organization_id", orgId).in("status", ["active", "acknowledged", "escalated"]).order("created_at", { ascending: false }).limit(100);
      set({ alerts: (data || []) as SentinelAlert[] });
    } catch (e) {
      console.error("Failed to fetch alerts:", e);
    } finally {
      set({ alertsLoading: false });
    }
  },

  acknowledgeAlert: async (id, action, notes) => {
    try {
      const supabase = createClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates: Record<string, unknown> = {
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
        resolution_action: action,
      };

      if (action === "dismissed_false_positive") {
        updates.status = "dismissed";
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = notes;
      } else if (action === "incident_created") {
        updates.status = "resolved";
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = notes;
      } else if (action === "escalated_to_clinical") {
        updates.status = "escalated";
        updates.resolution_notes = notes;
      } else {
        updates.status = "acknowledged";
      }

      await supabase.from("sentinel_alerts").update(updates).eq("id", id);
      set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, ...updates } as SentinelAlert : a) }));
    } catch (e) {
      console.error("Failed to acknowledge alert:", e);
    }
  },

  fetchPlans: async (orgId) => {
    set({ plansLoading: true });
    try {
      const supabase = createClient() as any;
      const { data } = await supabase.from("care_plans").select("*, care_goals(*)").eq("organization_id", orgId).order("updated_at", { ascending: false });
      set({ plans: (data || []) as CarePlan[] });
    } catch (e) {
      console.error("Failed to fetch plans:", e);
    } finally {
      set({ plansLoading: false });
    }
  },

  fetchAllocations: async (orgId) => {
    set({ allocationsLoading: true });
    try {
      const supabase = createClient() as any;
      const { data } = await supabase.from("budget_allocations").select("*, participant_profiles(full_name)").eq("organization_id", orgId).order("updated_at", { ascending: false });
      set({
        allocations: ((data || []) as any[]).map((a) => ({
          ...a,
          total_budget: Number(a.total_budget),
          consumed_budget: Number(a.consumed_budget),
          quarantined_budget: Number(a.quarantined_budget),
          participant_name: a.participant_profiles?.full_name,
        })),
      });
    } catch (e) {
      console.error("Failed to fetch allocations:", e);
    } finally {
      set({ allocationsLoading: false });
    }
  },

  setTimelineParticipantFilter: (id) => set({ timelineParticipantFilter: id }),
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
  }),
  {
    name: "iworkr-care-command",
    partialize: (state) => ({
      snapshot: state.snapshot,
      snapshotFetchedAt: state.snapshotFetchedAt,
      alerts: state.alerts,
      plans: state.plans,
      allocations: state.allocations,
    }),
  }
  )
);

// ═══════════════════════════════════════════════════════════════════════════════
// Selectors
// ═══════════════════════════════════════════════════════════════════════════════

export const useActiveAlerts = () => useCareCommandStore((s) => s.alerts.filter((a) => a.status === "active"));
export const useCriticalAlerts = () => useCareCommandStore((s) => s.alerts.filter((a) => a.status === "active" && a.severity === "critical"));
export const useSelectedPlan = () => useCareCommandStore((s) => s.plans.find((p) => p.id === s.selectedPlanId) ?? null);
export const useActivePlans = () => useCareCommandStore((s) => s.plans.filter((p) => p.status === "active"));
export const useBudgetByCategory = () => {
  const allocations = useCareCommandStore((s) => s.allocations);
  const grouped: Record<string, { total: number; consumed: number; quarantined: number }> = {};
  for (const a of allocations) {
    if (!grouped[a.category]) grouped[a.category] = { total: 0, consumed: 0, quarantined: 0 };
    grouped[a.category].total += a.total_budget;
    grouped[a.category].consumed += a.consumed_budget;
    grouped[a.category].quarantined += a.quarantined_budget;
  }
  return grouped;
};
