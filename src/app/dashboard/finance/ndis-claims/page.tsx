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
  Download,
  Calendar,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  fetchClaimBatchesAction,
  fetchClaimLineItemsAction,
  createClaimBatchAction,
  applyClaimResolutionsAction,
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

interface NdisClaimsQueryData {
  batches: ClaimBatch[];
  lineItems: ClaimLineItem[];
}

const EMPTY_CLAIM_BATCHES: ClaimBatch[] = [];
const EMPTY_CLAIM_LINE_ITEMS: ClaimLineItem[] = [];

/* ── Status Config ────────────────────────────────────── */

const BATCH_STATUS: Record<BatchStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  submitted: { label: "Submitted", bg: "bg-emerald-500/10", text: "text-emerald-400" },
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
    <div className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-5" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
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
  orgId,
  approvedLines,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  approvedLines: ClaimLineItem[];
  onCreated: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
            <Send className="w-4 h-4 text-emerald-400" />
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
                  className="accent-emerald-500"
                />
                <span className="text-xs font-medium text-[var(--text-muted)]">Select All ({approvedLines.length} items)</span>
              </div>
              {approvedLines.map((line) => (
                <div
                  key={line.id}
                  onClick={() => toggleLine(line.id)}
                  className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border-base)] last:border-b-0 hover:bg-white/[0.02] cursor-pointer"
                >
                  <input type="checkbox" checked={selected.has(line.id)} readOnly className="accent-emerald-500" />
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
            <span className="text-sm font-mono font-semibold text-emerald-400">{fmtCurrency(total)}</span>
            <span className="text-xs text-[var(--text-muted)] ml-2">({selected.size} claims)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="stealth-btn-ghost">Cancel</button>
            <button
              disabled={selected.size === 0 || submitting}
              onClick={async () => {
                if (!orgId || selected.size === 0) return;
                setSubmitting(true);
                setError("");
                try {
                  await createClaimBatchAction({
                    organization_id: orgId,
                    line_item_ids: Array.from(selected),
                  });
                  onCreated();
                  onClose();
                } catch (e: any) {
                  setError(e?.message || "Failed to create batch.");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="stealth-btn-brand disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {submitting ? "Creating..." : "Create Batch"}
            </button>
          </div>
          {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Expanded Batch Detail ────────────────────────────── */

function BatchDetail({
  batch,
  lineItems,
  orgId,
  onClose,
  onResolved,
}: {
  batch: ClaimBatch;
  lineItems: ClaimLineItem[];
  orgId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const failedLines = lineItems.filter((l) => l.status === "failed");
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

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
                    className="px-2.5 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select action...</option>
                    <option value="shift_oop">Shift to OOP</option>
                    <option value="adjust_hours">Adjust Hours</option>
                    <option value="write_off">Write Off</option>
                  </select>
                </div>
              ))}
              <div className="pt-3">
                <button
                  disabled={applying || Object.values(resolutions).filter(Boolean).length === 0}
                  onClick={async () => {
                    const filtered = Object.fromEntries(
                      Object.entries(resolutions).filter(([, v]) => v)
                    ) as Record<string, "shift_oop" | "adjust_hours" | "write_off">;
                    if (!Object.keys(filtered).length) return;
                    setApplying(true);
                    setApplyError("");
                    try {
                      await applyClaimResolutionsAction({
                        organization_id: orgId,
                        resolutions: filtered,
                      });
                      onResolved();
                      onClose();
                    } catch (e: any) {
                      setApplyError(e?.message || "Failed to apply resolutions.");
                    } finally {
                      setApplying(false);
                    }
                  }}
                  className="stealth-btn-brand w-full justify-center disabled:opacity-50"
                >
                  {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {applying ? "Applying..." : "Apply Resolutions"}
                </button>
                {applyError && <p className="text-xs text-rose-400 mt-1">{applyError}</p>}
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
    <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border-base)]">
      <div className="w-16 h-3 rounded skeleton-shimmer" />
      <div className="w-20 h-3 rounded skeleton-shimmer" />
      <div className="w-10 h-3 rounded skeleton-shimmer" />
      <div className="w-20 h-3 rounded skeleton-shimmer" />
      <div className="w-16 h-4 rounded skeleton-shimmer" />
      <div className="w-6 h-6 rounded skeleton-shimmer" />
    </div>
  );
}

/* ── PRODA CSV Generator ──────────────────────────────── */

function ProdaCsvGenerator({ orgId, onGenerated }: { orgId: string; onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    batch_number?: string;
    total_claims?: number;
    total_amount?: string;
    validation_errors?: Array<{ shift_id: string; error: string; participant: string }>;
  } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/ndis/generate-proda-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });

      if (res.ok) {
        // Download the CSV
        const blob = await res.blob();
        const batchNumber = res.headers.get("X-Batch-Number") || "PRODA";
        const totalClaims = res.headers.get("X-Total-Claims") || "0";
        const totalAmount = res.headers.get("X-Total-Amount") || "0.00";

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `PRODA_${batchNumber}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setResult({
          success: true,
          batch_number: batchNumber,
          total_claims: parseInt(totalClaims),
          total_amount: totalAmount,
        });
        onGenerated();
      } else {
        const err = await res.json();
        setResult({
          error: err.error || "Failed to generate PRODA batch",
          validation_errors: err.validation_errors,
        });
      }
    } catch (err: unknown) {
      setResult({ error: (err as Error)?.message || "Network error" });
    } finally {
      setGenerating(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="stealth-btn-ghost">
        <Download className="w-4 h-4" />
        Generate PRODA CSV
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0A0A0A] border border-[var(--border-base)] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Generate PRODA Bulk Claim CSV</h2>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            This will scan all approved, unbilled NDIS shifts within the selected period,
            translate them into NDIS Support Item Codes, and generate a CSV file ready
            for upload to the PRODA portal.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-1.5">
                Period Start
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-1.5">
                Period End
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* Result feedback */}
          {result?.success && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">CSV Generated & Downloaded</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Batch {result.batch_number}: {result.total_claims} claims totaling ${result.total_amount}
                </p>
              </div>
            </div>
          )}

          {result?.error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-rose-400">{result.error}</p>
                {result.validation_errors && result.validation_errors.length > 0 && (
                  <ul className="text-xs text-[var(--text-muted)] mt-1 space-y-0.5">
                    {result.validation_errors.slice(0, 5).map((ve, i) => (
                      <li key={i}>• {ve.participant}: {ve.error}</li>
                    ))}
                    {result.validation_errors.length > 5 && (
                      <li>...and {result.validation_errors.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-base)]">
          <button onClick={() => setOpen(false)} className="stealth-btn-ghost">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="stealth-btn-brand disabled:opacity-40"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {generating ? "Generating..." : "Generate & Download CSV"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function NDISClaimsPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();
  const queryClient = useQueryClient();

  const { data: claimsData, isLoading: loading } = useQuery<NdisClaimsQueryData>({
    queryKey: queryKeys.finance.claims(orgId ?? ""),
    queryFn: async () => {
      const [batchesRes, lineItemsRes] = await Promise.all([
        fetchClaimBatchesAction(orgId!),
        fetchClaimLineItemsAction(orgId!),
      ]);
      return {
        batches: (batchesRes as ClaimBatch[]) ?? [],
        lineItems: (lineItemsRes as ClaimLineItem[]) ?? [],
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const batches = claimsData?.batches ?? EMPTY_CLAIM_BATCHES;
  const lineItems = claimsData?.lineItems ?? EMPTY_CLAIM_LINE_ITEMS;

  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchLineItems, setBatchLineItems] = useState<Record<string, ClaimLineItem[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const invalidateClaims = useCallback(() => {
    if (orgId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.claims(orgId) });
    }
  }, [orgId, queryClient]);

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
        style={{ background: "radial-gradient(ellipse at center top, rgba(16,185,129,0.03) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400 mb-1">NDIS CLAIMS</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              PRODA Reconciliation Dashboard
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Submit, track, and reconcile NDIS claim batches via PRODA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ProdaCsvGenerator orgId={orgId || ""} onGenerated={invalidateClaims} />
            <button
              onClick={() => setCreateOpen(true)}
              className="stealth-btn-brand"
            >
              <Plus className="w-4 h-4" />
              Create Batch
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Total Submitted"
            value={fmtCurrency(metrics.submitted)}
            icon={Send}
            color="text-emerald-400"
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
            className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        {/* Batches Table */}
        <div className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
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
                      orgId={orgId || ""}
                      onClose={() => setExpandedBatch(null)}
                      onResolved={invalidateClaims}
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
            orgId={orgId || ""}
            approvedLines={approvedLines}
            onCreated={invalidateClaims}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
