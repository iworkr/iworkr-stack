"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Upload,
  RefreshCw,
  DollarSign,
  ArrowUpDown,
  Database,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Trash2,
  History,
  X,
  Loader2,
  Filter,
  Hash,
  MapPin,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchNDISCatalogue,
  fetchNDISSyncStatus,
  syncNDISCatalogueFromCSV,
  fetchNDISSyncHistory,
  type NDISCatalogueItem,
  type NDISSyncStatus,
  type NDISSyncLogEntry,
} from "@/app/actions/ndis-pricing";

/* ── Types ────────────────────────────────────────────── */

type CategoryFilter = "all" | "core" | "capacity_building" | "capital";

/* ── Config ───────────────────────────────────────────── */

const CATEGORY_CONFIG: Record<string, { label: string; short: string; color: string; bg: string }> = {
  core: { label: "Core Supports", short: "Core", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  capacity_building: { label: "Capacity Building", short: "Capacity", color: "#a78bfa", bg: "rgba(139,92,246,0.08)" },
  capital: { label: "Capital Supports", short: "Capital", color: "#fbbf24", bg: "rgba(245,158,11,0.08)" },
};

const FILTER_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "core", label: "Core" },
  { key: "capacity_building", label: "Capacity Building" },
  { key: "capital", label: "Capital" },
];

/* ── Formatters ───────────────────────────────────────── */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { month: "short", year: "numeric" });

/* ── Category Badge ───────────────────────────────────── */

function CategoryBadge({ category }: { category: string }) {
  const c = CATEGORY_CONFIG[category] ?? { short: category, color: "#a1a1aa", bg: "rgba(161,161,170,0.08)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: c.bg, color: c.color }}
    >
      {c.short}
    </span>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[140px_1fr_70px_100px_100px_100px_90px] gap-3 px-4 py-3 border-b border-white/[0.04] animate-pulse">
      <div className="w-24 h-3 rounded bg-white/5" />
      <div className="w-48 h-3 rounded bg-white/5" />
      <div className="w-12 h-3 rounded bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-14 h-3 rounded bg-white/5" />
    </div>
  );
}

/* ── Metric Card ──────────────────────────────────────── */

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof DollarSign; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-zinc-200 tracking-tight">{value}</p>
    </div>
  );
}

/* ── Sync History Modal ───────────────────────────────── */

function SyncHistoryModal({ open, onClose, history }: { open: boolean; onClose: () => void; history: NDISSyncLogEntry[] }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[560px] rounded-xl border border-white/[0.08] bg-[var(--surface-1)] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <History size={16} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-200">Sync History</h2>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300"><X size={16} /></button>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04]">
            {history.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-zinc-600">No sync history yet</div>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    entry.status === "success" ? "bg-emerald-500/10" : entry.status === "partial" ? "bg-amber-500/10" : "bg-red-500/10"
                  }`}>
                    {entry.status === "success" ? <CheckCircle2 size={14} className="text-emerald-400" /> :
                     entry.status === "partial" ? <AlertCircle size={14} className="text-amber-400" /> :
                     <AlertCircle size={14} className="text-red-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-zinc-300">{entry.filename || "Manual sync"}</span>
                      <span className={`rounded px-1.5 py-[1px] text-[9px] font-semibold ${
                        entry.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                        entry.status === "partial" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{entry.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-600">
                      <span>Effective: {fmtDate(entry.effective_from)}</span>
                      <span>{entry.items_inserted} items</span>
                      <span>{fmtDate(entry.created_at)}</span>
                    </div>
                    {entry.error_message && (
                      <p className="mt-1 text-[10px] text-red-400/80">{entry.error_message}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Upload Modal ─────────────────────────────────────── */

function UploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (csv: string, effectiveFrom: string, filename: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-07-01`;
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const text = await file.text();
      await onUpload(text, effectiveFrom, file.name);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => !uploading && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] rounded-xl border border-white/[0.08] bg-[var(--surface-1)] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-[var(--brand)]" />
              <h2 className="text-[14px] font-semibold text-zinc-200">Upload NDIS Price Guide</h2>
            </div>
            <button onClick={() => !uploading && onClose()} className="text-zinc-600 hover:text-zinc-300"><X size={16} /></button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {/* Info */}
            <div className="rounded-lg border border-blue-500/10 bg-blue-500/[0.03] p-3">
              <p className="text-[11px] text-blue-400 leading-relaxed">
                Download the official NDIS Support Catalogue from{" "}
                <a href="https://www.ndis.gov.au/providers/pricing-arrangements" target="_blank" rel="noopener" className="underline hover:text-blue-300">
                  ndis.gov.au
                </a>
                . Save the XLSX as CSV before uploading. The system will auto-detect column mappings.
              </p>
            </div>

            {/* File Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed py-8 transition-colors ${
                file ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.03]" : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.CSV"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
              {file ? (
                <>
                  <FileSpreadsheet size={24} className="mb-2 text-[var(--brand)]" />
                  <p className="text-[13px] font-medium text-zinc-200">{file.name}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-[11px] text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload size={20} className="mb-2 text-zinc-600" />
                  <p className="text-[12px] text-zinc-400">Click to select CSV file</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">NDIS Support Catalogue .csv</p>
                </>
              )}
            </div>

            {/* Effective From Date */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Effective From Date</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
              />
              <p className="mt-1 text-[10px] text-zinc-600">Usually July 1 of the financial year the guide applies to.</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2">
                <p className="text-[11px] text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
            <button
              onClick={() => !uploading && onClose()}
              disabled={uploading}
              className="rounded-md px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-[12px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-40"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Syncing..." : "Upload & Sync"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function NDISPricingPage() {
  const { orgId } = useOrg();

  // Data state
  const [items, setItems] = useState<NDISCatalogueItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [syncStatus, setSyncStatus] = useState<NDISSyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<NDISSyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortField, setSortField] = useState<"support_item_number" | "base_rate_national">("support_item_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load sync status
  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await fetchNDISSyncStatus();
      setSyncStatus(status);
    } catch { /* ignore */ }
  }, []);

  // Load items
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, total } = await fetchNDISCatalogue(
        debouncedSearch || undefined,
        category === "all" ? undefined : category,
        200,
        0,
      );
      setItems(data);
      setTotalItems(total);
    } catch (err) {
      console.error("Failed to load NDIS catalogue:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  // Load sync history
  const loadHistory = useCallback(async () => {
    try {
      const history = await fetchNDISSyncHistory();
      setSyncHistory(history);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSyncStatus(); loadHistory(); }, [loadSyncStatus, loadHistory]);
  useEffect(() => { loadItems(); }, [loadItems]);

  // Sort
  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const aVal = sortField === "base_rate_national" ? a.base_rate_national : a.support_item_number;
      const bVal = sortField === "base_rate_national" ? b.base_rate_national : b.support_item_number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  // Upload handler
  async function handleUpload(csvContent: string, effectiveFrom: string, filename: string) {
    setSyncing(true);
    try {
      const result = await syncNDISCatalogueFromCSV(csvContent, effectiveFrom, filename);
      if (!result.success && result.error) throw new Error(result.error);
      // Refresh
      await Promise.all([loadItems(), loadSyncStatus(), loadHistory()]);
    } finally {
      setSyncing(false);
    }
  }

  // Effective from display
  const effectiveLabel = syncStatus?.latest_effective_from
    ? `NDIS ${fmtDateShort(syncStatus.latest_effective_from)}`
    : "No data synced";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[var(--background)]">
      {/* Subtle gradient */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-48 z-0 opacity-40"
        style={{ background: "radial-gradient(ellipse at center top, rgba(59,130,246,0.06) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 text-zinc-500">
              NDIS PRICING ENGINE
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Support Catalogue & Rates
            </h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              NDIS Support Catalogue with real-time rate lookup and regional modifiers.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Sync Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              {syncStatus?.synced ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {effectiveLabel} <span className="text-emerald-400">• Synced</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[11px] text-amber-400">Not synced</span>
                </>
              )}
            </div>

            {/* Sync History */}
            <button
              onClick={() => setHistoryModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              title="Sync History"
            >
              <History size={14} />
            </button>

            {/* Upload Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3.5 py-2 text-[12px] font-semibold text-black transition-all hover:brightness-110"
            >
              <Upload size={14} />
              Upload CSV
            </motion.button>
          </div>
        </div>

        {/* ── Metrics ── */}
        {syncStatus?.synced && (
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              label="Total Active Items"
              value={syncStatus.active_items.toLocaleString()}
              icon={Database}
              color="#3b82f6"
            />
            <MetricCard
              label="Core Supports"
              value={syncStatus.category_counts.core.toLocaleString()}
              icon={Hash}
              color="#3b82f6"
            />
            <MetricCard
              label="Capacity Building"
              value={syncStatus.category_counts.capacity_building.toLocaleString()}
              icon={Hash}
              color="#a78bfa"
            />
            <MetricCard
              label="Capital Supports"
              value={syncStatus.category_counts.capital.toLocaleString()}
              icon={Hash}
              color="#fbbf24"
            />
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item numbers or names..."
              className="w-full pl-9 pr-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-[13px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-[var(--brand)]/30 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCategory(tab.key)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
                  category === tab.key
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[140px_1fr_70px_100px_100px_100px_90px] gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <button onClick={() => handleSort("support_item_number")}
              className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Item # <ArrowUpDown className="w-2.5 h-2.5" />
            </button>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">Item Name</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">Unit</span>
            <button onClick={() => handleSort("base_rate_national")}
              className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              National <ArrowUpDown className="w-2.5 h-2.5" />
            </button>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">Remote</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">V. Remote</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">Effective</span>
          </div>

          {/* Loading */}
          {loading && items.length === 0 && (
            <div>{Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center py-20">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Database size={20} className="text-zinc-600" />
              </div>
              <h3 className="text-[14px] font-medium text-zinc-300">
                {debouncedSearch ? "No items match your search" : "No NDIS Catalogue Data"}
              </h3>
              <p className="mt-1 max-w-sm text-center text-[12px] text-zinc-600">
                {debouncedSearch
                  ? "Try adjusting your search term or category filter."
                  : "Upload the official NDIS Support Catalogue CSV to populate the pricing engine."}
              </p>
              {!debouncedSearch && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setUploadModalOpen(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-[12px] font-semibold text-black"
                >
                  <Upload size={14} />
                  Upload Price Guide
                </motion.button>
              )}
            </div>
          )}

          {/* Table Rows */}
          {sorted.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(idx * 0.008, 0.3) }}
              className="grid grid-cols-[140px_1fr_70px_100px_100px_100px_90px] gap-3 px-4 py-2.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors group"
            >
              <span className="text-[12px] font-mono tracking-tight text-[var(--brand)]">{item.support_item_number}</span>
              <div className="min-w-0 flex items-center gap-2">
                <p className="text-[12px] text-zinc-300 truncate">{item.support_item_name}</p>
                <CategoryBadge category={item.support_category} />
              </div>
              <span className="text-[11px] text-zinc-500 capitalize">{item.unit}</span>
              <span className="text-[12px] font-mono text-zinc-200 tracking-tight">{fmtCurrency(item.base_rate_national)}</span>
              <span className="text-[12px] font-mono text-zinc-500 tracking-tight">
                {item.base_rate_remote ? fmtCurrency(item.base_rate_remote) : "—"}
              </span>
              <span className="text-[12px] font-mono text-zinc-500 tracking-tight">
                {item.base_rate_very_remote ? fmtCurrency(item.base_rate_very_remote) : "—"}
              </span>
              <span className="text-[10px] text-zinc-600">{fmtDateShort(item.effective_from)}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Footer / Pagination ── */}
        {!loading && totalItems > 0 && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>
              Showing {sorted.length} of {totalItems.toLocaleString()} items
              {category !== "all" && ` in ${CATEGORY_CONFIG[category]?.label || category}`}
            </span>
            <span className="font-mono text-zinc-600">
              {syncStatus?.latest_effective_from
                ? `NDIS Support Catalogue • Effective ${fmtDateShort(syncStatus.latest_effective_from)}`
                : "NDIS Support Catalogue"}
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
      />
      <SyncHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        history={syncHistory}
      />
    </motion.div>
  );
}
