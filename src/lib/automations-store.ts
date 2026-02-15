import { create } from "zustand";
import {
  automationFlows as initialFlows,
  executionLogs as initialLogs,
  type AutomationFlow,
  type ExecutionLog,
  type FlowStatus,
} from "./automations-data";

/* ── Store ────────────────────────────────────────────── */

export type AutomationsTab = "flows" | "activity";

interface AutomationsState {
  flows: AutomationFlow[];
  logs: ExecutionLog[];
  activeTab: AutomationsTab;
  searchQuery: string;
  masterPaused: boolean;

  setActiveTab: (tab: AutomationsTab) => void;
  setSearchQuery: (q: string) => void;

  toggleFlowStatus: (id: string) => void;
  toggleMasterPause: () => void;
  archiveFlow: (id: string) => void;
  duplicateFlow: (id: string) => void;
}

export const useAutomationsStore = create<AutomationsState>((set, get) => ({
  flows: initialFlows,
  logs: initialLogs,
  activeTab: "flows",
  searchQuery: "",
  masterPaused: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),

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
}));
