import { create } from "zustand";
import {
  assets as initialAssets,
  stockItems as initialStock,
  auditLog as initialAudit,
  type Asset,
  type StockItem,
  type AssetAuditEntry,
  type AssetStatus,
} from "./assets-data";

/* ── Types ────────────────────────────────────────────── */

export type AssetsTab = "fleet" | "inventory" | "audits";
export type ViewMode = "grid" | "list";

/* ── Store ────────────────────────────────────────────── */

interface AssetsState {
  assets: Asset[];
  stock: StockItem[];
  auditLog: AssetAuditEntry[];
  activeTab: AssetsTab;
  viewMode: ViewMode;
  searchQuery: string;

  setActiveTab: (tab: AssetsTab) => void;
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (q: string) => void;

  /* Asset CRUD */
  updateAssetStatus: (id: string, status: AssetStatus) => void;
  assignAsset: (id: string, assignee: string, initials: string) => void;
  unassignAsset: (id: string) => void;

  /* Stock CRUD */
  adjustStock: (id: string, delta: number) => void;

  /* Audit */
  addAuditEntry: (entry: Omit<AssetAuditEntry, "id">) => void;
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  assets: initialAssets,
  stock: initialStock,
  auditLog: initialAudit,
  activeTab: "fleet",
  viewMode: "grid",
  searchQuery: "",

  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  updateAssetStatus: (id, status) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

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

  adjustStock: (id, delta) =>
    set((s) => ({
      stock: s.stock.map((item) =>
        item.id === id
          ? { ...item, currentQty: Math.max(0, Math.min(item.maxQty, item.currentQty + delta)) }
          : item
      ),
    })),

  addAuditEntry: (entry) =>
    set((s) => ({
      auditLog: [{ ...entry, id: `aud-${Date.now()}` }, ...s.auditLog],
    })),
}));
