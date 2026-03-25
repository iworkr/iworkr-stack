/**
 * @page /dashboard/ops/inventory
 * @status COMPLETE
 * @description Vault-Track Inventory Command Center — multi-location stock,
 *   immutable transaction ledger, CSV import, margin tracking
 * @dataSource server-action
 * @lastAudit 2026-03-24
 */
"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, AlertTriangle, TrendingUp, TrendingDown,
  BarChart3, Upload, RefreshCw, Filter, ChevronDown, ArrowUpDown,
  MapPin, History, FileSpreadsheet, Warehouse, Truck, ArrowLeftRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getInventoryItems, getInventoryOverview, createInventoryItem,
  bulkPriceAdjustment,
} from "@/app/actions/hephaestus";
import {
  getInventoryDashboard, getLocations, createLocation,
  getTransactionLedger, getInventoryLevels, importSupplierPriceCSV,
  type InventoryDashboard, type InventoryLocation, type InventoryTransaction, type InventoryLevel,
} from "@/app/actions/vault-track";

/* ── Types ────────────────────────────────────────── */

interface InventoryItem {
  id: string;
  name: string | null;
  sku: string | null;
  category: string | null;
  trade_category?: string | null;
  quantity: number | null;
  min_quantity: number | null;
  unit_cost: number | null;
  moving_average_cost?: number | null;
  latest_cost?: number | null;
  sell_price?: number | null;
  stock_level: string | null;
  brand?: string | null;
  unit?: string | null;
  supplier?: string | null;
  barcode?: string | null;
  bin_location?: string | null;
  location?: string | null;
  max_quantity?: number | null;
}

interface Overview {
  total_inventory_value: number;
  low_stock_count: number;
  critical_stock_count: number;
  kits_below_margin: number;
  pending_supplier_invoices: number;
}

/* ── Page ─────────────────────────────────────────── */

type VaultTab = "items" | "locations" | "ledger" | "csv";

export default function InventoryPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [activeTab, setActiveTab] = useState<VaultTab>("items");

  const orgId = org?.id;
  const queryClient = useQueryClient();

  const { data: inventoryData, isLoading: loading } = useQuery<{
    items: InventoryItem[];
    overview: Overview | null;
    count: number;
  }>({
    queryKey: [...queryKeys.ops.inventory(orgId!), { search, stockFilter }],
    queryFn: async () => {
      const [itemsRes, overviewRes] = await Promise.all([
        getInventoryItems(orgId!, { search, stockLevel: stockFilter || undefined }),
        getInventoryOverview(orgId!),
      ]);
      return {
        items: itemsRes.data ?? [],
        overview: (overviewRes.data as Overview) ?? null,
        count: itemsRes.count,
      };
    },
    enabled: !!orgId,
  });

  const items = inventoryData?.items ?? [];
  const overview = inventoryData?.overview ?? null;
  const count = inventoryData?.count ?? 0;

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

  return (
    <div className="stealth-page-canvas">
      {/* ── Header ─────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Inventory Command Center
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Materials, stock levels, and cost tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="stealth-btn-ghost text-xs flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Bulk Price Adjust
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="stealth-btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ───────────────────────── */}
      {overview && (
        <div className="h-16 flex items-center gap-6 px-4 bg-zinc-950/30 border-b border-[var(--border-base)] mb-4">
          <TelemetryPill
            label="TOTAL STOCK VALUE"
            value={formatMoney(overview.total_inventory_value)}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
          />
          <div className="w-px h-8 bg-[var(--border-base)]" />
          <TelemetryPill
            label="KITS BELOW MARGIN"
            value={String(overview.kits_below_margin)}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            pulse={overview.kits_below_margin > 0}
            variant={overview.kits_below_margin > 0 ? "amber" : "default"}
          />
          <div className="w-px h-8 bg-[var(--border-base)]" />
          <TelemetryPill
            label="LOW STOCK ALERTS"
            value={String(overview.low_stock_count)}
            icon={<TrendingDown className="w-3.5 h-3.5" />}
            variant={overview.low_stock_count > 0 ? "rose" : "default"}
          />
          <div className="w-px h-8 bg-[var(--border-base)]" />
          <TelemetryPill
            label="PENDING INVOICES"
            value={String(overview.pending_supplier_invoices)}
            icon={<Upload className="w-3.5 h-3.5" />}
            variant={overview.pending_supplier_invoices > 0 ? "blue" : "default"}
          />
        </div>
      )}

      {/* ── Tab Navigation ────────────────────────── */}
      <div className="flex items-center gap-1 px-4 mb-4 border-b border-[var(--border-base)]">
        {([
          { id: "items" as VaultTab, label: "Items", icon: <Package className="w-3.5 h-3.5" /> },
          { id: "locations" as VaultTab, label: "Locations", icon: <MapPin className="w-3.5 h-3.5" /> },
          { id: "ledger" as VaultTab, label: "Transaction Ledger", icon: <History className="w-3.5 h-3.5" /> },
          { id: "csv" as VaultTab, label: "CSV Import", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "items" && (
        <>
      {/* ── Search & Filters ───────────────────────── */}
      <div className="flex items-center gap-3 px-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
          />
        </div>

        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)]"
        >
          <option value="">All Stock Levels</option>
          <option value="ok">OK</option>
          <option value="low">Low</option>
          <option value="critical">Critical</option>
        </select>

        <button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.ops.inventory(orgId!) })} className="stealth-btn-ghost text-xs p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Table ──────────────────────────────────── */}
      <div className="px-4">
        <div className="border border-[var(--border-base)] r-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="stealth-table-header">
                <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Item</th>
                <th className="text-left px-3 py-3 font-medium text-[var(--text-muted)]">SKU</th>
                <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">Stock</th>
                <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">
                  <span className="font-mono">MAC</span>
                </th>
                <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">Latest Cost</th>
                <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">Sell</th>
                <th className="text-center px-3 py-3 font-medium text-[var(--text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="stealth-table-row">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[var(--text-muted)]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No inventory items yet</p>
                    <p className="text-xs mt-1">Add items or seed from the trade catalog</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="stealth-table-row group cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="text-[var(--text-primary)] font-medium">{item.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {item.brand && <span>{item.brand} · </span>}
                        {item.category || item.trade_category || "Uncategorized"}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {item.sku || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-[var(--text-primary)]">
                      {item.quantity}
                      <span className="text-[var(--text-muted)] text-xs ml-1">
                        {item.unit || "ea"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-[var(--text-primary)]">
                      {formatMoney(item.moving_average_cost ?? item.unit_cost ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      <span className={
                        (item.latest_cost ?? 0) > (item.moving_average_cost ?? 0)
                          ? "text-rose-400"
                          : (item.latest_cost ?? 0) < (item.moving_average_cost ?? 0)
                          ? "text-emerald-400"
                          : "text-[var(--text-muted)]"
                      }>
                        {formatMoney(item.latest_cost ?? item.unit_cost ?? 0)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-[var(--text-primary)]">
                      {formatMoney(item.sell_price ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StockBadge level={item.stock_level ?? "ok"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {count > 0 && (
          <div className="mt-3 text-xs text-[var(--text-muted)]">
            Showing {items.length} of {count} items
          </div>
        )}
      </div>

      </>
      )}

      {activeTab === "locations" && orgId && <LocationsTab orgId={orgId} />}
      {activeTab === "ledger" && orgId && <LedgerTab orgId={orgId} />}
      {activeTab === "csv" && orgId && <CSVImportTab orgId={orgId} />}

      {/* ── Bulk Price Adjustment Modal ─────────────── */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkPriceModal
            orgId={orgId!}
            onClose={() => setShowBulkModal(false)}
            onComplete={() => { setShowBulkModal(false); queryClient.invalidateQueries({ queryKey: queryKeys.ops.inventory(orgId!) }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────── */

function TelemetryPill({
  label, value, icon, pulse, variant = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  pulse?: boolean;
  variant?: "default" | "amber" | "rose" | "blue";
}) {
  const colors = {
    default: "text-[var(--text-muted)]",
    amber: "text-amber-400",
    rose: "text-rose-400",
    blue: "text-blue-400",
  };

  return (
    <div className={`flex items-center gap-2 ${pulse ? "animate-pulse" : ""}`}>
      <div className={colors[variant]}>{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">
          {label}
        </div>
        <div className={`text-sm font-mono font-semibold ${colors[variant] === colors.default ? "text-[var(--text-primary)]" : colors[variant]}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    low: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border r-badge ${styles[level] || styles.ok}`}>
      {level}
    </span>
  );
}

/* ── Locations Tab ──────────────────────────────────── */

function LocationsTab({ orgId }: { orgId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("WAREHOUSE");
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboard } = useQuery<InventoryDashboard | null>({
    queryKey: ["vault-track-dashboard", orgId],
    queryFn: () => getInventoryDashboard(orgId),
    enabled: !!orgId,
  });

  const { data: locations = [] } = useQuery<InventoryLocation[]>({
    queryKey: ["vault-track-locations", orgId],
    queryFn: () => getLocations(orgId),
    enabled: !!orgId,
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await createLocation(orgId, newName.trim(), newType);
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ["vault-track-locations", orgId] });
    queryClient.invalidateQueries({ queryKey: ["vault-track-dashboard", orgId] });
  };

  const locationIcon = (type: string) => {
    switch (type) {
      case "VAN": return <Truck className="w-4 h-4 text-blue-400" />;
      case "WAREHOUSE": return <Warehouse className="w-4 h-4 text-emerald-400" />;
      case "SITE": return <MapPin className="w-4 h-4 text-amber-400" />;
      default: return <Package className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="px-4">
      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Locations", value: dashboard.total_locations, color: "text-emerald-400" },
            { label: "Total Items", value: dashboard.total_items, color: "text-blue-400" },
            { label: "Low Stock", value: dashboard.low_stock_count, color: "text-amber-400" },
            { label: "Critical", value: dashboard.critical_stock_count, color: "text-rose-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">{stat.label}</div>
              <div className={`text-2xl font-mono font-bold mt-1 ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Location list */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inventory Locations</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="stealth-btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Location
        </button>
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-4 bg-[var(--surface-1)] border border-[var(--border-base)] rounded-lg"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g. "Van #4", "Main Warehouse"'
                className="w-full px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] rounded-md text-[var(--text-primary)] focus-ring"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] rounded-md text-[var(--text-primary)]"
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="VAN">Van</option>
                <option value="SITE">Site</option>
                <option value="OFFICE">Office</option>
                <option value="CONTAINER">Container</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="stealth-btn-primary text-xs"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-2">
        {locations.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No locations configured</p>
            <p className="text-xs mt-1">Add a warehouse or van to start tracking multi-location inventory</p>
          </div>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center gap-4 p-4 bg-[var(--surface-1)] border border-[var(--border-base)] rounded-lg hover:border-[var(--border-hover)] transition-colors"
            >
              {locationIcon(loc.type)}
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">{loc.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{loc.type}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-[var(--text-primary)]">{loc.item_count ?? "—"} items</div>
                <div className="text-xs text-[var(--text-muted)]">{loc.total_units ?? 0} units</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Transaction Ledger Tab ────────────────────────────── */

function LedgerTab({ orgId }: { orgId: string }) {
  const [typeFilter, setTypeFilter] = useState("");

  const { data: transactions = [], isLoading } = useQuery<InventoryTransaction[]>({
    queryKey: ["vault-track-ledger", orgId, typeFilter],
    queryFn: () =>
      getTransactionLedger(orgId, {
        transaction_type: typeFilter || undefined,
        limit: 200,
      }),
    enabled: !!orgId,
  });

  const txnColors: Record<string, string> = {
    CONSUMED: "text-rose-400 bg-rose-500/10",
    RESTOCKED: "text-emerald-400 bg-emerald-500/10",
    TRANSFER_OUT: "text-blue-400 bg-blue-500/10",
    TRANSFER_IN: "text-indigo-400 bg-indigo-500/10",
    AUDIT_ADJUSTMENT: "text-amber-400 bg-amber-500/10",
    RETURNED: "text-sky-400 bg-sky-500/10",
    WRITTEN_OFF: "text-red-400 bg-red-500/10",
    INITIAL: "text-zinc-400 bg-zinc-500/10",
  };

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Immutable Transaction Ledger</h3>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border-base)] rounded-md text-[var(--text-primary)]"
          >
            <option value="">All Types</option>
            <option value="CONSUMED">Consumed</option>
            <option value="RESTOCKED">Restocked</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="AUDIT_ADJUSTMENT">Audit</option>
          </select>
        </div>
      </div>

      <div className="border border-[var(--border-base)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="stealth-table-header">
              <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Time</th>
              <th className="text-left px-3 py-3 font-medium text-[var(--text-muted)]">Item</th>
              <th className="text-left px-3 py-3 font-medium text-[var(--text-muted)]">Location</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--text-muted)]">Type</th>
              <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">Qty</th>
              <th className="text-right px-3 py-3 font-medium text-[var(--text-muted)]">Cost</th>
              <th className="text-left px-3 py-3 font-medium text-[var(--text-muted)]">Worker / Job</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="stealth-table-row">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[var(--text-muted)]">
                  <History className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No transactions recorded</p>
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="stealth-table-row">
                  <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] font-mono">
                    {new Date(txn.created_at).toLocaleString("en-AU", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-primary)]">{txn.item_name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{txn.location_name || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wide rounded-full ${txnColors[txn.transaction_type] || "text-zinc-400 bg-zinc-500/10"}`}>
                      {txn.transaction_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-sm ${txn.quantity_change < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {txn.quantity_change > 0 ? "+" : ""}{txn.quantity_change}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--text-muted)]">
                    ${(txn.unit_cost_at_time ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
                    {txn.worker_name && <span>{txn.worker_name}</span>}
                    {txn.job_display_id && (
                      <span className="ml-1 text-blue-400 font-mono">{txn.job_display_id}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {transactions.length > 0 && (
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Showing {transactions.length} transactions (immutable)
        </div>
      )}
    </div>
  );
}

/* ── CSV Import Tab ────────────────────────────────────── */

function CSVImportTab({ orgId }: { orgId: string }) {
  const [csvData, setCsvData] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ updated: number; created: number; errors: string[] } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvData(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true);
    setResult(null);

    try {
      const lines = csvData.trim().split("\n");
      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());

      const skuIdx = header.findIndex((h) => h === "sku" || h === "code" || h === "part_number");
      const nameIdx = header.findIndex((h) => h === "name" || h === "description" || h === "item");
      const costIdx = header.findIndex((h) => h === "cost" || h === "price" || h === "unit_cost" || h === "trade_price");
      const barcodeIdx = header.findIndex((h) => h === "barcode" || h === "ean" || h === "upc");
      const categoryIdx = header.findIndex((h) => h === "category" || h === "group");
      const unitIdx = header.findIndex((h) => h === "unit" || h === "uom");

      if (skuIdx === -1 || nameIdx === -1 || costIdx === -1) {
        setResult({ updated: 0, created: 0, errors: ["CSV must have columns: sku, name, cost (or equivalent)"] });
        setImporting(false);
        return;
      }

      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          sku: cols[skuIdx] || "",
          name: cols[nameIdx] || "",
          cost: parseFloat(cols[costIdx]) || 0,
          barcode: barcodeIdx >= 0 ? cols[barcodeIdx] : undefined,
          category: categoryIdx >= 0 ? cols[categoryIdx] : undefined,
          unit: unitIdx >= 0 ? cols[unitIdx] : undefined,
        };
      }).filter((r) => r.sku && r.name && r.cost > 0);

      const importResult = await importSupplierPriceCSV(orgId, rows);
      setResult(importResult);
    } catch (err: any) {
      setResult({ updated: 0, created: 0, errors: [err.message || "Import failed"] });
    }

    setImporting(false);
  };

  return (
    <div className="px-4 max-w-2xl">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Supplier Price File Import</h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Upload a CSV from your wholesaler to bulk-update costs. Existing items are matched by SKU;
        new items are auto-created. Costs flow through to margin calculations.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-[var(--text-muted)] mb-1 block">CSV File</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border file:border-[var(--border-base)] file:text-xs file:bg-[var(--surface-1)] file:text-[var(--text-primary)] text-[var(--text-muted)]"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Required columns: <span className="font-mono">sku</span>, <span className="font-mono">name</span>, <span className="font-mono">cost</span>.
            Optional: <span className="font-mono">barcode</span>, <span className="font-mono">category</span>, <span className="font-mono">unit</span>.
          </p>
        </div>

        {csvData && (
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Preview (first 5 lines)</label>
            <pre className="p-3 text-xs font-mono bg-[var(--surface-0)] border border-[var(--border-base)] rounded-md overflow-x-auto text-[var(--text-secondary)] max-h-32">
              {csvData.split("\n").slice(0, 6).join("\n")}
            </pre>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={importing || !csvData.trim()}
          className="stealth-btn-primary text-xs flex items-center gap-1.5"
        >
          {importing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {importing ? "Importing..." : "Import Price File"}
        </button>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border ${
              result.errors.length > 0
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="text-sm font-medium text-[var(--text-primary)]">Import Complete</div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-400 font-mono">{result.created} created</span>
              <span className="text-blue-400 font-mono">{result.updated} updated</span>
              {result.errors.length > 0 && (
                <span className="text-amber-400 font-mono">{result.errors.length} warnings</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 text-xs text-amber-400/80 space-y-0.5">
                {result.errors.slice(0, 5).map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
                {result.errors.length > 5 && (
                  <div>...and {result.errors.length - 5} more</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BulkPriceModal({
  orgId, onClose, onComplete,
}: {
  orgId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [category, setCategory] = useState("");
  const [pct, setPct] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!category) return;
    setLoading(true);
    const result = await bulkPriceAdjustment(orgId, category, pct);
    setLoading(false);
    if (!result.error) onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-base)] r-modal p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Bulk Price Adjustment
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Adjust costs for all items in a category. This will cascade through all kits,
          automatically recalculating sell prices to maintain target margins.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. PVC Fittings, copper, cable"
              className="w-full px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] focus-ring"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1 block">Adjustment %</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-24 px-3 py-2 text-sm font-mono bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] focus-ring"
              />
              <span className="text-sm text-[var(--text-muted)]">%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="stealth-btn-ghost text-xs">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !category}
            className="stealth-btn-primary text-xs"
          >
            {loading ? "Applying..." : "Apply Adjustment"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
