"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes, Search, Plus, AlertTriangle, RefreshCw,
  ChevronRight, Wrench, Clock, DollarSign,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { getTradeKits, recalculateKitPricesToTarget } from "@/app/actions/hephaestus";

/* ── Types ────────────────────────────────────────── */

interface Kit {
  id: string;
  name: string;
  description: string | null;
  trade_category: string | null;
  target_margin_pct: number;
  calculated_cost: number;
  calculated_sell: number;
  current_margin_pct: number;
  margin_warning: boolean;
  fixed_sell_price: number | null;
  estimated_duration_mins: number | null;
  usage_count: number;
  kit_components: Array<{
    id: string;
    item_type: string;
    label: string;
    quantity: number;
    unit_cost: number;
  }>;
}

/* ── Page ─────────────────────────────────────────── */

export default function KitsPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const [count, setCount] = useState(0);
  const [recalculating, setRecalculating] = useState(false);

  const orgId = org?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const result = await getTradeKits(orgId, {
      search: search || undefined,
      marginWarning: showWarningsOnly || undefined,
    });
    if (result.data) { setKits(result.data); setCount(result.count); }
    setLoading(false);
  }, [orgId, search, showWarningsOnly]);

  useEffect(() => { load(); }, [load]);

  const handleRecalcAll = async () => {
    if (!orgId) return;
    setRecalculating(true);
    await recalculateKitPricesToTarget(orgId);
    setRecalculating(false);
    load();
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

  const warningCount = kits.filter((k) => k.margin_warning).length;

  return (
    <div className="stealth-page-canvas">
      {/* ── Header ─────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <Boxes className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Trade Kits
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Pre-built service packages with dynamic pricing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {warningCount > 0 && (
            <button
              onClick={handleRecalcAll}
              disabled={recalculating}
              className="stealth-btn-ghost text-xs flex items-center gap-1.5 text-amber-400 border-amber-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
              Recalculate {warningCount} Kit{warningCount > 1 ? "s" : ""} to Target
            </button>
          )}
          <button className="stealth-btn-primary text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Create Kit
          </button>
        </div>
      </div>

      {/* ── Search & Filters ───────────────────────── */}
      <div className="flex items-center gap-3 px-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search kits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
          />
        </div>

        <button
          onClick={() => setShowWarningsOnly(!showWarningsOnly)}
          className={`stealth-btn-ghost text-xs flex items-center gap-1.5 ${
            showWarningsOnly ? "text-amber-400 border-amber-500/30 bg-amber-500/5" : ""
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Margin Warnings
        </button>

        <button onClick={load} className="stealth-btn-ghost text-xs p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Kit Grid ───────────────────────────────── */}
      <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-[var(--surface-1)] border border-[var(--border-base)] r-card animate-[skeleton-shimmer_1.5s_infinite]" />
          ))
        ) : kits.length === 0 ? (
          <div className="col-span-full text-center py-16 text-[var(--text-muted)]">
            <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No kits found</p>
            <p className="text-xs mt-1">Create kits or seed from the trade catalog</p>
          </div>
        ) : (
          kits.map((kit) => (
            <KitCard key={kit.id} kit={kit} formatMoney={formatMoney} />
          ))
        )}
      </div>

      {count > 0 && (
        <div className="px-4 mt-3 text-xs text-[var(--text-muted)]">
          Showing {kits.length} of {count} kits
        </div>
      )}
    </div>
  );
}

/* ── Kit Card ─────────────────────────────────────── */

function KitCard({ kit, formatMoney }: { kit: Kit; formatMoney: (v: number) => string }) {
  const sellPrice = kit.fixed_sell_price || kit.calculated_sell;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-[var(--surface-1)] border r-card p-4 cursor-pointer transition-colors hover:border-[var(--border-active)] ${
        kit.margin_warning
          ? "border-amber-500/30 bg-amber-500/[0.02]"
          : "border-[var(--border-base)]"
      }`}
    >
      {/* Margin Warning Badge */}
      {kit.margin_warning && (
        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 r-badge bg-rose-500/10 border border-rose-500/20 text-rose-400 w-fit">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[10px] font-medium uppercase tracking-wide">
            Margin Warning: {kit.current_margin_pct.toFixed(0)}% (Target: {kit.target_margin_pct}%)
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {kit.name}
          </h3>
          {kit.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
              {kit.description}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Components count */}
      <div className="flex items-center gap-3 mt-3 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Wrench className="w-3 h-3" />
          {kit.kit_components?.length || 0} components
        </span>
        {kit.estimated_duration_mins && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {kit.estimated_duration_mins}min
          </span>
        )}
      </div>

      {/* Pricing Row */}
      <div className="flex items-end justify-between mt-4 pt-3 border-t border-[var(--border-base)]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Cost</div>
          <div className="text-sm font-mono text-[var(--text-muted)]">
            {formatMoney(kit.calculated_cost)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Sell</div>
          <div className="text-lg font-mono font-semibold text-[var(--text-primary)]">
            {formatMoney(sellPrice)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Margin</div>
          <div className={`text-sm font-mono font-semibold ${
            kit.margin_warning ? "text-rose-400" : "text-emerald-400"
          }`}>
            {kit.current_margin_pct.toFixed(0)}%
          </div>
        </div>
      </div>
    </motion.div>
  );
}
