"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Send,
  RefreshCw,
  Upload,
  Download,
  Loader2,
  Zap,
  ArrowRight,
  FileUp,
  CheckCheck,
  XCircle,
  BarChart3,
  CalendarRange,
  Play,
  Eye,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { useOrg } from "@/lib/hooks/use-org";
import {
  aggregateApprovedTimesheets,
  approveClaimLines,
  generateProdaCSV,
  ingestReturnFile,
  markBatchSubmitted,
  fetchSynapseBatches,
  fetchSynapseClaimLines,
  fetchSynapseAggregationRuns,
  fetchSynapseReturnEntries,
  fetchSynapseStats,
  type ProdaBatch,
  type ClaimLineItem,
  type AggregationRun,
  type ReturnEntry,
} from "@/app/actions/synapse";

/* ── Status Configs ──────────────────────────────────────── */

const CLAIM_STATUS: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  draft: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400", icon: FileText },
  approved: { label: "Approved", bg: "bg-blue-500/10", text: "text-blue-400", icon: CheckCircle2 },
  submitted: { label: "Submitted", bg: "bg-amber-500/10", text: "text-amber-400", icon: Send },
  paid: { label: "Paid", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: DollarSign },
  rejected: { label: "Rejected", bg: "bg-rose-500/10", text: "text-rose-400", icon: XCircle },
  written_off: { label: "Written Off", bg: "bg-zinc-500/10", text: "text-zinc-400", icon: XCircle },
};

const BATCH_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  validating: { label: "Validating", bg: "bg-amber-500/10", text: "text-amber-400" },
  submitted: { label: "Submitted", bg: "bg-blue-500/10", text: "text-blue-400" },
  processing: { label: "Processing", bg: "bg-amber-500/10", text: "text-amber-400" },
  partially_reconciled: { label: "Partial", bg: "bg-amber-500/10", text: "text-amber-400" },
  reconciled: { label: "Reconciled", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  failed: { label: "Failed", bg: "bg-rose-500/10", text: "text-rose-400" },
};

const REJECTION_CODES: Record<string, string> = {
  E001: "NDIS number not found in PRODA registry",
  E002: "Service date outside plan period",
  E003: "Support item not in participant budget",
  E004: "Duplicate claim already processed",
  E005: "Provider registration expired",
  E006: "Quantity exceeds plan allocation",
  E007: "Rate exceeds price guide maximum",
  E008: "Participant plan not active",
  E009: "Service agreement not active",
  E010: "Missing mandatory field",
};

/* ── Format helpers ──────────────────────────────────────── */

function fmt(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Main Page Component ─────────────────────────────────── */

export default function ProdaClaimsPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pipeline" | "batches" | "reconciliation" | "history">("pipeline");

  const { data: stats = null, isLoading: loading } = useQuery<Awaited<ReturnType<typeof fetchSynapseStats>>>({
    queryKey: queryKeys.care.prodaClaims(orgId ?? ""),
    queryFn: () => fetchSynapseStats(orgId!),
    enabled: !!orgId,
  });

  const refreshStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.care.prodaClaims(orgId ?? "") });
  }, [orgId, queryClient]);

  const tabs = [
    { id: "pipeline" as const, label: "Claim Pipeline", icon: Zap },
    { id: "batches" as const, label: "PRODA Batches", icon: Send },
    { id: "reconciliation" as const, label: "Reconciliation", icon: ArrowUpDown },
    { id: "history" as const, label: "Aggregation History", icon: BarChart3 },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">PRODA Bulk Claiming Engine</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Project Synapse — Sweep timesheets, generate NDIS claims, reconcile returns</p>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        {stats && !loading && (
          <div className="mt-4 grid grid-cols-5 gap-3">
            {[
              { label: "Draft", count: stats.draft_lines, amount: stats.draft_amount, color: "text-zinc-400", bg: "bg-zinc-500/10" },
              { label: "Approved", count: stats.approved_lines, amount: stats.approved_amount, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Submitted", count: stats.submitted_lines, amount: stats.submitted_amount, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Paid", count: stats.paid_lines, amount: stats.paid_amount, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Rejected", count: stats.rejected_lines, amount: stats.rejected_amount, color: "text-rose-400", bg: "bg-rose-500/10" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${s.color}`}>{s.label}</span>
                  <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-mono font-medium ${s.bg} ${s.color}`}>{s.count}</span>
                </div>
                <p className={`mt-1 text-sm font-semibold ${s.color}`}>{fmt(s.amount)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="mt-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              <t.icon size={13} strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "pipeline" && orgId && <PipelineTab orgId={orgId} onRefreshStats={refreshStats} />}
        {tab === "batches" && orgId && <BatchesTab orgId={orgId} onRefreshStats={refreshStats} />}
        {tab === "reconciliation" && orgId && <ReconciliationTab orgId={orgId} onRefreshStats={refreshStats} />}
        {tab === "history" && orgId && <HistoryTab orgId={orgId} />}
      </div>
    </div>
  );
}

/* ── Pipeline Tab: Aggregate + Approve + Generate CSV ──── */

function PipelineTab({ orgId, onRefreshStats }: { orgId: string; onRefreshStats: () => void }) {
  const queryClient = useQueryClient();
  const [aggregating, setAggregating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aggregationResult, setAggregationResult] = useState<any>(null);

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const pipelineKey = ["care", "prodaPipeline", orgId, statusFilter] as const;

  const { data: lines = [], isLoading: loading } = useQuery<ClaimLineItem[]>({
    queryKey: pipelineKey,
    queryFn: () => fetchSynapseClaimLines(orgId, statusFilter !== "all" ? { status: statusFilter } : undefined),
    enabled: !!orgId,
  });

  const invalidateLines = () => queryClient.invalidateQueries({ queryKey: ["care", "prodaPipeline", orgId] });

  const draftLines = useMemo(() => lines.filter((l) => l.status === "draft"), [lines]);
  const approvedLines = useMemo(() => lines.filter((l) => l.status === "approved"), [lines]);

  const filteredLines = useMemo(() => {
    if (statusFilter === "all") return lines;
    return lines.filter((l) => l.status === statusFilter);
  }, [lines, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDraft = () => setSelected(new Set(draftLines.map((l) => l.id)));
  const selectAllApproved = () => setSelected(new Set(approvedLines.map((l) => l.id)));
  const clearSelection = () => setSelected(new Set());

  const handleAggregate = async () => {
    setAggregating(true);
    setAggregationResult(null);
    try {
      const result = await aggregateApprovedTimesheets(orgId, periodStart, periodEnd);
      setAggregationResult(result);
      invalidateLines();
      onRefreshStats();
    } catch (e: any) {
      alert(`Aggregation failed: ${e.message}`);
    } finally {
      setAggregating(false);
    }
  };

  const handleApprove = async () => {
    const ids = [...selected].filter((id) => draftLines.some((l) => l.id === id));
    if (!ids.length) return alert("Select draft claim lines to approve");
    setApproving(true);
    try {
      await approveClaimLines(orgId, ids);
      clearSelection();
      invalidateLines();
      onRefreshStats();
    } catch (e: any) {
      alert(`Approval failed: ${e.message}`);
    } finally {
      setApproving(false);
    }
  };

  const handleGenerateCSV = async () => {
    const ids = [...selected].filter((id) => approvedLines.some((l) => l.id === id));
    if (!ids.length) {
      // If nothing selected, use all approved
      const allApproved = approvedLines.map((l) => l.id);
      if (!allApproved.length) return alert("No approved claim lines to submit");
      setGenerating(true);
      try {
        const { csv, batch_number } = await generateProdaCSV(orgId, allApproved);
        downloadCSV(csv, `${batch_number}.csv`);
        clearSelection();
        invalidateLines();
        onRefreshStats();
      } catch (e: any) {
        alert(`CSV generation failed: ${e.message}`);
      } finally {
        setGenerating(false);
      }
      return;
    }

    setGenerating(true);
    try {
      const { csv, batch_number } = await generateProdaCSV(orgId, ids);
      downloadCSV(csv, `${batch_number}.csv`);
      clearSelection();
      invalidateLines();
      onRefreshStats();
    } catch (e: any) {
      alert(`CSV generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Aggregation Engine ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Zap size={16} className="text-emerald-400" />
          Timesheet Aggregation Engine
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Sweep approved timesheets → calculate NDIS line items with MMM geographic loading → generate draft claim lines
        </p>

        <div className="mt-4 flex items-end gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-200 outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-200 outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={handleAggregate}
            disabled={aggregating}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {aggregating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {aggregating ? "Sweeping..." : "Run Aggregation"}
          </button>
        </div>

        {/* Aggregation Result */}
        <AnimatePresence>
          {aggregationResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <CheckCircle2 size={16} />
                Aggregation {aggregationResult.status === "completed" ? "Complete" : "Partial"}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-4 text-xs text-zinc-400">
                <div><span className="text-zinc-200 font-medium">{aggregationResult.timesheets_swept}</span> timesheets swept</div>
                <div><span className="text-zinc-200 font-medium">{aggregationResult.time_entries_processed}</span> entries processed</div>
                <div><span className="text-zinc-200 font-medium">{aggregationResult.claim_lines_created}</span> claim lines created</div>
                <div><span className="text-emerald-400 font-medium">{fmt(aggregationResult.total_claim_amount)}</span> total</div>
              </div>
              {aggregationResult.errors?.length > 0 && (
                <div className="mt-3 max-h-24 overflow-y-auto rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-400">
                  {aggregationResult.errors.map((e: any, i: number) => (
                    <div key={i}>⚠ {e.error} {e.entry_id !== "bulk_insert" && e.entry_id !== "fatal" ? `(Entry: ${e.entry_id.slice(0, 8)})` : ""}</div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Action Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-zinc-500">Filter:</span>
          {["all", "draft", "approved", "submitted", "paid", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white/[0.08] text-zinc-200"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {s === "all" ? "All" : CLAIM_STATUS[s]?.label || s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-[11px] text-zinc-500">{selected.size} selected</span>
          )}

          {draftLines.length > 0 && (
            <button
              onClick={selectAllDraft}
              className="rounded-md border border-white/[0.08] px-3 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.04]"
            >
              Select All Draft ({draftLines.length})
            </button>
          )}

          {selected.size > 0 && draftLines.some((l) => selected.has(l.id)) && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {approving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Approve Selected
            </button>
          )}

          {approvedLines.length > 0 && (
            <button
              onClick={handleGenerateCSV}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Generate PRODA CSV ({approvedLines.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Claim Lines Table ── */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="w-8 px-3 py-2">
                <input type="checkbox" className="accent-emerald-500" onChange={(e) => e.target.checked ? setSelected(new Set(filteredLines.map((l) => l.id))) : clearSelection()} />
              </th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Status</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">NDIS Item</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Participant</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Service Date</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Qty (hrs)</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Rate</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">MMM</th>
              <th className="px-3 py-2 text-[11px] font-medium text-zinc-500 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-zinc-500"><Loader2 size={18} className="mx-auto animate-spin" /></td></tr>
            ) : filteredLines.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-zinc-500">No claim lines found. Run an aggregation to generate draft claims.</td></tr>
            ) : (
              filteredLines.map((line) => {
                const st = CLAIM_STATUS[line.status] || CLAIM_STATUS.draft;
                const StIcon = st.icon;
                return (
                  <tr key={line.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={selected.has(line.id)}
                        onChange={() => toggleSelect(line.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.bg} ${st.text}`}>
                        <StIcon size={10} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[12px] font-mono text-zinc-300">{line.ndis_item_number || "—"}</div>
                      <div className="text-[10px] text-zinc-600 truncate max-w-[200px]">{line.description}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-[12px] text-zinc-300">{line.participant_profiles?.preferred_name || line.participant_id?.slice(0, 8)}</div>
                      <div className="text-[10px] font-mono text-zinc-600">{line.participant_profiles?.ndis_number || "—"}</div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-zinc-400">{fmtDate(line.service_date)}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-zinc-300">{parseFloat(String(line.quantity)).toFixed(2)}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-zinc-400">{fmt(line.unit_rate)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                        line.mmm_classification >= 5
                          ? "bg-rose-500/10 text-rose-400"
                          : line.mmm_classification >= 3
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-zinc-500/10 text-zinc-400"
                      }`}>
                        MMM{line.mmm_classification}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[12px] font-semibold text-zinc-200">{fmt(line.total_amount)}</span>
                      {line.rejection_code && (
                        <div className="text-[10px] text-rose-400 mt-0.5">{REJECTION_CODES[line.rejection_code] || line.rejection_reason || line.rejection_code}</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Batches Tab ─────────────────────────────────────────── */

function BatchesTab({ orgId, onRefreshStats }: { orgId: string; onRefreshStats: () => void }) {
  const queryClient = useQueryClient();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [prodaRef, setProdaRef] = useState("");

  const batchesKey = ["care", "prodaBatches", orgId] as const;

  const { data: batches = [], isLoading: loading } = useQuery<ProdaBatch[]>({
    queryKey: batchesKey,
    queryFn: () => fetchSynapseBatches(orgId),
    enabled: !!orgId,
  });

  const handleMarkSubmitted = async (batchId: string) => {
    setMarkingId(batchId);
    try {
      await markBatchSubmitted(batchId, prodaRef || undefined);
      setProdaRef("");
      queryClient.invalidateQueries({ queryKey: batchesKey });
      onRefreshStats();
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-200">PRODA Claim Batches</h2>

      {loading ? (
        <div className="py-8 text-center"><Loader2 size={18} className="mx-auto animate-spin text-zinc-500" /></div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
          No batches yet. Generate a PRODA CSV from the Pipeline tab to create your first batch.
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const st = BATCH_STATUS[batch.status] || BATCH_STATUS.draft;
            return (
              <div key={batch.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-200 font-mono">{batch.batch_number || batch.id.slice(0, 8)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                    {batch.proda_reference && (
                      <span className="text-[10px] font-mono text-zinc-500">PRODA: {batch.proda_reference}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-zinc-200">{fmt(parseFloat(String(batch.total_amount)))}</span>
                </div>

                <div className="mt-2 grid grid-cols-6 gap-4 text-[11px] text-zinc-500">
                  <div>Claims: <span className="text-zinc-300">{batch.total_claims}</span></div>
                  <div>Paid: <span className="text-emerald-400">{batch.successful_claims || 0}</span></div>
                  <div>Failed: <span className="text-rose-400">{batch.failed_claims || 0}</span></div>
                  <div>Paid Amt: <span className="text-emerald-400">{fmt(parseFloat(String(batch.paid_amount || 0)))}</span></div>
                  <div>Submitted: <span className="text-zinc-300">{fmtDateTime(batch.submitted_at)}</span></div>
                  <div>Period: <span className="text-zinc-300">{fmtDate(batch.aggregation_period_start)} – {fmtDate(batch.aggregation_period_end)}</span></div>
                </div>

                {/* Actions for submitted batches */}
                {batch.status === "submitted" && (
                  <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                    <input
                      type="text"
                      placeholder="PRODA Reference Number..."
                      value={markingId === batch.id ? prodaRef : ""}
                      onChange={(e) => setProdaRef(e.target.value)}
                      className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-emerald-500/50"
                    />
                    <button
                      onClick={() => handleMarkSubmitted(batch.id)}
                      disabled={markingId === batch.id}
                      className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {markingId === batch.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Mark as Submitted to PRODA
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Reconciliation Tab ──────────────────────────────────── */

function ReconciliationTab({ orgId, onRefreshStats }: { orgId: string; onRefreshStats: () => void }) {
  const queryClient = useQueryClient();
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [returns, setReturns] = useState<ReturnEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reconBatchesKey = ["care", "prodaReconBatches", orgId] as const;

  const { data: batches = [], isLoading: loading } = useQuery<ProdaBatch[]>({
    queryKey: reconBatchesKey,
    queryFn: async () => {
      const b = await fetchSynapseBatches(orgId);
      return b.filter((batch) => ["submitted", "processing", "partially_reconciled"].includes(batch.status));
    },
    enabled: !!orgId,
  });

  const loadReturns = useCallback(async (batchId: string) => {
    const data = await fetchSynapseReturnEntries(orgId, batchId);
    setReturns(data);
  }, [orgId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBatch) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const text = await file.text();
      const result = await ingestReturnFile(orgId, selectedBatch, text);
      setUploadResult(result);
      await loadReturns(selectedBatch);
      onRefreshStats();
    } catch (err: any) {
      alert(`Return file ingestion failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-200">Return File Reconciliation</h2>
      <p className="text-xs text-zinc-500">
        Upload the CSV return file from PRODA to automatically match claims and mark them as Paid or Rejected.
      </p>

      {/* Batch selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Select Batch to Reconcile</label>
          <select
            value={selectedBatch || ""}
            onChange={(e) => {
              setSelectedBatch(e.target.value || null);
              setReturns([]);
              setUploadResult(null);
              if (e.target.value) loadReturns(e.target.value);
            }}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-200 outline-none"
          >
            <option value="">— Select a batch —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_number} — {fmt(parseFloat(String(b.total_amount)))} ({b.total_claims} claims)
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!selectedBatch || uploading}
            className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload Return File (.csv)
          </button>
        </div>
      </div>

      {/* Upload Result */}
      <AnimatePresence>
        {uploadResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CheckCheck size={16} />
              Return File Processed
            </div>
            <div className="mt-2 grid grid-cols-6 gap-4 text-xs text-zinc-400">
              <div>Total Rows: <span className="text-zinc-200 font-medium">{uploadResult.total_rows}</span></div>
              <div>Paid: <span className="text-emerald-400 font-medium">{uploadResult.paid}</span></div>
              <div>Rejected: <span className="text-rose-400 font-medium">{uploadResult.rejected}</span></div>
              <div>Adjusted: <span className="text-amber-400 font-medium">{uploadResult.adjusted}</span></div>
              <div>Unmatched: <span className="text-zinc-400 font-medium">{uploadResult.unmatched}</span></div>
              <div>Paid Total: <span className="text-emerald-400 font-medium">{fmt(uploadResult.paid_total)}</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Entries Table */}
      {returns.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Outcome</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Claim Ref</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">NDIS Number</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Item</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Service Date</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500 text-right">Amount</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500 text-right">Paid</th>
                <th className="px-3 py-2 text-[11px] font-medium text-zinc-500">Rejection</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.outcome === "paid" ? "bg-emerald-500/10 text-emerald-400" :
                      r.outcome === "rejected" ? "bg-rose-500/10 text-rose-400" :
                      r.outcome === "adjusted" ? "bg-amber-500/10 text-amber-400" :
                      "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {r.outcome.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-zinc-300">{r.claim_reference}</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-zinc-400">{r.ndis_number || "—"}</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-zinc-400">{r.support_item_number || "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-zinc-400">{fmtDate(r.service_date)}</td>
                  <td className="px-3 py-2 text-right text-[12px] font-mono text-zinc-300">{r.total_price ? fmt(r.total_price) : "—"}</td>
                  <td className="px-3 py-2 text-right text-[12px] font-mono text-emerald-400">{r.paid_amount ? fmt(r.paid_amount) : "—"}</td>
                  <td className="px-3 py-2 text-[11px] text-rose-400">
                    {r.rejection_code && (
                      <span title={r.rejection_reason || ""}>{r.rejection_code}: {REJECTION_CODES[r.rejection_code] || r.rejection_reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── History Tab ─────────────────────────────────────────── */

function HistoryTab({ orgId }: { orgId: string }) {
  const { data: runs = [], isLoading: loading } = useQuery<AggregationRun[]>({
    queryKey: ["care", "prodaHistory", orgId],
    queryFn: () => fetchSynapseAggregationRuns(orgId),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-200">Aggregation Run History</h2>

      {loading ? (
        <div className="py-8 text-center"><Loader2 size={18} className="mx-auto animate-spin text-zinc-500" /></div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
          No aggregation runs yet. Use the Pipeline tab to run your first timesheet sweep.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    run.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                    run.status === "partial" ? "bg-amber-500/10 text-amber-400" :
                    run.status === "failed" ? "bg-rose-500/10 text-rose-400" :
                    "bg-blue-500/10 text-blue-400"
                  }`}>
                    {run.status.toUpperCase()}
                  </span>
                  <span className="text-[12px] text-zinc-400">
                    {fmtDate(run.period_start)} — {fmtDate(run.period_end)}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">{fmtDateTime(run.created_at)}</span>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-4 text-[11px] text-zinc-500">
                <div>Timesheets: <span className="text-zinc-300">{run.timesheets_swept}</span></div>
                <div>Entries: <span className="text-zinc-300">{run.time_entries_processed}</span></div>
                <div>Claims: <span className="text-zinc-300">{run.claim_lines_created}</span></div>
                <div>Total: <span className="text-emerald-400">{fmt(parseFloat(String(run.total_claim_amount)))}</span></div>
              </div>

              {run.error_log && Array.isArray(run.error_log) && run.error_log.length > 0 && (
                <div className="mt-2 max-h-16 overflow-y-auto rounded border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-400">
                  {(run.error_log as any[]).slice(0, 5).map((e: any, i: number) => (
                    <div key={i}>⚠ {e.error}</div>
                  ))}
                  {run.error_log.length > 5 && <div>...and {run.error_log.length - 5} more</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Utility: Download CSV ───────────────────────────────── */

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
