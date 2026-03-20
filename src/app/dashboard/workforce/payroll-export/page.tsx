/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, RefreshCw, Zap, ChevronRight, Check, AlertTriangle,
  FileText, Users, DollarSign, Clock, Loader2, BarChart3, X,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getPayrollBatchSummary,
  exportPayrunCsv,
  exportPayrunToXero,
  runSchadsEngine,
  PAY_CATEGORY_LABELS,
  ALLOWANCE_LABELS,
  type PayrollBatchSummary,
  type TimesheetPayLine,
  type PayCategory,
  type AllowanceType,
} from "@/app/actions/schads-payroll";
import { LetterAvatar } from "@/components/ui/letter-avatar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
}

function formatUnits(val: number): string {
  return Number(val).toFixed(2);
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getFortnightDates(): { start: string; end: string; label: string } {
  const now = new Date();
  // ISO week start = Monday
  const day = now.getDay(); // 0=Sun, 1=Mon..
  const diffToMon = (day + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diffToMon);
  // Go back to nearest fortnight boundary (every 2 weeks from a reference date)
  const fortnightStart = new Date(mon);
  const fortnightEnd = new Date(fortnightStart);
  fortnightEnd.setDate(fortnightStart.getDate() + 13);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${fortnightStart.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })} – ${fortnightEnd.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { start: fmt(fortnightStart), end: fmt(fortnightEnd), label };
}

const PAY_CATEGORY_COLOR: Record<string, string> = {
  ORDINARY_HOURS: "bg-zinc-700 text-zinc-300",
  EVENING_SHIFT: "bg-amber-500/10 text-amber-400",
  NIGHT_SHIFT: "bg-indigo-500/10 text-indigo-400",
  SATURDAY: "bg-purple-500/10 text-purple-400",
  SUNDAY: "bg-rose-500/10 text-rose-400",
  PUBLIC_HOLIDAY: "bg-rose-500/20 text-rose-400",
  OVERTIME_1_5X: "bg-orange-500/10 text-orange-400",
  OVERTIME_2_0X: "bg-orange-500/15 text-orange-500",
  MINIMUM_ENGAGEMENT_PADDING: "bg-zinc-800 text-zinc-500",
  CLIENT_CANCELLATION: "bg-yellow-500/10 text-yellow-400",
};

// ─── Worker Batch Row ─────────────────────────────────────────────────────────

function WorkerBatchRow({
  batch,
  selected,
  onToggle,
  onExpand,
}: {
  batch: PayrollBatchSummary;
  selected: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const totalHours = batch.payLines
    .filter((l) => !l.is_synthetic && l.allowance_type === "NONE")
    .reduce((s, l) => s + Number(l.units), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex items-center h-16 border-b border-white/5 px-4 gap-4 cursor-pointer transition-colors ${
        selected ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"
      }`}
      onClick={onExpand}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          selected
            ? "bg-emerald-500 border-emerald-500"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        {selected && <Check className="w-2.5 h-2.5 text-black" />}
      </div>

      {/* Avatar */}
      <LetterAvatar name={batch.workerName} src={batch.workerAvatar} size={32} />

      {/* Name + level */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-200 truncate">{batch.workerName}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          {batch.employmentType || "—"}
          {batch.schadsLevel ? ` · SCHADS L${batch.schadsLevel}` : ""}
          {" · "}
          {batch.timesheetIds.length} timesheet(s)
        </p>
      </div>

      {/* Ordinary */}
      <div className="text-right w-24 hidden md:block">
        <span className="text-[10px] text-zinc-600 block">Ordinary</span>
        <span
          className="text-[12px] text-zinc-300"
          style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
        >
          {formatAUD(batch.totalOrdinary)}
        </span>
      </div>

      {/* Overtime */}
      <div className="text-right w-24 hidden md:block">
        <span className="text-[10px] text-zinc-600 block">Overtime</span>
        <span
          className={`text-[12px] ${batch.totalOvertime > 0 ? "text-orange-400" : "text-zinc-600"}`}
          style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
        >
          {formatAUD(batch.totalOvertime)}
        </span>
      </div>

      {/* Hours */}
      <div className="text-right w-20">
        <span className="text-[10px] text-zinc-600 block">Hours</span>
        <span
          className="text-[12px] text-zinc-300"
          style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
        >
          {formatUnits(totalHours)}h
        </span>
      </div>

      {/* Gross */}
      <div className="text-right w-28">
        <span className="text-[10px] text-zinc-600 block">Gross</span>
        <span
          className="text-[13px] text-white font-semibold"
          style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
        >
          {formatAUD(batch.totalGross)}
        </span>
      </div>

      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
    </motion.div>
  );
}

// ─── Expanded Pay Line Drawer ─────────────────────────────────────────────────

function PayLineDrawer({
  batch,
  onClose,
}: {
  batch: PayrollBatchSummary;
  onClose: () => void;
}) {
  const grouped = new Map<string, TimesheetPayLine[]>();
  for (const line of batch.payLines) {
    if (!grouped.has(line.shift_date)) grouped.set(line.shift_date, []);
    grouped.get(line.shift_date)!.push(line);
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 w-[580px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <p className="text-[13px] font-semibold text-zinc-200">{batch.workerName}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {batch.employmentType || "—"}{batch.schadsLevel ? ` · SCHADS L${batch.schadsLevel}` : ""}
            {" · "}{batch.payLines.length} pay line(s)
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pay lines */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-2 border-b border-white/5 sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
          {["LINE ITEM", "UNITS", "RATE", "MULT.", "TOTAL"].map((h) => (
            <span key={h} className={`text-[9px] uppercase tracking-widest font-semibold text-zinc-600 ${h !== "LINE ITEM" ? "text-right" : ""}`}>
              {h}
            </span>
          ))}
        </div>

        {Array.from(grouped.entries()).map(([date, dateLines]) => {
          const dateTotal = dateLines.reduce((s, l) => s + Number(l.total_line_amount), 0);
          return (
            <div key={date}>
              <div className="px-5 py-1.5 bg-zinc-900/40 border-b border-white/[0.03]">
                <span className="text-[9px] text-zinc-600 font-mono">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>

              {dateLines.map((line) => {
                const label = line.allowance_type !== "NONE"
                  ? ALLOWANCE_LABELS[line.allowance_type as AllowanceType]
                  : PAY_CATEGORY_LABELS[line.pay_category as PayCategory];
                const colorClass = PAY_CATEGORY_COLOR[line.pay_category] || "text-zinc-400";

                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-2 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`text-[11px] font-medium ${colorClass.includes("text-") ? colorClass : "text-zinc-400"}`}>
                        {label}
                        {line.is_synthetic && <span className="ml-1 text-[9px] text-zinc-700">[synth]</span>}
                      </span>
                      {line.notes && (
                        <span className="text-[9px] text-zinc-700 truncate mt-0.5" title={line.notes}>{line.notes}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-300 text-right font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                      {line.allowance_type !== "NONE" && Number(line.units) === 1 ? "1 unit" : `${Number(line.units).toFixed(4)}h`}
                    </span>
                    <span className="text-[11px] text-zinc-300 text-right font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                      {line.allowance_type !== "NONE" && Number(line.units) === 1 ? "Fixed" : `$${Number(line.calculated_rate).toFixed(4)}`}
                    </span>
                    <span className="text-[11px] text-zinc-500 text-right font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                      {line.allowance_type !== "NONE" ? "—" : `${Number(line.rate_multiplier).toFixed(4)}x`}
                    </span>
                    <span className="text-[11px] text-white font-medium text-right font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                      ${Number(line.total_line_amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}

              {/* Date subtotal */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-5 py-1.5 bg-zinc-900/20 border-b border-white/[0.05]">
                <span className="text-[9px] text-zinc-600 col-span-4 text-right pr-4">Subtotal</span>
                <span className="text-[11px] text-zinc-400 text-right font-mono" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                  ${dateTotal.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gross total footer */}
      <div className="border-t border-white/5 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Gross Pay</p>
            <p className="text-[10px] text-zinc-700 mt-0.5">{batch.payLines.length} line items · {batch.timesheetIds.length} timesheet(s)</p>
          </div>
          <span
            className="text-[20px] font-bold text-white"
            style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
          >
            {formatAUD(batch.totalGross)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollExportPage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedWorker, setExpandedWorker] = useState<PayrollBatchSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [showXeroModal, setShowXeroModal] = useState(false);
  const [xeroTenantId, setXeroTenantId] = useState("");

  const fortnight = getFortnightDates();
  const [period, setPeriod] = useState(fortnight);

  const { data: batches = [], isLoading: loading } = useQuery<PayrollBatchSummary[]>({
    queryKey: [...queryKeys.workforce.payrollExport(orgId!), period.start, period.end],
    queryFn: async () => {
      const { batches: data, error } = await getPayrollBatchSummary(orgId!, period.start, period.end);
      if (error) {
        addToast(error, undefined, "error");
        return [];
      }
      return data;
    },
    enabled: !!orgId,
  });

  const totalGross = batches.reduce((s, b) => s + b.totalGross, 0);
  const totalWorkers = batches.length;
  const totalOT = batches.reduce((s, b) => s + b.totalOvertime, 0);
  const selectedBatches = batches.filter((b) => selectedIds.has(b.workerId));

  function toggleAll() {
    if (selectedIds.size === batches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batches.map((b) => b.workerId)));
    }
  }

  async function handleCsvExport() {
    if (!orgId) return;
    setExporting(true);
    const { csv, error } = await exportPayrunCsv(orgId, period.start, period.end);
    setExporting(false);
    if (error || !csv) {
      addToast(error || "Export failed", undefined, "error");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iWorkr-payroll-${period.start}-to-${period.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`CSV exported — ${period.label}`);
  }

  async function handleXeroExport() {
    if (!orgId || !xeroTenantId) {
      addToast("Enter your Xero Tenant ID to continue", undefined, "error");
      return;
    }
    const allTimesheetIds = selectedBatches.length > 0
      ? selectedBatches.flatMap((b) => b.timesheetIds)
      : batches.flatMap((b) => b.timesheetIds);

    setExporting(true);
    const { ok, xeroPayRunId, error } = await exportPayrunToXero(
      orgId, allTimesheetIds, xeroTenantId, period.start, period.end,
    );
    setExporting(false);
    setShowXeroModal(false);
    if (!ok || error) {
      addToast(error || "Xero export failed", undefined, "error");
      return;
    }
    addToast(`Synced to Xero${xeroPayRunId ? ` (Run ID: ${xeroPayRunId.slice(0, 8)}...)` : ""}`);
    queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollExport(orgId!) });
  }

  async function handleProcessAll() {
    if (!orgId) return;
    startTransition(async () => {
      const unprocessed = batches.filter((b) => b.payLines.length === 0);
      if (unprocessed.length === 0) {
        addToast("All timesheets already processed", undefined, "error");
        return;
      }
      let count = 0;
      for (const batch of unprocessed) {
        for (const tsId of batch.timesheetIds) {
          const { ok } = await runSchadsEngine(tsId, orgId!);
          if (ok) count++;
        }
      }
      addToast(`SCHADS engine processed ${count} timesheet(s)`);
      queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollExport(orgId!) });
    });
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* ── Command Header ── */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 bg-[#050505]/95 backdrop-blur-sm z-40">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600 uppercase tracking-widest">Workforce</span>
          <ChevronRight className="w-3 h-3 text-zinc-700" />
          <span className="text-[11px] text-zinc-400 uppercase tracking-widest">Payroll Export</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Period picker (simplified) */}
          <div className="flex items-center gap-1 h-7 px-2.5 bg-zinc-900 border border-white/5 rounded text-[11px] text-zinc-400">
            <Clock className="w-3 h-3 text-zinc-600" />
            <span>{period.label}</span>
          </div>

          <button
            onClick={handleProcessAll}
            disabled={isPending || loading}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 border border-white/5 rounded hover:border-white/10 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Run All SCHADS
          </button>

          <button
            onClick={handleCsvExport}
            disabled={exporting}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 border border-white/5 rounded hover:border-white/10 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Export CSV
          </button>

          <button
            onClick={() => setShowXeroModal(true)}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold bg-[#00B9D3]/10 text-[#00B9D3] border border-[#00B9D3]/20 rounded hover:bg-[#00B9D3]/20 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
              <path d="M6.003 13.617a1.893 1.893 0 100-3.786 1.893 1.893 0 000 3.786z"/>
              <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-5.997 7.894a4.83 4.83 0 110 8.212 4.83 4.83 0 010-8.212zm9.243 3.724l2.55 2.55a.65.65 0 01-.919.92l-2.549-2.55-2.55 2.55a.65.65 0 01-.919-.919l2.549-2.55-2.549-2.55a.65.65 0 01.919-.919l2.55 2.55 2.549-2.55a.65.65 0 01.92.919l-2.551 2.549z"/>
            </svg>
            Export to Xero
          </button>
        </div>
      </div>

      {/* ── Telemetry ribbon ── */}
      <div className="border-b border-white/5 bg-zinc-950/30">
        <div className="flex items-center px-6 h-16 gap-8">
          {[
            { label: "Pay Period", value: period.label, icon: Clock, plain: true },
            { label: "Workers", value: String(totalWorkers), icon: Users, mono: false },
            { label: "Total Payroll", value: formatAUD(totalGross), icon: DollarSign, mono: true },
            { label: "Overtime", value: formatAUD(totalOT), icon: BarChart3, mono: true, alert: totalOT > 5000 },
            { label: "Timesheets", value: String(batches.reduce((s, b) => s + b.timesheetIds.length, 0)), icon: FileText, mono: false },
          ].map(({ label, value, icon: Icon, mono, alert, plain }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className={`w-3.5 h-3.5 ${alert ? "text-rose-500" : "text-zinc-700"}`} />
              <div>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">{label}</span>
                <span
                  className={`${mono ? "text-[16px]" : "text-[13px]"} font-${mono ? "semibold" : "medium"} ${alert ? "text-rose-400 animate-pulse" : "text-white"}`}
                  style={mono ? { fontFamily: "'JetBrains Mono', 'Courier New', monospace" } : undefined}
                >
                  {value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table header ── */}
      <div className="px-4 py-3 flex items-center gap-4 border-b border-white/5 bg-[#0A0A0A]">
        <div
          onClick={toggleAll}
          className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center shrink-0 transition-colors ${
            selectedIds.size === batches.length && batches.length > 0
              ? "bg-emerald-500 border-emerald-500"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          {selectedIds.size === batches.length && batches.length > 0 && (
            <Check className="w-2.5 h-2.5 text-black" />
          )}
        </div>
        <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center pr-8">
          <span className="text-[9px] uppercase tracking-widest text-zinc-600">Worker</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 w-24 text-right hidden md:block">Ordinary</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 w-24 text-right hidden md:block">Overtime</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 w-20 text-right">Hours</span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-600 w-28 text-right">Gross Pay</span>
          <span className="w-4" />
        </div>
      </div>

      {/* ── Batch list ── */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            <span className="text-sm text-zinc-600">Loading payroll data…</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No processed timesheets for this pay period.</p>
            <p className="text-xs text-zinc-700 mt-1">Click "Run All SCHADS" to process approved timesheets.</p>
          </div>
        ) : (
          batches.map((batch) => (
            <WorkerBatchRow
              key={batch.workerId}
              batch={batch}
              selected={selectedIds.has(batch.workerId)}
              onToggle={() => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(batch.workerId)) next.delete(batch.workerId);
                  else next.add(batch.workerId);
                  return next;
                });
              }}
              onExpand={() => setExpandedWorker(batch)}
            />
          ))
        )}
      </div>

      {/* ── Bulk action bar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-xl px-5 py-3 shadow-2xl shadow-black/40">
              <span className="text-[12px] text-zinc-300 font-medium">
                {selectedIds.size} worker(s) selected
              </span>
              <div className="w-px h-4 bg-white/10" />
              <span className="text-[12px] font-semibold" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
                {formatAUD(selectedBatches.reduce((s, b) => s + b.totalGross, 0))}
              </span>
              <button
                onClick={handleCsvExport}
                className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 border border-white/5 rounded hover:text-zinc-200 transition-colors"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
              <button
                onClick={() => setShowXeroModal(true)}
                className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold bg-[#00B9D3]/10 text-[#00B9D3] border border-[#00B9D3]/20 rounded hover:bg-[#00B9D3]/20 transition-colors"
              >
                Export to Xero
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded worker slide-over ── */}
      <AnimatePresence>
        {expandedWorker && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setExpandedWorker(null)}
            />
            <PayLineDrawer
              batch={expandedWorker}
              onClose={() => setExpandedWorker(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Xero Modal ── */}
      <AnimatePresence>
        {showXeroModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-[420px] shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-zinc-100 mb-1 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#00B9D3]">
                  <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-5.997 7.894a4.83 4.83 0 110 8.212 4.83 4.83 0 010-8.212zm9.243 3.724l2.55 2.55a.65.65 0 01-.919.92l-2.549-2.55-2.55 2.55a.65.65 0 01-.919-.919l2.549-2.55-2.549-2.55a.65.65 0 01.919-.919l2.55 2.55 2.549-2.55a.65.65 0 01.92.919l-2.551 2.549z"/>
                </svg>
                Export to Xero Payroll
              </h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                Submit pay lines for {selectedIds.size > 0 ? `${selectedIds.size} selected worker(s)` : `all ${batches.length} worker(s)`} to Xero for the period: {period.label}.
              </p>

              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
                  Xero Tenant ID
                </label>
                <input
                  type="text"
                  value={xeroTenantId}
                  onChange={(e) => setXeroTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full h-8 px-2.5 bg-zinc-950 border border-white/5 rounded text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-white/20"
                />
                <p className="text-[9px] text-zinc-700 mt-1">
                  Find in Xero: Settings → General Settings → Organisation Details
                </p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/10 rounded px-3 py-2 mb-4">
                <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  This action will lock all selected timesheets permanently.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowXeroModal(false)}
                  className="flex-1 h-8 text-[12px] text-zinc-500 border border-white/5 rounded hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleXeroExport}
                  disabled={exporting || !xeroTenantId}
                  className="flex-1 h-8 text-[12px] font-semibold bg-[#00B9D3]/10 text-[#00B9D3] border border-[#00B9D3]/20 rounded hover:bg-[#00B9D3]/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirm Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
