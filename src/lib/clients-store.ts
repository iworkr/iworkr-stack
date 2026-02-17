import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import { type Client } from "./data";
import {
  getClients,
  getClientsWithStats,
  createClientFull,
  updateClient as updateClientAction,
  deleteClient as deleteClientAction,
  type CreateClientParams,
} from "@/app/actions/clients";

function getInitials(name: string): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatCurrency(num: number): string {
  return `$${num.toLocaleString("en-AU")}`;
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function mapServerClient(sc: any): Client {
  const totalSpend = Number(sc.total_spend || 0);
  return {
    id: sc.id,
    name: sc.name,
    email: sc.email || "",
    phone: sc.phone || "",
    initials: getInitials(sc.name),
    totalJobs: Number(sc.job_count || 0),
    lifetimeValue: formatCurrency(totalSpend),
    lifetimeValueNum: totalSpend,
    lastJob: sc.last_job_date ? formatRelativeDate(sc.last_job_date) : "Never",
    status: sc.status || "lead",
    type: sc.type || "residential",
    address: sc.address,
    addressCoords: sc.address_lat && sc.address_lng ? { lat: sc.address_lat, lng: sc.address_lng } : undefined,
    tags: sc.tags || [],
    notes: sc.notes,
    since: sc.since ? new Date(sc.since).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : undefined,
    contacts: sc.client_contacts?.map((cc: any) => ({
      id: cc.id,
      name: cc.name,
      initials: getInitials(cc.name),
      role: cc.role || "",
      email: cc.email || "",
      phone: cc.phone || "",
    })),
  };
}

interface ClientsState {
  clients: Client[];
  focusedIndex: number;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;
  filterStatus: string | null;
  filterType: string | null;

  setFocusedIndex: (i: number) => void;
  setFilterStatus: (status: string | null) => void;
  setFilterType: (type: string | null) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  updateClientServer: (id: string, patch: Partial<Client>) => Promise<void>;
  archiveClient: (id: string) => void;
  archiveClientServer: (id: string) => Promise<void>;
  restoreClient: (client: Client) => void;
  _stale: boolean;
  _lastFetchedAt: number | null;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;

  /** Server-synced create — persists to DB and updates local state */
  createClientServer: (params: CreateClientParams) => Promise<{ success: boolean; clientId?: string; error?: string }>;
}

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
  clients: [],
  focusedIndex: 0,
  loaded: false,
  loading: false,
  orgId: null,
  filterStatus: null,
  filterType: null,
  _stale: true,
  _lastFetchedAt: null,

  setFocusedIndex: (i) => set({ focusedIndex: i }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterType: (type) => set({ filterType: type }),

  addClient: (client) =>
    set((s) => ({ clients: [client, ...s.clients] })),

  updateClient: (id, patch) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  /** Optimistic update + server persist */
  updateClientServer: async (id, patch) => {
    // Optimistic
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    // Build server-compatible patch
    const serverPatch: Record<string, unknown> = {};
    if (patch.tags !== undefined) serverPatch.tags = patch.tags;
    if (patch.notes !== undefined) serverPatch.notes = patch.notes;
    if (patch.status !== undefined) serverPatch.status = patch.status;
    if (patch.name !== undefined) serverPatch.name = patch.name;
    if (patch.email !== undefined) serverPatch.email = patch.email;
    if (patch.phone !== undefined) serverPatch.phone = patch.phone;
    if (patch.address !== undefined) serverPatch.address = patch.address;
    if (patch.type !== undefined) serverPatch.type = patch.type;
    // Server sync
    updateClientAction(id, serverPatch as any).catch((err) => {
      console.error("Failed to persist client update:", err);
    });
  },

  archiveClient: (id) =>
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
    })),

  /** Optimistic archive + server persist */
  archiveClientServer: async (id) => {
    // Optimistic
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
    }));
    // Server sync
    deleteClientAction(id).catch((err) => {
      console.error("Failed to persist client archive:", err);
    });
  },

  restoreClient: (client) =>
    set((s) => ({
      clients: [...s.clients, client].sort((a, b) => a.id.localeCompare(b.id)),
    })),

  loadFromServer: async (orgId: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId) return;

    const hasCache = state.clients.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId });

    try {
      const { data, error } = await getClientsWithStats(orgId);
      if (data && !error) {
        const mapped = (data as any[]).map(mapServerClient);
        set({ clients: mapped, loaded: true, loading: false, _stale: false, _lastFetchedAt: Date.now() });
      } else {
        set({ loaded: true, loading: false });
      }
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;
    try {
      const { data, error } = await getClientsWithStats(orgId);
      if (data && !error) {
        const mapped = (data as any[]).map(mapServerClient);
        set({ clients: mapped, _lastFetchedAt: Date.now(), _stale: false });
      }
    } catch {
      // silent refresh failure
    }
  },

  createClientServer: async (params: CreateClientParams) => {
    try {
      const { data, error } = await createClientFull(params);
      if (error || !data) {
        return { success: false, error: error || "Failed to create client" };
      }

      // Map and prepend to local store
      const mapped = mapServerClient(data);
      set((s) => ({ clients: [mapped, ...s.clients] }));
      return { success: true, clientId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message || "Unexpected error" };
    }
  },
    }),
    {
      name: "iworkr-clients",
      partialize: (state) => ({
        clients: state.clients,
        orgId: state.orgId,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);
