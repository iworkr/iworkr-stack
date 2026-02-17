import { create } from "zustand";
import {
  type Asset,
  type StockItem,
  type AssetAuditEntry,
  type AssetStatus,
} from "./assets-data";
import {
  getAssets,
  getInventoryItems,
  getAssetAudits,
  getAssetsOverview,
  toggleAssetCustody,
  consumeInventory as consumeInventoryServer,
  logAssetService,
  updateInventoryItem,
  updateAsset as updateAssetAction,
  createAsset as createAssetAction,
  createInventoryItem as createInventoryItemAction,
  type AssetsOverview,
  type CreateAssetParams,
  type CreateInventoryItemParams,
} from "@/app/actions/assets";

/* ── Types ────────────────────────────────────────────── */

export type AssetsTab = "fleet" | "inventory" | "audits";
export type ViewMode = "grid" | "list";

/* ── Helpers ─────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
}

function calcServiceDuePercent(lastService: string | null, nextService: string | null): number {
  if (!lastService || !nextService) return 0;
  const last = new Date(lastService).getTime();
  const next = new Date(nextService).getTime();
  const now = Date.now();
  const total = next - last;
  if (total <= 0) return 100;
  const elapsed = now - last;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function mapServerAsset(sa: any): Asset {
  return {
    id: sa.id,
    tag: sa.name?.match(/AST-\d+/)?.[0] || `AST-${sa.id.slice(0, 3).toUpperCase()}`,
    name: sa.name,
    category: sa.category || "equipment",
    status: sa.status === "retired" ? "maintenance" : sa.status || "available",
    assignee: sa.assigned_to_name || undefined,
    assigneeInitials: sa.assigned_to_name ? getInitials(sa.assigned_to_name) : undefined,
    image: sa.image_url || sa.category || "equipment",
    purchaseDate: formatDate(sa.purchase_date),
    purchasePrice: Number(sa.purchase_cost || 0),
    serialNumber: sa.serial_number || "",
    warrantyExpiry: "",
    depreciationRate: 20,
    serviceInterval: Math.round((sa.service_interval_days || 180) / 30),
    lastServiceDate: formatDate(sa.last_service),
    nextServiceDate: formatDate(sa.next_service),
    serviceDuePercent: calcServiceDuePercent(sa.last_service, sa.next_service),
    location: sa.location || "",
    locationCoords: sa.location_lat && sa.location_lng
      ? { lat: sa.location_lat, lng: sa.location_lng }
      : undefined,
    notes: sa.notes || undefined,
  };
}

function mapServerStock(si: any): StockItem {
  return {
    id: si.id,
    sku: si.sku || "",
    name: si.name,
    category: si.category || "",
    currentQty: si.quantity || 0,
    maxQty: si.max_quantity || 100,
    minLevel: si.min_quantity || 5,
    unitCost: Number(si.unit_cost || 0),
    supplier: si.supplier || "",
    binLocation: si.bin_location || si.location || "",
    lastRestocked: formatDate(si.updated_at),
  };
}

function mapServerAudit(aa: any): AssetAuditEntry {
  return {
    id: aa.id,
    assetId: aa.asset_id || aa.inventory_id || "",
    assetTag: "",
    assetName: "",
    type: aa.action === "check_out" || aa.action === "check_in" || aa.action === "updated"
      ? "transfer"
      : aa.action === "service" ? "service"
      : aa.action === "created" ? "create"
      : aa.action === "consumed" || aa.action === "stock_adjust" ? "stock_adjust"
      : "create",
    description: aa.notes || aa.action,
    user: aa.user_name || "System",
    time: aa.created_at
      ? new Date(aa.created_at).toLocaleString("en-AU", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "",
  };
}

/* ── Store ────────────────────────────────────────────── */

interface AssetsState {
  assets: Asset[];
  stock: StockItem[];
  auditLog: AssetAuditEntry[];
  overview: AssetsOverview | null;
  activeTab: AssetsTab;
  viewMode: ViewMode;
  searchQuery: string;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  handleRealtimeUpdate: () => void;

  setActiveTab: (tab: AssetsTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (q: string) => void;

  /* Asset CRUD */
  updateAssetStatus: (id: string, status: AssetStatus) => void;
  updateAssetStatusServer: (id: string, status: AssetStatus) => Promise<void>;
  assignAsset: (id: string, assignee: string, initials: string) => void;
  unassignAsset: (id: string) => void;

  /* Server-backed custody toggle */
  toggleCustodyServer: (assetId: string, targetUserId: string | null, notes?: string) => Promise<{ success: boolean; error?: string }>;

  /* Server-backed service logging */
  logServiceServer: (assetId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;

  /* Stock CRUD */
  adjustStock: (id: string, delta: number) => void;

  /* Server-backed stock adjust */
  adjustStockServer: (id: string, delta: number) => Promise<void>;

  /* Server-backed consume on job */
  consumeOnJob: (inventoryId: string, qty: number, jobId?: string, notes?: string) => Promise<{ success: boolean; error?: string }>;

  /* Server-backed create */
  createAssetServer: (params: CreateAssetParams) => Promise<{ data: any; error: string | null }>;
  createInventoryItemServer: (params: CreateInventoryItemParams) => Promise<{ data: any; error: string | null }>;

  /* Audit */
  addAuditEntry: (entry: Omit<AssetAuditEntry, "id">) => void;
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: [],
  stock: [],
  auditLog: [],
  overview: null,
  activeTab: "fleet",
  viewMode: "grid",
  searchQuery: "",
  loaded: false,
  loading: false,
  orgId: null,

  loadFromServer: async (orgId: string) => {
    if (get().loaded || get().loading) return;
    set({ loading: true, orgId });
    try {
      const [assetsResult, stockResult, auditsResult, overviewResult] = await Promise.all([
        getAssets(orgId),
        getInventoryItems(orgId),
        getAssetAudits(orgId),
        getAssetsOverview(orgId),
      ]);

      const mappedAssets = assetsResult.data
        ? (assetsResult.data as any[]).map(mapServerAsset)
        : [];

      const mappedStock = stockResult.data
        ? (stockResult.data as any[]).map(mapServerStock)
        : [];

      const mappedAudits = auditsResult.data
        ? (auditsResult.data as any[]).map(mapServerAudit)
        : [];

      set({
        assets: mappedAssets,
        stock: mappedStock,
        auditLog: mappedAudits,
        overview: overviewResult.data || null,
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
      const [assetsResult, stockResult, auditsResult, overviewResult] = await Promise.all([
        getAssets(orgId),
        getInventoryItems(orgId),
        getAssetAudits(orgId),
        getAssetsOverview(orgId),
      ]);

      set({
        assets: assetsResult.data
          ? (assetsResult.data as any[]).map(mapServerAsset) : get().assets,
        stock: stockResult.data
          ? (stockResult.data as any[]).map(mapServerStock) : get().stock,
        auditLog: auditsResult.data
          ? (auditsResult.data as any[]).map(mapServerAudit) : get().auditLog,
        overview: overviewResult.data || get().overview,
      });
    } catch {
      // silent refresh
    }
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  updateAssetStatus: (id, status) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  /** Optimistic status update + server persist */
  updateAssetStatusServer: async (id, status) => {
    // Optimistic
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
    // Server sync
    try {
      await updateAssetAction(id, { status });
      await get().refresh();
    } catch (err) {
      console.error("Failed to persist asset status update:", err);
    }
  },

  assignAsset: (id, assignee, initials) =>
    set((s) => ({
      assets: s.assets.map((a) =>
        a.id === id
          ? { ...a, status: "assigned" as const, assignee, assigneeInitials: initials }
          : a
      ),
    })),

  unassignAsset: (id) =>
    set((s) => ({
      assets: s.assets.map((a) =>
        a.id === id
          ? { ...a, status: "available" as const, assignee: undefined, assigneeInitials: undefined }
          : a
      ),
    })),

  toggleCustodyServer: async (assetId, targetUserId, notes) => {
    // Optimistic: update local
    if (targetUserId === null) {
      get().unassignAsset(assetId);
    }
    const { data, error } = await toggleAssetCustody(assetId, targetUserId, notes);
    if (error) return { success: false, error };
    await get().refresh();
    return { success: true };
  },

  logServiceServer: async (assetId, notes) => {
    const { data, error } = await logAssetService(assetId, notes);
    if (error) return { success: false, error };
    await get().refresh();
    return { success: true };
  },

  adjustStock: (id, delta) =>
    set((s) => ({
      stock: s.stock.map((item) =>
        item.id === id
          ? { ...item, currentQty: Math.max(0, Math.min(item.maxQty, item.currentQty + delta)) }
          : item
      ),
    })),

  adjustStockServer: async (id, delta) => {
    // Optimistic update
    get().adjustStock(id, delta);
    // Get current quantity
    const item = get().stock.find((s) => s.id === id);
    if (item) {
      await updateInventoryItem(id, { quantity: item.currentQty });
      await get().refresh();
    }
  },

  consumeOnJob: async (inventoryId, qty, jobId, notes) => {
    // Optimistic: decrement locally
    get().adjustStock(inventoryId, -qty);
    const { data, error } = await consumeInventoryServer(inventoryId, qty, jobId, notes);
    if (error) {
      // Rollback
      get().adjustStock(inventoryId, qty);
      return { success: false, error };
    }
    return { success: true };
  },

  createAssetServer: async (params) => {
    const res = await createAssetAction(params);
    if (!res.error) await get().refresh();
    return { data: res.data, error: res.error };
  },

  createInventoryItemServer: async (params) => {
    const res = await createInventoryItemAction(params);
    if (!res.error) await get().refresh();
    return { data: res.data, error: res.error };
  },

  addAuditEntry: (entry) =>
    set((s) => ({
      auditLog: [{ ...entry, id: `aud-${Date.now()}` }, ...s.auditLog],
    })),
}));
