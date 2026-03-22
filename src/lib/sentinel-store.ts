/**
 * @store SentinelStore
 * @status COMPLETE
 * @description Sentinel AI compliance alerts — real-time feed, acknowledgement, and escalation (Nightingale Phase 3)
 * @resetSafe NO — No reset() method for workspace switching
 * @lastAudit 2026-03-22
 */

import { create } from "zustand";
import { isFresh } from "./cache-utils";
import {
  fetchSentinelAlertsAction,
  acknowledgeSentinelAlertAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

export type AlertType =
  | "medication_missed"
  | "medication_refused"
  | "incident_critical"
  | "shift_no_notes"
  | "credential_expiring"
  | "credential_expired"
  | "goal_stalled"
  | "observation_abnormal"
  | "budget_exhausted"
  | "budget_threshold"
  | "service_gap"
  | "restrictive_practice"
  | "cancellation_rate"
  | "documentation_gap"
  | "other";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertStatus = "active" | "acknowledged" | "escalated" | "dismissed" | "resolved";

export interface SentinelAlert {
  id: string;
  organization_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string | null;
  participant_id: string | null;
  worker_id: string | null;
  shift_id: string | null;
  source_table: string | null;
  source_id: string | null;
  triggered_keywords: string[] | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

/* ── Helpers ─────────────────────────────────────────── */

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  medication_missed: "Medication Missed",
  medication_refused: "Medication Refused",
  incident_critical: "Critical Incident",
  shift_no_notes: "Shift Without Notes",
  credential_expiring: "Credential Expiring",
  credential_expired: "Credential Expired",
  goal_stalled: "Goal Stalled",
  observation_abnormal: "Abnormal Observation",
  budget_exhausted: "Budget Exhausted",
  budget_threshold: "Budget Threshold",
  service_gap: "Service Gap",
  restrictive_practice: "Restrictive Practice",
  cancellation_rate: "High Cancellation Rate",
  documentation_gap: "Documentation Gap",
  other: "Other",
};

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bg: string; border: string }> = {
  info: { label: "Info", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  warning: { label: "Warning", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  critical: { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-rose-400", bg: "bg-rose-500/10" },
  acknowledged: { label: "Acknowledged", color: "text-sky-400", bg: "bg-sky-500/10" },
  escalated: { label: "Escalated", color: "text-amber-400", bg: "bg-amber-500/10" },
  dismissed: { label: "Dismissed", color: "text-zinc-400", bg: "bg-zinc-500/10" },
  resolved: { label: "Resolved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

export const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  medication_missed: "💊",
  medication_refused: "🚫",
  incident_critical: "🚨",
  shift_no_notes: "📝",
  credential_expiring: "⏳",
  credential_expired: "🔴",
  goal_stalled: "📉",
  observation_abnormal: "🔬",
  budget_exhausted: "💸",
  budget_threshold: "⚠️",
  service_gap: "📅",
  restrictive_practice: "🔒",
  cancellation_rate: "📊",
  documentation_gap: "📋",
  other: "ℹ️",
};

/* ── Store ───────────────────────────────────────────── */

interface SentinelState {
  alerts: SentinelAlert[];
  loading: boolean;
  error: string | null;
  activeCount: number;
  criticalCount: number;
  _lastFetchedAt: number | null;

  // Actions
  fetchAlerts: (orgId: string, status?: AlertStatus) => Promise<void>;
  acknowledgeAlert: (id: string, action: string, notes?: string) => Promise<boolean>;
  refreshCounts: (orgId: string) => Promise<void>;
}

export const useSentinelStore = create<SentinelState>((set, get) => ({
  alerts: [],
  loading: false,
  error: null,
  activeCount: 0,
  criticalCount: 0,
  _lastFetchedAt: null,

  fetchAlerts: async (orgId, status) => {
    if (isFresh(get()._lastFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchSentinelAlertsAction(orgId, status);
      const alerts = (data ?? []) as unknown as SentinelAlert[];

      // Compute counts from fetched data
      const activeCount = alerts.filter((a) => a.status === "active").length;
      const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;

      set({ alerts, activeCount, criticalCount, loading: false, _lastFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  acknowledgeAlert: async (id, action, notes) => {
    try {
      const updated = await acknowledgeSentinelAlertAction(id, action, notes);
      const updatedAlert = updated as unknown as SentinelAlert;

      set((s) => {
        const newAlerts = s.alerts.map((a) => (a.id === id ? { ...a, ...updatedAlert } : a));
        const activeCount = newAlerts.filter((a) => a.status === "active").length;
        const criticalCount = newAlerts.filter((a) => a.severity === "critical" && a.status === "active").length;
        return { alerts: newAlerts, activeCount, criticalCount };
      });
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  refreshCounts: async (orgId) => {
    try {
      // Fetch only active alerts for count refresh (bypass cache)
      const data = await fetchSentinelAlertsAction(orgId, "active");
      const alerts = (data ?? []) as unknown as SentinelAlert[];
      const activeCount = alerts.length;
      const criticalCount = alerts.filter((a) => a.severity === "critical").length;

      set({ activeCount, criticalCount });
    } catch {
      // Non-blocking — counts are secondary
    }
  },
}));

/* ── Selectors ───────────────────────────────────────── */

export function useAlertsBySeverity(severity: AlertSeverity): SentinelAlert[] {
  const alerts = useSentinelStore((s) => s.alerts);
  return alerts.filter((a) => a.severity === severity);
}

export function useActiveAlerts(): SentinelAlert[] {
  const alerts = useSentinelStore((s) => s.alerts);
  return alerts.filter((a) => a.status === "active" || a.status === "escalated");
}
