import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import {
  type Integration,
  type IntegrationEvent,
  type IntegrationCategory,
} from "./integrations-data";
import {
  getIntegrations,
  getIntegrationsOverview,
  connectIntegration as connectIntegrationServer,
  disconnectIntegration as disconnectIntegrationServer,
  updateIntegrationSettings as updateSettingsServer,
  syncIntegration as syncIntegrationServer,
  type IntegrationsOverview,
} from "@/app/actions/integrations";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Types ────────────────────────────────────────────── */

export type IntegrationsTab = "all" | IntegrationCategory;

/* ── Helpers ──────────────────────────────────────────── */

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapServerIntegration(s: any, clientTemplate: Integration | undefined): Integration {
  if (!clientTemplate) {
    return {
      id: s.id,
      name: s.provider,
      description: "",
      category: "financial" as IntegrationCategory,
      status: s.status || "disconnected",
      lastSynced: s.last_sync ? timeSince(s.last_sync) : undefined,
      brandColor: "#666",
      iconBg: "from-gray-500 to-gray-600",
      logoType: "letter",
      logoContent: (s.provider || "?")[0].toUpperCase(),
    };
  }

  return {
    ...clientTemplate,
    id: s.id,
    status: s.status || clientTemplate.status,
    lastSynced: s.last_sync ? timeSince(s.last_sync) : clientTemplate.lastSynced,
    error: s.error_message || undefined,
  };
}

/* ── Store ────────────────────────────────────────────── */

interface IntegrationsState {
  integrations: Integration[];
  events: IntegrationEvent[];
  overview: IntegrationsOverview | null;
  activeTab: IntegrationsTab;
  searchQuery: string;
  configPanelId: string | null;
  stripeModalOpen: boolean;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;
  _stale: boolean;
  _lastFetchedAt: number | null;

  setActiveTab: (tab: IntegrationsTab) => void;
  setSearchQuery: (q: string) => void;
  openConfigPanel: (id: string) => void;
  closeConfigPanel: () => void;
  setStripeModalOpen: (open: boolean) => void;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  handleRealtimeUpdate: () => void;

  connect: (id: string) => void;
  disconnect: (id: string) => void;
  toggleSyncSetting: (integrationId: string, settingId: string) => void;
  updateAccountMapping: (integrationId: string, mappingId: string, value: string) => void;
  syncNow: (id: string) => void;
  addEvent: (event: Omit<IntegrationEvent, "id">) => void;

  connectServer: (id: string, connectionId?: string) => Promise<{ error: string | null }>;
  disconnectServer: (id: string) => Promise<{ error: string | null }>;
  syncNowServer: (id: string) => Promise<{ error: string | null }>;
  updateSyncSettingsServer: (integrationId: string, settingId: string) => Promise<{ error: string | null }>;
  updateAccountMappingServer: (integrationId: string, mappingId: string, value: string) => Promise<{ error: string | null }>;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
  integrations: [],
  events: [],
  overview: null,
  activeTab: "all",
  searchQuery: "",
  configPanelId: null,
  stripeModalOpen: false,
  loaded: false,
  loading: false,
  orgId: null,
  _stale: true,
  _lastFetchedAt: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  openConfigPanel: (id) => set({ configPanelId: id }),
  closeConfigPanel: () => set({ configPanelId: null }),
  setStripeModalOpen: (open) => set({ stripeModalOpen: open }),

  /* ── Server sync ───────────────────────────── */

  loadFromServer: async (orgId: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId) return;

    const hasCache = state.integrations.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId });

    try {
      const [integrationsRes, overviewRes] = await Promise.all([
        getIntegrations(orgId),
        getIntegrationsOverview(orgId),
      ]);

      const serverIntegrations = integrationsRes.data
        ? (integrationsRes.data as any[]).map((s: any) => mapServerIntegration(s, undefined))
        : [];

      set({
        integrations: serverIntegrations,
        overview: overviewRes.data || null,
        loaded: true,
        loading: false,
        _stale: false,
        _lastFetchedAt: Date.now(),
      });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;

    try {
      const [integrationsRes, overviewRes] = await Promise.all([
        getIntegrations(orgId),
        getIntegrationsOverview(orgId),
      ]);

      if (integrationsRes.data) {
        set({ integrations: (integrationsRes.data as any[]).map((s: any) => mapServerIntegration(s, undefined)) });
      }

      if (overviewRes.data) set({ overview: overviewRes.data });
      set({ _lastFetchedAt: Date.now(), _stale: false });
    } catch {
      // Silently fail
    }
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },

  /* ── Local optimistic actions ──────────────── */

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

    // INCOMPLETE:BLOCKED(BACKEND) — syncNow uses setTimeout(2000) to fake sync completion; no real backend sync call. Wire to triggerSync server action.
  syncNow: (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: "syncing" as const } : i
      ),
    }));
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

  /* ── Server-backed actions ─────────────────── */

  connectServer: async (id, connectionId) => {
    get().connect(id);
    const res = await connectIntegrationServer(id, connectionId);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  disconnectServer: async (id) => {
    get().disconnect(id);
    const res = await disconnectIntegrationServer(id);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  syncNowServer: async (id) => {
    set((s) => ({
      integrations: s.integrations.map((i) =>
        i.id === id ? { ...i, status: "syncing" as const } : i
      ),
    }));
    const res = await syncIntegrationServer(id);
    if (!res.error) {
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: "connected" as const, lastSynced: "Just now" } : i
        ),
      }));
      get().addEvent({
        integrationId: id,
        integrationName: get().integrations.find((i) => i.id === id)?.name || "",
        type: "synced",
        description: "Manual sync completed",
        time: "Just now",
      });
    } else {
      get().refresh();
    }
    return { error: res.error };
  },

  updateSyncSettingsServer: async (integrationId, settingId) => {
    // Optimistic toggle
    get().toggleSyncSetting(integrationId, settingId);

    // Build settings object from current state
    const integration = get().integrations.find((i) => i.id === integrationId);
    if (!integration?.syncSettings) return { error: null };

    const settingsObj: Record<string, boolean> = {};
    for (const ss of integration.syncSettings) {
      settingsObj[ss.id] = ss.enabled;
    }

    const res = await updateSettingsServer(integrationId, { sync: settingsObj });
    if (res.error) {
      // Rollback
      get().toggleSyncSetting(integrationId, settingId);
    }
    return { error: res.error };
  },

  updateAccountMappingServer: async (integrationId, mappingId, value) => {
    // Optimistic update
    const prev = get().integrations.find((i) => i.id === integrationId)
      ?.accountMappings?.find((am) => am.id === mappingId)?.value;
    get().updateAccountMapping(integrationId, mappingId, value);

    // Build mappings object from current state
    const integration = get().integrations.find((i) => i.id === integrationId);
    if (!integration?.accountMappings) return { error: null };

    const mappingsObj: Record<string, string> = {};
    for (const am of integration.accountMappings) {
      mappingsObj[am.id] = am.value;
    }

    const res = await updateSettingsServer(integrationId, { mappings: mappingsObj });
    if (res.error && prev !== undefined) {
      // Rollback
      get().updateAccountMapping(integrationId, mappingId, prev);
    }
    return { error: res.error };
  },
    }),
    {
      name: "iworkr-integrations",
      onRehydrateStorage: () => (state) => {
        if (state && state.integrations && state.integrations.length > 0) {
          state.loaded = true;
        }
      },
      partialize: (state) => ({
        integrations: state.integrations,
        events: state.events,
        overview: state.overview,
        orgId: state.orgId,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);
