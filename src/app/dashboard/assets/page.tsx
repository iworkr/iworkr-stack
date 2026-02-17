"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  Package,
  ClipboardList,
  Grid3X3,
  List,
  Search,
  DollarSign,
  AlertTriangle,
  Radio,
  Loader2,
  Inbox,
} from "lucide-react";
import { useMemo } from "react";
import { useAssetsStore, type AssetsTab, type ViewMode } from "@/lib/assets-store";
import { FleetGrid } from "@/components/assets/fleet-grid";
import { InventoryTable } from "@/components/assets/inventory-table";
import { AuditLog } from "@/components/assets/audit-log";

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: AssetsTab; label: string; icon: typeof Truck }[] = [
  { id: "fleet", label: "Fleet & Tools", icon: Truck },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "audits", label: "Audits", icon: ClipboardList },
];

export default function AssetsPage() {
  const {
    assets,
    stock,
    auditLog,
    activeTab,
    viewMode,
    searchQuery,
    loading,
    setActiveTab,
    setViewMode,
    setSearchQuery,
  } = useAssetsStore();

  /* ── Stats (Dynamic from DB) ────────────────────────── */
  const totalValue = useMemo(
    () => assets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0),
    [assets]
  );
  const lowStockCount = useMemo(
    () => stock.filter((s) => s.currentQty <= s.minLevel).length,
    [stock]
  );
  const vehiclesActive = useMemo(
    () => assets.filter((a) => a.category === "vehicle" && a.status === "assigned").length,
    [assets]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.assignee && a.assignee.toLowerCase().includes(q))
    );
  }, [assets, searchQuery]);

  const filteredStock = useMemo(() => {
    if (!searchQuery) return stock;
    const q = searchQuery.toLowerCase();
    return stock.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        s.supplier.toLowerCase().includes(q)
    );
  }, [stock, searchQuery]);

  const filteredAudit = useMemo(() => {
    if (!searchQuery) return auditLog;
    const q = searchQuery.toLowerCase();
    return auditLog.filter(
      (e) =>
        e.assetName.toLowerCase().includes(q) ||
        e.assetTag.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [auditLog, searchQuery]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-4 pb-0 pt-4 md:px-6 md:pt-5">
        {/* Title row */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Assets & Inventory</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">Track equipment, vehicles, and stock levels.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="h-8 w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>

            {/* View toggle (only for fleet tab) */}
            {activeTab === "fleet" && (
              <div className="flex rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1 rounded-l-lg px-2.5 py-1.5 text-[11px] transition-colors ${
                    viewMode === "grid"
                      ? "bg-[rgba(255,255,255,0.06)] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <Grid3X3 size={13} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 rounded-r-lg px-2.5 py-1.5 text-[11px] transition-colors ${
                    viewMode === "list"
                      ? "bg-[rgba(255,255,255,0.06)] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <List size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats ticker */}
        <div className="mb-4 flex flex-wrap items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <DollarSign size={13} className="text-emerald-500" />
            <span className="text-[11px] text-zinc-500">Total Asset Value</span>
            <span className="font-mono text-[12px] font-medium text-zinc-200">
              ${(totalValue / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className={lowStockCount > 0 ? "text-amber-500" : "text-zinc-600"} />
            <span className="text-[11px] text-zinc-500">Low Stock Alerts</span>
            <span className={`font-mono text-[12px] font-medium ${lowStockCount > 0 ? "text-amber-400" : "text-zinc-400"}`}>
              {lowStockCount}
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Radio size={13} className="text-blue-500" />
            <span className="text-[11px] text-zinc-500">Vehicles Active</span>
            <span className="font-mono text-[12px] font-medium text-zinc-200">{vehiclesActive}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon size={14} strokeWidth={1.5} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="assets-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
            <p className="mt-3 text-[12px] text-zinc-600">Loading assets…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "fleet" && (
              <motion.div
                key="fleet"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Truck size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                    <p className="text-[13px] font-medium text-zinc-500">No assets found</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {searchQuery ? "Try adjusting your search." : "Assets will appear here once added."}
                    </p>
                  </div>
                ) : viewMode === "grid" ? (
                  <FleetGrid assets={filteredAssets} />
                ) : (
                  <FleetListView assets={filteredAssets} />
                )}
              </motion.div>
            )}

            {activeTab === "inventory" && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {filteredStock.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Package size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                    <p className="text-[13px] font-medium text-zinc-500">No inventory items</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {searchQuery ? "Try adjusting your search." : "Inventory will appear here once added."}
                    </p>
                  </div>
                ) : (
                  <InventoryTable items={filteredStock} />
                )}
              </motion.div>
            )}

            {activeTab === "audits" && (
              <motion.div
                key="audits"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {filteredAudit.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <ClipboardList size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                    <p className="text-[13px] font-medium text-zinc-500">No audit entries</p>
                    <p className="mt-1 text-[11px] text-zinc-600">Activity will be logged here.</p>
                  </div>
                ) : (
                  <AuditLog entries={filteredAudit} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ── Fleet List View (Dense) ─────────────────────────── */

import { useRouter } from "next/navigation";
import { type Asset } from "@/lib/assets-data";

function FleetListView({ assets }: { assets: Asset[] }) {
  const router = useRouter();

  const statusConfig = {
    available: { color: "bg-emerald-500", label: "Available" },
    assigned: { color: "bg-blue-500", label: "Assigned" },
    maintenance: { color: "bg-red-500", label: "Maintenance" },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)]">
      <div className="grid grid-cols-[80px_1fr_100px_120px_140px_80px] gap-3 border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Tag</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Name</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Category</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Status</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Assignee</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Service</span>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {assets.map((asset, i) => {
          const status = statusConfig[asset.status];
          return (
            <motion.button
              key={asset.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
              className="grid w-full grid-cols-[80px_1fr_100px_120px_140px_80px] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              <span className="font-mono text-[10px] text-zinc-600">{asset.tag}</span>
              <span className="truncate text-[12px] text-zinc-300">{asset.name}</span>
              <span className="text-[10px] capitalize text-zinc-500">{asset.category}</span>
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
                <span className="text-[10px] text-zinc-500">{status.label}</span>
              </div>
              <span className="truncate text-[10px] text-zinc-500">{asset.assignee || "—"}</span>
              <div className="h-[3px] rounded-full bg-zinc-900">
                <div
                  className={`h-full rounded-full ${
                    asset.serviceDuePercent >= 90 ? "bg-red-500" :
                    asset.serviceDuePercent >= 70 ? "bg-amber-500" :
                    "bg-emerald-500/60"
                  }`}
                  style={{ width: `${asset.serviceDuePercent}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
