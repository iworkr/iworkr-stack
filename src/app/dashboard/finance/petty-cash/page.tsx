"use client";

import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  X,
  ShieldCheck,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ImageIcon,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getWalletHealthSummaryAction,
  listWalletLedgerEntriesAction,
  createParticipantWalletAction,
  reconcileWalletAction,
} from "@/app/actions/wallets";
import { listCareFacilitiesAction, listFacilityParticipantsAction } from "@/app/actions/care-routines";

/* ── Types ────────────────────────────────────────────── */

type WalletRow = {
  id: string;
  name: string;
  current_balance: number;
  updated_at: string;
  participant_id: string | null;
  facility_id: string | null;
  wallet_type: string;
  card_last_four: string | null;
  is_stale: boolean;
  has_open_discrepancy: boolean;
  participant_profiles?: { preferred_name?: string; full_name?: string } | null;
  care_facilities?: { name?: string } | null;
};

type LedgerEntry = {
  id: string;
  wallet_id: string;
  entry_type: string;
  amount: number;
  running_balance: number;
  category: string | null;
  description: string | null;
  receipt_image_url: string | null;
  created_at: string;
};

type TabFilter = "all" | "unreconciled" | "discrepancies";

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function getEntityName(w: WalletRow): string {
  if (w.care_facilities?.name) return w.care_facilities.name;
  if (w.participant_profiles?.preferred_name) return w.participant_profiles.preferred_name;
  if (w.participant_profiles?.full_name) return w.participant_profiles.full_name;
  return w.name;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function getWalletStatus(w: WalletRow): { label: string; style: string } {
  if (w.has_open_discrepancy) {
    return { label: "Discrepancy", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
  }
  if (w.is_stale) {
    return { label: "Reconciliation Due", style: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  }
  return { label: "Healthy", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function matchesTab(w: WalletRow, tab: TabFilter): boolean {
  if (tab === "all") return true;
  if (tab === "unreconciled") return w.is_stale;
  if (tab === "discrepancies") return w.has_open_discrepancy;
  return true;
}

/* ── Metric Node ──────────────────────────────────────── */

function MetricNode({
  label,
  value,
  danger,
  pulse,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        )}
        <span
          className={`font-mono text-xl leading-none ${danger ? "text-rose-500 font-bold" : "text-white"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL_WIDTHS = [
  { e: "w-36", b: "w-20", r: "w-24" },
  { e: "w-28", b: "w-24", r: "w-20" },
  { e: "w-40", b: "w-16", r: "w-28" },
  { e: "w-32", b: "w-20", r: "w-24" },
  { e: "w-28", b: "w-24", r: "w-20" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL_WIDTHS[idx % SKEL_WIDTHS.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" />
          <div className="space-y-1.5">
            <div className={`h-3 ${s.e} bg-zinc-900 rounded-sm animate-pulse`} />
            <div className="h-2 w-16 bg-zinc-900/60 rounded-sm animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${s.b} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.r} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-24 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ tab, onAdd }: { tab: TabFilter; onAdd: () => void }) {
  const isDiscrepancies = tab === "discrepancies";
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          {isDiscrepancies ? (
            <>
              <ShieldCheck className="w-8 h-8 text-emerald-500/50 mb-4" />
              <p className="text-[15px] text-white font-medium">No open discrepancies.</p>
              <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
                All petty cash wallets are currently balanced and accounted for.
              </p>
            </>
          ) : (
            <>
              <Wallet className="w-8 h-8 text-zinc-800 mb-4" />
              <p className="text-[15px] text-white font-medium">No wallets found.</p>
              <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
                Create a petty cash wallet to begin tracking participant or facility funds.
              </p>
              <button
                onClick={onAdd}
                className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
              >
                + New Wallet
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Create Wallet SlideOver ──────────────────────────── */

function CreateWalletSlideOver({
  open,
  onClose,
  orgId,
  facilities,
  participants,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  facilities: { id: string; name: string }[];
  participants: { id: string; preferred_name?: string; full_name?: string }[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    entity_type: "participant" as "participant" | "facility",
    entity_id: "",
    name: "",
    wallet_type: "cash" as "cash" | "debit_card",
    card_last_four: "",
    initial_balance: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!form.entity_id || !form.name) {
      setError("Name and entity are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createParticipantWalletAction({
        organization_id: orgId,
        participant_id: form.entity_type === "participant" ? form.entity_id : null,
        facility_id: form.entity_type === "facility" ? form.entity_id : null,
        name: form.name,
        wallet_type: form.wallet_type,
        card_last_four: form.wallet_type === "debit_card" ? form.card_last_four || null : null,
        requires_financial_delegation: false,
        initial_balance: Number(form.initial_balance) || 0,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-white">New Wallet</h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Entity Type */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Entity Type</label>
                <div className="flex gap-2">
                  {(["participant", "facility"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((s) => ({ ...s, entity_type: t, entity_id: "" }))}
                      className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors border ${
                        form.entity_type === t
                          ? "bg-white/10 text-white border-white/10"
                          : "bg-transparent text-zinc-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {t === "participant" ? "Participant" : "Facility"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity Selection */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">
                  {form.entity_type === "participant" ? "Participant" : "Facility"}
                </label>
                <select
                  value={form.entity_id}
                  onChange={(e) => setForm((s) => ({ ...s, entity_id: e.target.value }))}
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700"
                >
                  <option value="">Select…</option>
                  {form.entity_type === "participant"
                    ? participants.map((p) => (
                        <option key={p.id} value={p.id}>{p.preferred_name || p.full_name || p.id.slice(0, 8)}</option>
                      ))
                    : facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                </select>
              </div>

              {/* Wallet Name */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Wallet Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Tommy's Petty Cash"
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                />
              </div>

              {/* Wallet Type */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Wallet Type</label>
                <div className="flex gap-2">
                  {(["cash", "debit_card"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((s) => ({ ...s, wallet_type: t }))}
                      className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors border ${
                        form.wallet_type === t
                          ? "bg-white/10 text-white border-white/10"
                          : "bg-transparent text-zinc-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {t === "cash" ? "Cash" : "Debit Card"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Last Four */}
              {form.wallet_type === "debit_card" && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Card Last 4 Digits</label>
                  <input
                    value={form.card_last_four}
                    onChange={(e) => setForm((s) => ({ ...s, card_last_four: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white font-mono placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                  />
                </div>
              )}

              {/* Initial Balance */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Initial Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.initial_balance}
                  onChange={(e) => setForm((s) => ({ ...s, initial_balance: e.target.value }))}
                  placeholder="0.00"
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white font-mono placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                />
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>

            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Wallet"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Wallet Ledger SlideOver ──────────────────────────── */

function WalletLedgerSlideOver({
  wallet,
  orgId,
  onClose,
  onReconciled,
}: {
  wallet: WalletRow | null;
  orgId: string;
  onClose: () => void;
  onReconciled: () => void;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [physicalCount, setPhysicalCount] = useState("");
  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileSaving, setReconcileSaving] = useState(false);
  const [reconcileError, setReconcileError] = useState("");

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    listWalletLedgerEntriesAction(wallet.id)
      .then((data) => setEntries(data as LedgerEntry[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wallet?.id]);

  if (!wallet) return null;

  const entityName = getEntityName(wallet);
  const balance = Number(wallet.current_balance || 0);

  return (
    <AnimatePresence>
      {wallet && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[500px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <span className="text-xs text-zinc-400 font-medium">{getInitials(entityName)}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-white truncate">{entityName}</h2>
                  <p className="font-mono text-lg text-white leading-none">{formatCurrency(balance)}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transaction Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 border-b border-white/5">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-32 bg-zinc-900 rounded-sm animate-pulse" />
                        <div className="h-2 w-20 bg-zinc-900/60 rounded-sm animate-pulse" />
                      </div>
                      <div className="h-3 w-16 bg-zinc-900 rounded-sm animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && entries.length === 0 && (
                <div className="text-center py-12">
                  <Wallet className="w-6 h-6 text-zinc-800 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No transactions recorded yet.</p>
                </div>
              )}

              {!loading && entries.map((entry) => {
                const isCredit = entry.entry_type === "injection";
                const amt = Number(entry.amount || 0);
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isCredit ? "bg-emerald-500/10" : "bg-zinc-800"
                    }`}>
                      {isCredit ? (
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">
                        {entry.description || entry.category || entry.entry_type}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-zinc-500">
                          {new Date(entry.created_at).toLocaleString("en-AU", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {entry.receipt_image_url && (
                          <ImageIcon className="w-3 h-3 text-zinc-600" />
                        )}
                      </div>
                    </div>
                    <span className={`font-mono text-sm shrink-0 ${isCredit ? "text-emerald-400" : "text-white"}`}>
                      {isCredit ? "+" : "−"}{formatCurrency(Math.abs(amt))}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer: Reconcile Action */}
            <div className="p-6 border-t border-white/5 bg-[#050505] shrink-0 space-y-3">
              {reconciling ? (
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block">
                    Enter Physical Cash Count ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-sm text-white font-mono placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                    autoFocus
                  />
                  {Number(physicalCount) !== Number(wallet.current_balance || 0) && physicalCount !== "" && (
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1">
                        Reason for discrepancy *
                      </label>
                      <input
                        value={reconcileReason}
                        onChange={(e) => setReconcileReason(e.target.value)}
                        placeholder="Explain the variance..."
                        className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                      />
                    </div>
                  )}
                  {reconcileError && <p className="text-xs text-rose-400">{reconcileError}</p>}
                  <div className="flex gap-2">
                    <button
                      disabled={reconcileSaving || !physicalCount || (Number(physicalCount) !== Number(wallet.current_balance || 0) && !reconcileReason)}
                      onClick={async () => {
                        if (!wallet || !physicalCount) return;
                        setReconcileSaving(true);
                        setReconcileError("");
                        try {
                          await reconcileWalletAction({
                            wallet_id: wallet.id,
                            organization_id: orgId,
                            physical_count: Number(physicalCount),
                            reason: reconcileReason || undefined,
                          });
                          setReconciling(false);
                          setPhysicalCount("");
                          setReconcileReason("");
                          onReconciled();
                        } catch (e: any) {
                          setReconcileError(e?.message || "Reconciliation failed.");
                        } finally {
                          setReconcileSaving(false);
                        }
                      }}
                      className="flex-1 h-9 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {reconcileSaving ? "Saving..." : "Confirm Reconciliation"}
                    </button>
                    <button
                      onClick={() => { setReconciling(false); setPhysicalCount(""); setReconcileReason(""); setReconcileError(""); }}
                      className="h-9 px-4 rounded-md border border-white/5 text-xs text-zinc-400 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReconciling(true)}
                  className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98]"
                >
                  Reconcile Wallet
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function PettyCashPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [totals, setTotals] = useState({ active_wallets: 0, total_funds_held: 0, stale_wallets: 0, discrepant_wallets: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [selectedWallet, setSelectedWallet] = useState<WalletRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [participants, setParticipants] = useState<{ id: string; preferred_name?: string; full_name?: string }[]>([]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [health, facs, parts] = await Promise.all([
        getWalletHealthSummaryAction(orgId),
        listCareFacilitiesAction(orgId),
        listFacilityParticipantsAction(orgId),
      ]);
      setWallets((health.wallets || []) as WalletRow[]);
      setTotals(health.totals);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFacilities((facs || []).map((x: any) => ({ id: x.id, name: x.name || "Unnamed" })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setParticipants((parts || []).map((x: any) => ({ id: x.id, preferred_name: x.preferred_name, full_name: x.full_name })));
    } catch {
      // silent
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Filtered List ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = wallets.filter((w) => matchesTab(w, tab));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          getEntityName(w).toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [wallets, tab, search]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All Wallets" },
    { key: "unreconciled", label: "Unreconciled" },
    { key: "discrepancies", label: "Discrepancies" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs + Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Financials & PRODA
          </span>
          <span className="mx-2 text-zinc-700">→</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 font-semibold select-none">
            Petty Cash
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participant or facility…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New Wallet
          </button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center h-16 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0 overflow-x-auto gap-0">
        <MetricNode label="Total Active Wallets" value={totals.active_wallets} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Total Funds Held" value={formatCurrency(totals.total_funds_held)} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Unreconciled (48h)" value={totals.stale_wallets} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode
          label="Open Discrepancies"
          value={totals.discrepant_wallets}
          danger={totals.discrepant_wallets > 0}
          pulse={totals.discrepant_wallets > 0}
        />
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Entity</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Current Balance</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Last Reconciled</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Status</th>
              <th className="px-4 w-[10%]" />
            </tr>
          </thead>
          <tbody>
            {/* Loading Skeletons */}
            {loading && wallets.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            }

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <EmptyState tab={tab} onAdd={() => setCreateOpen(true)} />
            )}

            {/* Data Rows */}
            {!loading && filtered.map((w) => {
              const entityName = getEntityName(w);
              const balance = Number(w.current_balance || 0);
              const status = getWalletStatus(w);
              const shortId = w.id.slice(0, 6).toUpperCase();

              return (
                <tr
                  key={w.id}
                  onClick={() => setSelectedWallet(w)}
                  className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                >
                  {/* Entity */}
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {getInitials(entityName)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate block">{entityName}</span>
                        <span className="text-[10px] font-mono text-zinc-500 truncate block">
                          Wallet ID: WL-{shortId}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Current Balance */}
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm ${balance < 20 ? "text-amber-500" : "text-white"}`}>
                      {formatCurrency(balance)}
                    </span>
                  </td>

                  {/* Last Reconciled */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300 block">
                      {timeAgo(w.updated_at)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${status.style}`}>
                      {status.label}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Wallet Ledger Slide-Over ─────────────────────── */}
      <WalletLedgerSlideOver
        wallet={selectedWallet}
        orgId={orgId || ""}
        onClose={() => setSelectedWallet(null)}
        onReconciled={load}
      />

      {/* ─── Create Wallet Slide-Over ─────────────────────── */}
      <CreateWalletSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId || ""}
        facilities={facilities}
        participants={participants}
        onCreated={load}
      />
    </div>
  );
}
