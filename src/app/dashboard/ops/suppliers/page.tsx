"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getWorkspaceSuppliers,
  createWorkspaceSupplier,
  updateWorkspaceSupplier,
  deleteWorkspaceSupplier,
  triggerCatalogSync,
  getCatalogStats,
} from "@/app/actions/forge-link";
import {
  Building2, Plus, RefreshCw, Loader2, Settings, Trash2, CheckCircle,
  AlertTriangle, Clock, Link2, Package, Search, ShoppingCart, Zap,
} from "lucide-react";

/* ── Constants ──────────────────────────────────────── */

const SUPPLIER_ENUMS = [
  "REECE", "REXEL", "TRADELINK", "MMEM", "CNW", "MIDDYS", "L_AND_H", "CUSTOM_API",
] as const;

const SUPPLIER_LABELS: Record<string, string> = {
  REECE: "Reece Group",
  REXEL: "Rexel",
  TRADELINK: "Tradelink",
  MMEM: "MM Electrical",
  CNW: "CNW Electrical",
  MIDDYS: "Middy's",
  L_AND_H: "L&H Group",
  CUSTOM_API: "Custom API",
};

/* ── Types ──────────────────────────────────────────── */

interface WorkspaceSupplier {
  id: string;
  organization_id: string;
  supplier: string;
  display_name: string;
  account_number: string | null;
  api_key_encrypted: string | null;
  api_endpoint: string | null;
  preferred_branch_id: string | null;
  preferred_branch: string | null;
  pricing_tier: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  sync_status: string;
  last_sync_at: string | null;
  items_synced: number | null;
  created_at: string;
  updated_at: string;
}

interface CatalogStats {
  total_items: number;
  by_supplier: Record<string, number>;
}

/* ── GhostBadge ─────────────────────────────────────── */

function GhostBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    SYNCING: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
    AUTH_FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    SETUP: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    PAUSED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${map[status] || map.SETUP}`}
    >
      {status}
    </span>
  );
}

/* ── TelemetryPill ──────────────────────────────────── */

function TelemetryPill({
  label, value, icon, pulse, variant = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  pulse?: boolean;
  variant?: "default" | "emerald" | "amber" | "rose" | "blue";
}) {
  const colors: Record<string, string> = {
    default: "text-[var(--text-muted)]",
    emerald: "text-emerald-400",
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
        <div
          className={`text-sm font-mono font-semibold ${
            variant === "default" ? "text-[var(--text-primary)]" : colors[variant]
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────── */

export default function SuppliersPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const orgId = org?.id;

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: suppliersData, isLoading: loading } = useQuery<{
    suppliers: WorkspaceSupplier[];
    catalogStats: CatalogStats | null;
  }>({
    queryKey: queryKeys.ops.suppliers(orgId!),
    queryFn: async () => {
      const [suppliersRes, statsRes] = await Promise.all([
        getWorkspaceSuppliers(orgId!),
        getCatalogStats(orgId!),
      ]);
      return {
        suppliers: suppliersRes.data ?? [],
        catalogStats: statsRes.data ?? null,
      };
    },
    enabled: !!orgId,
  });

  const suppliers = suppliersData?.suppliers ?? [];
  const catalogStats = suppliersData?.catalogStats ?? null;

  /* ── Derived stats ────────────────────────────────── */

  const connectedCount = suppliers.filter(
    (s) => s.sync_status === "ACTIVE" || s.sync_status === "SYNCING"
  ).length;

  const activeSyncs = suppliers.filter((s) => s.sync_status === "SYNCING").length;

  const lastSyncTime = suppliers
    .map((s) => s.last_sync_at)
    .filter(Boolean)
    .sort()
    .pop();

  /* ── Actions ──────────────────────────────────────── */

  const handleSync = async (supplierId: string) => {
    if (!orgId) return;
    setSyncingIds((prev) => new Set(prev).add(supplierId));

    await triggerCatalogSync(orgId, supplierId);

    setTimeout(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ops.suppliers(orgId) });
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(supplierId);
        return next;
      });
    }, 1500);
  };

  const handleDelete = async (supplierId: string) => {
    if (!orgId) return;
    if (!confirm("Remove this supplier connection? This won't delete catalog items already synced.")) return;

    setDeletingId(supplierId);
    const result = await deleteWorkspaceSupplier(supplierId, orgId);
    setDeletingId(null);

    if (!result.error) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.suppliers(orgId!) });
    }
  };

  /* ── Filtering ────────────────────────────────────── */

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.display_name.toLowerCase().includes(q) ||
      s.supplier.toLowerCase().includes(q) ||
      (s.account_number && s.account_number.toLowerCase().includes(q))
    );
  });

  /* ── Helpers ──────────────────────────────────────── */

  const maskAccount = (acct: string | null) => {
    if (!acct || acct.length < 4) return acct || "—";
    return `****${acct.slice(-4)}`;
  };

  const formatRelativeTime = (iso: string | null) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="stealth-page-canvas">
      {/* ── Header ──────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <Link2 className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Supplier Connections
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Forge-Link — credential vault &amp; catalog sync
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => orgId && triggerCatalogSync(orgId).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.ops.suppliers(orgId) }))}
            className="stealth-btn-ghost text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync All
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="stealth-btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ────────────────────────── */}
      <div className="h-16 flex items-center gap-6 px-4 bg-zinc-950/30 border-b border-[var(--border-base)] mb-4">
        <TelemetryPill
          label="CONNECTED"
          value={loading ? "—" : String(connectedCount)}
          icon={<Building2 className="w-3.5 h-3.5" />}
          variant={connectedCount > 0 ? "emerald" : "default"}
        />
        <div className="w-px h-8 bg-[var(--border-base)]" />
        <TelemetryPill
          label="CATALOG ITEMS"
          value={loading ? "—" : catalogStats ? catalogStats.total_items.toLocaleString() : "0"}
          icon={<Package className="w-3.5 h-3.5" />}
        />
        <div className="w-px h-8 bg-[var(--border-base)]" />
        <TelemetryPill
          label="LAST SYNC"
          value={loading ? "—" : formatRelativeTime(lastSyncTime || null)}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <div className="w-px h-8 bg-[var(--border-base)]" />
        <TelemetryPill
          label="ACTIVE SYNCS"
          value={loading ? "—" : String(activeSyncs)}
          icon={<Zap className="w-3.5 h-3.5" />}
          pulse={activeSyncs > 0}
          variant={activeSyncs > 0 ? "amber" : "default"}
        />
      </div>

      {/* ── Search Bar ──────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
          />
        </div>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.ops.suppliers(orgId!) })} className="stealth-btn-ghost text-xs p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Supplier Cards Grid ─────────────────────── */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-5 space-y-3"
              >
                <div className="h-5 w-2/3 bg-[var(--surface-2)] rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-[var(--surface-2)] rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-[var(--surface-2)] rounded animate-pulse" />
                <div className="h-8 w-full bg-[var(--surface-2)] rounded animate-pulse mt-4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {suppliers.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mb-4">
                  <Link2 className="w-7 h-7 text-[var(--text-muted)] opacity-40" />
                </div>
                <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
                  No supplier connections yet
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-xs mb-6">
                  Connect your trade supplier accounts to unlock catalog sync,
                  live pricing, and one-click purchase orders.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="stealth-btn-primary text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Connect First Supplier
                </button>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-[var(--text-muted)] opacity-30 mb-2" />
                <p className="text-sm text-[var(--text-muted)]">
                  No suppliers match &quot;{search}&quot;
                </p>
              </>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {filtered.map((supplier, idx) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-5 hover:border-[var(--border-active)] transition-colors group"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {supplier.display_name}
                      </h3>
                      <span className="inline-flex items-center rounded border border-[var(--border-base)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--text-muted)] tracking-wide mt-0.5">
                        {supplier.supplier}
                      </span>
                    </div>
                  </div>
                  <GhostBadge status={supplier.sync_status} />
                </div>

                {/* Card body — details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Account</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {maskAccount(supplier.account_number)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Last Sync</span>
                    <span className="text-[var(--text-primary)]">
                      {formatRelativeTime(supplier.last_sync_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Items Synced</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {supplier.items_synced != null
                        ? supplier.items_synced.toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  {supplier.preferred_branch && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Preferred Branch</span>
                      <span className="text-[var(--text-primary)] truncate max-w-[140px]">
                        {supplier.preferred_branch}
                      </span>
                    </div>
                  )}
                </div>

                {/* Catalog breakdown (if stats exist) */}
                {catalogStats?.by_supplier?.[supplier.supplier] != null && (
                  <div className="flex items-center gap-1.5 mb-4 px-2.5 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/10">
                    <ShoppingCart className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {catalogStats.by_supplier[supplier.supplier].toLocaleString()} catalog items
                    </span>
                  </div>
                )}

                {/* Card actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-base)]">
                  <button
                    onClick={() => handleSync(supplier.id)}
                    disabled={syncingIds.has(supplier.id)}
                    className="stealth-btn-ghost text-[11px] flex items-center gap-1.5 flex-1 justify-center"
                  >
                    {syncingIds.has(supplier.id) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {syncingIds.has(supplier.id) ? "Syncing…" : "Sync Now"}
                  </button>
                  <button
                    className="stealth-btn-ghost text-[11px] p-2"
                    title="Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    disabled={deletingId === supplier.id}
                    className="stealth-btn-ghost text-[11px] p-2 hover:text-rose-400 transition-colors"
                    title="Remove connection"
                  >
                    {deletingId === supplier.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Result count */}
        {!loading && filtered.length > 0 && (
          <div className="mt-4 text-xs text-[var(--text-muted)]">
            {filtered.length === suppliers.length
              ? `${suppliers.length} supplier${suppliers.length !== 1 ? "s" : ""} connected`
              : `${filtered.length} of ${suppliers.length} suppliers shown`}
          </div>
        )}
      </div>

      {/* ── Add Supplier Modal ──────────────────────── */}
      <AnimatePresence>
        {showAddModal && orgId && (
          <AddSupplierModal
            orgId={orgId}
            onClose={() => setShowAddModal(false)}
            onComplete={() => { setShowAddModal(false); queryClient.invalidateQueries({ queryKey: queryKeys.ops.suppliers(orgId!) }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Add Supplier Modal
   ══════════════════════════════════════════════════════ */

function AddSupplierModal({
  orgId, onClose, onComplete,
}: {
  orgId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [supplierEnum, setSupplierEnum] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [preferredBranch, setPreferredBranch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill display name when supplier is selected
  useEffect(() => {
    if (supplierEnum && !displayName) {
      setDisplayName(SUPPLIER_LABELS[supplierEnum] || supplierEnum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierEnum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierEnum || !displayName) return;

    setSaving(true);
    setError(null);

    const result = await createWorkspaceSupplier({
      organization_id: orgId,
      supplier: supplierEnum,
      display_name: displayName,
      account_number: accountNumber || null,
      api_key_encrypted: apiKey || null,
      api_endpoint: null,
      preferred_branch_id: null,
      preferred_branch: preferredBranch || null,
      pricing_tier: null,
      contact_email: null,
      contact_phone: null,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onComplete();
    }
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
        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-base)] r-modal p-6"
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Connect Supplier
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Link a trade supplier account for catalog sync &amp; purchasing
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier select */}
          <div>
            <label className="stealth-overline block mb-1.5">Supplier</label>
            <select
              value={supplierEnum}
              onChange={(e) => setSupplierEnum(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] focus-ring"
              required
            >
              <option value="">Select supplier…</option>
              {SUPPLIER_ENUMS.map((s) => (
                <option key={s} value={s}>
                  {SUPPLIER_LABELS[s] || s}
                </option>
              ))}
            </select>
          </div>

          {/* Display name */}
          <div>
            <label className="stealth-overline block mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Reece — Plumbing Division"
              className="w-full px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
              required
            />
          </div>

          {/* Account + API Key row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="stealth-overline block mb-1.5">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 12345678"
                className="w-full px-3 py-2 text-sm font-mono bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
              />
            </div>
            <div>
              <label className="stealth-overline block mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm font-mono bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
              />
            </div>
          </div>

          {/* Preferred branch */}
          <div>
            <label className="stealth-overline block mb-1.5">Preferred Branch</label>
            <input
              type="text"
              value={preferredBranch}
              onChange={(e) => setPreferredBranch(e.target.value)}
              placeholder="e.g. Alexandria, Parramatta"
              className="w-full px-3 py-2 text-sm bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-base)]">
            <button type="button" onClick={onClose} className="stealth-btn-ghost text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !supplierEnum || !displayName}
              className="stealth-btn-primary text-xs flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connect Supplier
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
