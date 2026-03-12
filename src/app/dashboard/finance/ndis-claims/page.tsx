"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  Send,
  RefreshCw,
  ArrowRightLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  fetchClaimBatchesAction,
  fetchClaimLineItemsAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

type BatchStatus = "draft" | "submitted" | "processing" | "reconciled" | "failed";
type LineItemStatus = "approved" | "failed" | "adjusted" | "written_off";

interface ClaimBatch {
  id: string;
  organization_id: string;
  batch_number?: string | null;
  status: BatchStatus;
  total_amount: number;
  claim_count: number;
  submitted_at?: string | null;
  reconciled_at?: string | null;
  proda_response_code?: string | null;
  error_summary?: Record<string, number> | null;
  created_at: string;
}

interface ClaimLineItem {
  id: string;
  claim_batch_id?: string | null;
  organization_id: string;
  participant_id: string;
  support_item_number: string;
  support_item_name?: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: LineItemStatus;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  participant_profiles?: { id: string; ndis_number?: string } | null;
}

/* ── Status Config ────────────────────────────────────── */

const BATCH_STATUS: Record<BatchStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  submitted: { label: "Submitted", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]" },
  processing: { label: "Processing", bg: "bg-amber-500/10", text: "text-amber-400" },
  reconciled: { label: "Reconciled", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  failed: { label: "Failed", bg: "bg-rose-500/10", text: "text-rose-400" },
};

/* ── Error Code Translations ──────────────────────────── */

const ERROR_TRANSLATIONS: Record<string, string> = {
  E001: "NDIS number not found in PRODA registry",
  E002: "Service date outside plan period",
  E003: "Support item not in participant budget",
  E004: "Rate exceeds NDIS price guide maximum",
  E005: "Duplicate claim — already submitted for this period",
  E006: "Worker not registered as NDIS provider",
  E007: "Exceeds category budget allocation",
  E008: "Invalid support item number",
  E009: "Participant plan has been reassessed — outdated reference",
  E010: "Missing required evidence/progress notes",
};

/* ── Formatters ───────────────────────────────────────── */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/* ── Status Pill ──────────────────────────────────────── */

function BatchStatusPill({ status }: { status: BatchStatus }) {
  const c = BATCH_STATUS[status] ?? BATCH_STATUS.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

/* ── Metric Card ──────────────────────────────────────── */

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-mono font-semibold ${color} tracking-tight`}>{value}</p>
    </div>
  );
}

/* ── Create Batch Modal ───────────────────────────────── */

function CreateBatchModal({
  open,
  onClose,
  approvedLines,
}: {
  open: boolean;
  onClose: () => void;
  approvedLines: ClaimLineItem[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleLine = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === approvedLines.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approvedLines.map((l) => l.id)));
    }
  };

  const total = approvedLines
    .filter((l) => selected.has(l.id))
    .reduce((sum, l) => sum + l.total_amount, 0);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-[#0A0A0A] border border-[var(--border-base)] rounded-xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Create Claim Batch</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {approvedLines.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
              No approved claim lines available for batching.
            </div>
          ) : (
            <div>
              {/* Select All */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border-base)]">
                <input
                  type="checkbox"
                  checked={selected.size === approvedLines.length}
                  onChange={toggleAll}
                  className="accent-[#3B82F6]"
                />
                <span className="text-xs font-medium text-[var(--text-muted)]">Select All ({approvedLines.length} items)</span>
              </div>
              {approvedLines.map((line) => (
                <div
                  key={line.id}
                  onClick={() => toggleLine(line.id)}
                  className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border-base)] last:border-b-0 hover:bg-white/[0.02] cursor-pointer"
                >
                  <input type="checkbox" checked={selected.has(line.id)} readOnly className="accent-[#3B82F6]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {line.support_item_name || line.support_item_number}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{line.support_item_number}</p>
                  </div>
                  <span className="text-sm font-mono text-[var(--text-primary)]">{fmtCurrency(line.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-base)]">
          <div>
            <span className="text-xs text-[var(--text-muted)]">Total: </span>
            <span className="text-sm font-mono font-semibold text-[#3B82F6]">{fmtCurrency(total)}</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">({selected.size} claims)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="stealth-btn-ghost">Cancel</button>
            <button
              disabled={selected.size === 0}
              className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              Create Batch
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Expanded Batch Detail ────────────────────────────── */

function BatchDetail({
  batch,
  lineItems,
  onClose,
}: {
  batch: ClaimBatch;
  lineItems: ClaimLineItem[];
  onClose: () => void;
}) {
  const failedLines = lineItems.filter((l) => l.status === "failed");
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-[var(--surface-1)] border-t border-[var(--border-base)] overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-[var(--border-base)]">
        {/* Left: Failed Claims */}
        <div className="p-5">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-rose-400 mb-3">
            Failed Claim Lines ({failedLines.length})
          </h4>
          {failedLines.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-400 opacity-60" />
              All claims processed successfully
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {failedLines.map((line) => (
                <div key={line.id} className="bg-rose-500/5 border border-rose-500/10 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {line.support_item_name || line.support_item_number}
                      </p>
                      <p className="text-[10px] font-mono text-rose-400 mt-0.5">
                        {line.error_code}: {ERROR_TRANSLATIONS[line.error_code ?? ""] ?? line.error_message ?? "Unknown error"}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-rose-400">{fmtCurrency(line.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Resolution Actions */}
        <div className="p-5">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-[var(--text-muted)] mb-3">
            Resolution Actions
          </h4>
          {failedLines.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              No actions required
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {failedLines.map((line) => (
                <div key={line.id} className="flex items-center gap-3 py-2">
                  <span className="text-xs text-[var(--text-primary)] truncate flex-1 min-w-0">
                    {line.support_item_number}
                  </span>
                  <select
                    value={resolutions[line.id] ?? ""}
                    onChange={(e) => setResolutions((p) => ({ ...p, [line.id]: e.target.value }))}
                    className="px-2.5 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  >
                    <option value="">Select action...</option>
                    <option value="shift_oop">Shift to OOP</option>
                    <option value="adjust_hours">Adjust Hours</option>
                    <option value="write_off">Write Off</option>
                  </select>
                </div>
              ))}
              <div className="pt-3">
                <button className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] w-full justify-center">
                  Apply Resolutions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border-base)] animate-pulse">
      <div className="w-16 h-3 rounded bg-white/5" />
      <div className="w-20 h-3 rounded bg-white/5" />
      <div className="w-10 h-3 rounded bg-white/5" />
      <div className="w-20 h-3 rounded bg-white/5" />
      <div className="w-16 h-4 rounded bg-white/5" />
      <div className="w-6 h-6 rounded bg-white/5" />
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function NDISClaimsPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();

  const [batches, setBatches] = useState<ClaimBatch[]>([]);
  const [lineItems, setLineItems] = useState<ClaimLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchLineItems, setBatchLineItems] = useState<Record<string, ClaimLineItem[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [batchData, lineData] = await Promise.all([
        fetchClaimBatchesAction(orgId),
        fetchClaimLineItemsAction(orgId),
      ]);
      setBatches((batchData as ClaimBatch[]) ?? []);
      setLineItems((lineData as ClaimLineItem[]) ?? []);
    } catch (err) {
      console.error("Failed to load claims data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExpandBatch = useCallback(async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);
    if (!batchLineItems[batchId] && orgId) {
      try {
        const items = await fetchClaimLineItemsAction(orgId, batchId);
        setBatchLineItems((p) => ({ ...p, [batchId]: (items as ClaimLineItem[]) ?? [] }));
      } catch (err) {
        console.error("Failed to load batch items:", err);
      }
    }
  }, [expandedBatch, batchLineItems, orgId]);

  /* ── Computed metrics ─── */
  const metrics = useMemo(() => {
    const submitted = batches
      .filter((b) => ["submitted", "processing", "reconciled"].includes(b.status))
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const awaiting = batches
      .filter((b) => ["submitted", "processing"].includes(b.status))
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    const failed = batches
      .filter((b) => b.status === "failed")
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    return { submitted, awaiting, failed };
  }, [batches]);

  const filteredBatches = useMemo(() => {
    if (!search) return batches;
    const q = search.toLowerCase();
    return batches.filter(
      (b) =>
        (b.batch_number?.toLowerCase().includes(q)) ||
        b.status.includes(q)
    );
  }, [batches, search]);

  const approvedLines = useMemo(
    () => lineItems.filter((l) => l.status === "approved" && !l.claim_batch_id),
    [lineItems]
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(59,130,246,0.03) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#3B82F6] mb-1">NDIS CLAIMS</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              PRODA Reconciliation Dashboard
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Submit, track, and reconcile NDIS claim batches via PRODA.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB]"
          >
            <Plus className="w-4 h-4" />
            Create Batch
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Total Submitted"
            value={fmtCurrency(metrics.submitted)}
            icon={Send}
            color="text-[#3B82F6]"
          />
          <MetricCard
            label="Awaiting Payment"
            value={fmtCurrency(metrics.awaiting)}
            icon={Clock}
            color="text-amber-400"
          />
          <MetricCard
            label="Failed Claims"
            value={fmtCurrency(metrics.failed)}
            icon={AlertTriangle}
            color="text-rose-400"
          />
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batches..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
          />
        </div>

        {/* Batches Table */}
        <div className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[100px_120px_80px_140px_120px_60px] gap-4 px-5 py-3 border-b border-[var(--border-base)]">
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Batch #</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Date</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Claims</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Amount</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Status</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]" />
          </div>

          {loading && batches.length === 0 && (
            <div>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {!loading && filteredBatches.length === 0 && (
            <div className="stealth-empty-state py-16">
              <div className="stealth-empty-state-icon">
                <FileText className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <p className="stealth-empty-state-title">No NDIS claim batches yet</p>
              <p className="stealth-empty-state-desc">
                {search
                  ? "No batches match your search."
                  : "Create your first batch to start submitting claims to PRODA."}
              </p>
            </div>
          )}

          <AnimatePresence>
            {filteredBatches.map((batch) => (
              <div key={batch.id}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleExpandBatch(batch.id)}
                  className="grid grid-cols-[100px_120px_80px_140px_120px_60px] gap-4 px-5 py-4 items-center border-b border-[var(--border-base)] hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <span className="text-sm font-mono text-[var(--text-primary)]">
                    {batch.batch_number ?? batch.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{fmtDate(batch.created_at)}</span>
                  <span className="text-sm font-mono text-[var(--text-primary)] text-center">{batch.claim_count}</span>
                  <span className="text-sm font-mono text-[var(--text-primary)]">{fmtCurrency(batch.total_amount ?? 0)}</span>
                  <BatchStatusPill status={batch.status} />
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expandedBatch === batch.id ? "rotate-180" : ""}`}
                  />
                </motion.div>

                <AnimatePresence>
                  {expandedBatch === batch.id && (
                    <BatchDetail
                      batch={batch}
                      lineItems={batchLineItems[batch.id] ?? []}
                      onClose={() => setExpandedBatch(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateBatchModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            approvedLines={approvedLines}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
