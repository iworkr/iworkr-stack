import { create } from "zustand";
import {
  integrations as initialIntegrations,
  integrationEvents as initialEvents,
  type Integration,
  type IntegrationEvent,
  type IntegrationCategory,
  type IntegrationStatus,
} from "./integrations-data";

/* ── Types ────────────────────────────────────────────── */

export type IntegrationsTab = "all" | IntegrationCategory;

/* ── Store ────────────────────────────────────────────── */

interface IntegrationsState {
  integrations: Integration[];
  events: IntegrationEvent[];
  activeTab: IntegrationsTab;
  searchQuery: string;
  configPanelId: string | null;   // which integration's config panel is open
  stripeModalOpen: boolean;

  setActiveTab: (tab: IntegrationsTab) => void;
  setSearchQuery: (q: string) => void;
  openConfigPanel: (id: string) => void;
  closeConfigPanel: () => void;
  setStripeModalOpen: (open: boolean) => void;

  /* Actions */
  connect: (id: string) => void;
  disconnect: (id: string) => void;
  toggleSyncSetting: (integrationId: string, settingId: string) => void;
  updateAccountMapping: (integrationId: string, mappingId: string, value: string) => void;
  syncNow: (id: string) => void;
  addEvent: (event: Omit<IntegrationEvent, "id">) => void;
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  integrations: initialIntegrations,
  events: initialEvents,
  activeTab: "all",
  searchQuery: "",
  configPanelId: null,
  stripeModalOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  openConfigPanel: (id) => set({ configPanelId: id }),
  closeConfigPanel: () => set({ configPanelId: null }),
  setStripeModalOpen: (open) => set({ stripeModalOpen: open }),

  connect: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id
          ? { ...i, status: "connected" as const, lastSynced: "Just now", error: undefined }
          : i
      ),
    }));
    get().addEvent({
      integrationId: id,
      integrationName: get().integrations.find((i) => i.id === id)?.name || "",
      type: "connected",
      description: "Integration connected successfully",
      time: "Just now",
    });
  },

  disconnect: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id
          ? { ...i, status: "disconnected" as const, lastSynced: undefined, connectedAs: undefined, error: undefined }
          : i
      ),
      configPanelId: null,
    }));
    get().addEvent({
      integrationId: id,
      integrationName: get().integrations.find((i) => i.id === id)?.name || "",
      type: "disconnected",
      description: "Integration disconnected",
      time: "Just now",
    });
  },

  toggleSyncSetting: (integrationId, settingId) =>
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === integrationId
          ? {
              ...i,
              syncSettings: i.syncSettings?.map((ss) =>
                ss.id === settingId ? { ...ss, enabled: !ss.enabled } : ss
              ),
            }
          : i
      ),
    })),

  updateAccountMapping: (integrationId, mappingId, value) =>
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === integrationId
          ? {
              ...i,
              accountMappings: i.accountMappings?.map((am) =>
                am.id === mappingId ? { ...am, value } : am
              ),
            }
          : i
      ),
    })),

  syncNow: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: "syncing" as const } : i
      ),
    }));
    // Simulate sync completing after 2s
    setTimeout(() => {
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: "connected" as const, lastSynced: "Just now" } : i
        ),
      }));
      get().addEvent({
        integrationId: id,
        integrationName: get().integrations.find((i) => i.id === id)?.name || "",
        type: "synced",
        description: "Manual sync completed successfully",
        time: "Just now",
      });
    }, 2000);
  },

  addEvent: (event) =>
    set((s) => ({
      events: [{ ...event, id: `ie-${Date.now()}` }, ...s.events],
    })),
}));
