import { create } from "zustand";
import {
  automationFlows as initialFlows,
  executionLogs as initialLogs,
  type AutomationFlow,
  type ExecutionLog,
  type FlowStatus,
} from "./automations-data";
import {
  getAutomationFlows,
  getAutomationLogs,
  getAutomationStats,
  toggleFlowStatusRpc,
  setAllFlowsStatusRpc,
  archiveAutomationFlow as archiveFlowServer,
  duplicateAutomationFlow as duplicateFlowServer,
  type AutomationStats,
} from "@/app/actions/automations";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Store ────────────────────────────────────────────── */

export type AutomationsTab = "flows" | "activity";

interface AutomationsState {
  flows: AutomationFlow[];
  logs: ExecutionLog[];
  stats: AutomationStats | null;
  activeTab: AutomationsTab;
  searchQuery: string;
  masterPaused: boolean;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;

  setActiveTab: (tab: AutomationsTab) => void;
  setSearchQuery: (q: string) => void;

  toggleFlowStatus: (id: string) => void;
  toggleMasterPause: () => void;
  archiveFlow: (id: string) => void;
  duplicateFlow: (id: string) => void;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  handleRealtimeUpdate: () => void;

  toggleFlowStatusServer: (id: string) => Promise<{ error: string | null }>;
  toggleMasterPauseServer: () => Promise<{ error: string | null }>;
  archiveFlowServer: (id: string) => Promise<{ error: string | null }>;
  duplicateFlowServer: (id: string) => Promise<{ error: string | null }>;
}

function mapServerFlow(sf: any): AutomationFlow {
  const blocks = (sf.blocks || []).map((b: any) => ({
    id: b.id || `block-${Math.random().toString(36).slice(2, 6)}`,
    type: b.type || "action",
    label: b.label || b.action || "Action",
    config: b.config || b,
  }));

  return {
    id: sf.id,
    title: sf.name,
    description: sf.description || "",
    category: (sf.category || "operations") as "marketing" | "billing" | "operations",
    status: sf.status as FlowStatus,
    version: 1,
    icon: sf.category === "marketing" ? "MessageSquare" : sf.category === "billing" ? "Receipt" : "Zap",
    blocks,
    metrics: {
      runs24h: sf.run_count || 0,
      successRate: 98,
    },
    sparkline: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
    createdBy: sf.created_by || "System",
    lastEdited: sf.updated_at ? formatRelativeDate(sf.updated_at) : "Just now",
    createdAt: sf.created_at ? new Date(sf.created_at).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : "",
  };
}

function mapServerLog(sl: any): ExecutionLog {
  return {
    id: sl.id,
    flowId: sl.flow_id,
    flowTitle: sl.automation_flows?.name || "Unknown Flow",
    timestamp: sl.started_at ? formatTimestamp(sl.started_at) : "",
    triggerSource: sl.trigger_data?.event_type || "manual",
    status: sl.status === "success" ? "success" : sl.status === "scheduled" ? "success" : "failed",
    errorMessage: sl.error || undefined,
    duration: sl.result?.duration ? `${sl.result.duration}ms` : "",
  };
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-AU", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const useAutomationsStore = create<AutomationsState>((set, get) => ({
  flows: initialFlows,
  logs: initialLogs,
  stats: null,
  activeTab: "flows",
  searchQuery: "",
  masterPaused: false,
  loaded: false,
  loading: false,
  orgId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  /* ── Local optimistic actions ──────────────── */

  toggleFlowStatus: (id) =>
    set((s) => ({
      flows: s.flows.map((f) => {
        if (f.id !== id) return f;
        const next: FlowStatus = f.status === "active" ? "paused" : "active";
        return { ...f, status: next };
      }),
    })),

  toggleMasterPause: () =>
    set((s) => {
      const nowPaused = !s.masterPaused;
      return {
        masterPaused: nowPaused,
        flows: s.flows.map((f) =>
          f.status === "archived" || f.status === "draft"
            ? f
            : { ...f, status: nowPaused ? ("paused" as const) : ("active" as const) }
        ),
      };
    }),

  archiveFlow: (id) =>
    set((s) => ({
      flows: s.flows.map((f) =>
        f.id === id ? { ...f, status: "archived" as const } : f
      ),
    })),

  duplicateFlow: (id) => {
    const original = get().flows.find((f) => f.id === id);
    if (!original) return;
    const dupe: AutomationFlow = {
      ...original,
      id: `flow-${Date.now()}`,
      title: `${original.title} (Copy)`,
      status: "draft",
      version: 1,
      metrics: { runs24h: 0, successRate: 0 },
      sparkline: Array(24).fill(0),
      lastEdited: "Just now",
      createdAt: "Feb 2026",
    };
    set((s) => ({ flows: [dupe, ...s.flows] }));
  },

  /* ── Server sync ───────────────────────────── */

  loadFromServer: async (orgId: string) => {
    if (get().loaded || get().loading) return;
    set({ loading: true, orgId });
    try {
      const [flowsResult, logsResult, statsResult] = await Promise.all([
        getAutomationFlows(orgId),
        getAutomationLogs(orgId),
        getAutomationStats(orgId),
      ]);

      const serverFlows = flowsResult.data ? (flowsResult.data as any[]).map(mapServerFlow) : [];
      const serverLogs = logsResult.data ? (logsResult.data as any[]).map(mapServerLog) : [];

      set({
        flows: serverFlows.length > 0 ? serverFlows : initialFlows,
        logs: serverLogs.length > 0 ? serverLogs : initialLogs,
        stats: statsResult.data || null,
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;

    try {
      const [flowsResult, logsResult, statsResult] = await Promise.all([
        getAutomationFlows(orgId),
        getAutomationLogs(orgId),
        getAutomationStats(orgId),
      ]);

      if (flowsResult.data) {
        const mapped = (flowsResult.data as any[]).map(mapServerFlow);
        if (mapped.length > 0) set({ flows: mapped });
      }
      if (logsResult.data) {
        const mapped = (logsResult.data as any[]).map(mapServerLog);
        if (mapped.length > 0) set({ logs: mapped });
      }
      if (statsResult.data) set({ stats: statsResult.data });
    } catch {
      // Silently fail on refresh
    }
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },

  /* ── Server-backed actions ─────────────────── */

  toggleFlowStatusServer: async (id) => {
    // Optimistic
    get().toggleFlowStatus(id);
    const res = await toggleFlowStatusRpc(id);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  toggleMasterPauseServer: async () => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    const nowPaused = !get().masterPaused;
    // Optimistic
    get().toggleMasterPause();
    const res = await setAllFlowsStatusRpc(orgId, nowPaused);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  archiveFlowServer: async (id) => {
    // Optimistic
    get().archiveFlow(id);
    const res = await archiveFlowServer(id);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  duplicateFlowServer: async (id) => {
    // Optimistic local
    get().duplicateFlow(id);
    const res = await duplicateFlowServer(id);
    if (!res.error) get().refresh();
    return { error: res.error };
  },
}));
