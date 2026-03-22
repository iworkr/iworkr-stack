/**
 * @page /dashboard/ops/inventory
 * @status COMPLETE
 * @description Inventory management with stock levels, bulk price adjustment, and alerts
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, Plus, AlertTriangle, TrendingUp, TrendingDown,
  BarChart3, Upload, RefreshCw, Filter, ChevronDown, ArrowUpDown,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getInventoryItems, getInventoryOverview, createInventoryItem,
  bulkPriceAdjustment,
} from "@/app/actions/hephaestus";

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

export default function InventoryPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

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
