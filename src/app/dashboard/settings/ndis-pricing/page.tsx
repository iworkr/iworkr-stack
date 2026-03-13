"use client";

import { motion } from "framer-motion";
import {
  Search,
  Upload,
  RefreshCw,
  DollarSign,
  Hash,
  ArrowUpDown,
  Database,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { fetchNDISCatalogueAction } from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

interface NDISCatalogueItem {
  id: string;
  support_item_number: string;
  support_item_name: string;
  support_category: "core" | "capacity_building" | "capital";
  unit: string;
  base_rate: number;
  region_rate?: number | null;
  effective_from: string;
  effective_to?: string | null;
  created_at: string;
}

type CategoryFilter = "all" | "core" | "capacity_building" | "capital";

/* ── Category Config ──────────────────────────────────── */

const CATEGORY_LABELS: Record<string, { label: string; short: string }> = {
  core: { label: "Core Supports", short: "Core" },
  capacity_building: { label: "Capacity Building", short: "Capacity" },
  capital: { label: "Capital Supports", short: "Capital" },
};

const FILTER_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "core", label: "Core" },
  { key: "capacity_building", label: "Capacity Building" },
  { key: "capital", label: "Capital" },
];

/* ── Formatters ───────────────────────────────────────── */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

/* ── Category Badge ───────────────────────────────────── */

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    core: { bg: "var(--brand-care-subtle)", text: "var(--brand-care-text)" },
    capacity_building: { bg: "rgba(139,92,246,0.08)", text: "#a78bfa" },
    capital: { bg: "rgba(245,158,11,0.08)", text: "#fbbf24" },
  };
  const c = colors[category] ?? { bg: "rgba(161,161,170,0.08)", text: "#a1a1aa" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {CATEGORY_LABELS[category]?.short ?? category}
    </span>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[130px_1fr_80px_120px_120px_110px] gap-4 px-5 py-3.5 border-b border-[var(--border-base)] animate-pulse">
      <div className="w-24 h-3 rounded bg-white/5" />
      <div className="w-48 h-3 rounded bg-white/5" />
      <div className="w-12 h-3 rounded bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-20 h-3 rounded bg-white/5" />
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function NDISPricingPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();

  const [items, setItems] = useState<NDISCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortField, setSortField] = useState<"support_item_number" | "base_rate">("support_item_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNDISCatalogueAction(
        debouncedSearch || undefined,
        category === "all" ? undefined : category
      );
      setItems((data as NDISCatalogueItem[]) ?? []);
    } catch (err) {
      console.error("Failed to load NDIS catalogue:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const aVal = sortField === "base_rate" ? a.base_rate : a.support_item_number;
      const bVal = sortField === "base_rate" ? b.base_rate : b.support_item_number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, var(--brand-care-subtle) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: "var(--brand-care-text)" }}>NDIS PRICING MATRIX</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Support Catalogue & Rates
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Browse and search the NDIS Support Catalogue price guide.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sync Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-1)] border border-[var(--border-base)] r-card">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "var(--brand-care)" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--brand-care)" }} />
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                NDIS July 2026 <span className="text-emerald-400">• Up to date</span>
              </span>
            </div>
            {/* Upload CSV */}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="stealth-btn-ghost"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item numbers or names..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
          <div className="stealth-tabs border-b-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategory(tab.key)}
                data-active={category === tab.key}
                className="stealth-tab"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[var(--surface-1)] border border-[var(--border-base)] r-card overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
          {/* Table Header */}
          <div className="grid grid-cols-[130px_1fr_80px_120px_120px_110px] gap-4 px-5 py-3 border-b border-[var(--border-base)]">
            <button
              onClick={() => handleSort("support_item_number")}
              className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Item Number
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Item Name</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Unit</span>
            <button
              onClick={() => handleSort("base_rate")}
              className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Base Rate
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Region Rate</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Effective</span>
          </div>

          {/* Loading */}
          {loading && items.length === 0 && (
            <div>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <div className="stealth-empty-state py-16">
              <div className="stealth-empty-state-icon">
                <Database className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <p className="stealth-empty-state-title">
                {debouncedSearch ? "No items match" : "No NDIS catalogue synced"}
              </p>
              <p className="stealth-empty-state-desc">
                {debouncedSearch
                  ? "Try adjusting your search term or filter."
                  : "No NDIS catalogue synced. Upload a price guide CSV to begin."}
              </p>
              {!debouncedSearch && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="stealth-btn-brand mt-2"
                  style={{ background: "var(--brand-care)" }}
                >
                  <Upload className="w-4 h-4" />
                  Upload Price Guide
                </button>
              )}
            </div>
          )}

          {/* Table Rows */}
          {sorted.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.01 }}
              className="grid grid-cols-[130px_1fr_80px_120px_120px_110px] gap-4 px-5 py-3.5 items-center border-b border-[var(--border-base)] last:border-b-0 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-sm font-mono tracking-tight" style={{ color: "var(--brand-care-text)" }}>{item.support_item_number}</span>
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{item.support_item_name}</p>
                <CategoryBadge category={item.support_category} />
              </div>
              <span className="text-xs text-[var(--text-muted)]">{item.unit}</span>
              <span className="text-sm font-mono text-[var(--text-primary)] tracking-tight">{fmtCurrency(item.base_rate)}</span>
              <span className="text-sm font-mono text-[var(--text-muted)] tracking-tight">
                {item.region_rate ? fmtCurrency(item.region_rate) : "—"}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(item.effective_from).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Item Count */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Showing {sorted.length} items</span>
            <span className="font-mono">NDIS Support Catalogue v2026.3</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
