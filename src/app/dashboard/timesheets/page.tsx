/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search, Clock, AlertTriangle, Check, ChevronRight, MapPin,
  ArrowUpRight, ArrowDownRight, Timer, Users, Calendar, Download,
  CheckCircle2, XCircle, Loader2, BarChart3, FileSpreadsheet,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchTimeEntriesAction,
  fetchPayrollExportsAction,
  fetchTimesheetSummaryAction,
  resolveExceptionAction,
  type TimeEntry as ServerTimeEntry,
  type PayrollExport,
} from "@/app/actions/timesheets";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type ExceptionType = "overtime" | "late_start" | "early_finish" | "missed_clock_out" | "geofence_breach";
type AnomalyStatus = "pending" | "approved" | "truncated" | "dismissed";
type ExportStatus = "success" | "processing" | "failed" | "partial_fail";
type TSTab = "triage" | "grid" | "export";

interface TriageEntry {
  id: string;
  worker_name: string;
  date: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string;
  actual_end: string;
  variance_minutes: number;
  exception_type: ExceptionType;
  status: AnomalyStatus;
  total_hours: number;
  clock_in_location: string;
  notes: string;
}

interface GridCell {
  hours: number | null;
  status: "approved" | "review" | "missing" | "none";
}

interface ExportRecord {
  id: string;
  export_date: string;
  period: string;
  platform: string;
  workers: number;
  hours: number;
  status: ExportStatus;
}

const TABS: { id: TSTab; label: string }[] = [
  { id: "triage", label: "Triage" },
  { id: "grid", label: "Grid View" },
  { id: "export", label: "Export" },
];

const EXCEPTION_CONFIG: Record<ExceptionType, { label: string; color: string; icon: typeof ArrowUpRight }> = {
  overtime:          { label: "Overtime",          color: "text-emerald-400", icon: ArrowUpRight },
  late_start:        { label: "Late Start",        color: "text-amber-400",   icon: Clock },
  early_finish:      { label: "Early Finish",      color: "text-amber-400",   icon: ArrowDownRight },
  missed_clock_out:  { label: "Missed Clock-Out",  color: "text-rose-400",    icon: XCircle },
  geofence_breach:   { label: "Geofence Breach",   color: "text-rose-400",    icon: MapPin },
};

const EXPORT_STATUS_CONFIG: Record<ExportStatus, { label: string; bg: string; text: string }> = {
  success:      { label: "Complete",      bg: "bg-emerald-500/10", text: "text-emerald-400" },
  processing:   { label: "Processing",    bg: "bg-amber-500/10",   text: "text-amber-400" },
  failed:       { label: "Failed",        bg: "bg-rose-500/10",    text: "text-rose-400" },
  partial_fail: { label: "Partial Fail",  bg: "bg-amber-500/10",   text: "text-amber-400" },
};

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

/** Map a server TimeEntry to the TriageEntry shape the UI expects */
function toTriageEntry(e: ServerTimeEntry): TriageEntry {
  const exType = (e.exception_type ?? "overtime") as ExceptionType;
  const clockIn = e.clock_in ?? "";
  const clockOut = e.clock_out ?? "—";
  const scheduledStart = e.scheduled_start ?? "";
  const scheduledEnd = e.scheduled_end ?? "";

  // Derive status — if exception_resolved, it's approved; otherwise pending
  let status: AnomalyStatus = "pending";
  if (e.exception_resolved) status = "approved";
  if (e.status === "approved") status = "approved";
  if (e.status === "disputed") status = "dismissed";

  // Format location string
  let locationStr = "";
  if (e.clock_in_location && typeof e.clock_in_location === "object") {
    locationStr = `${(e.clock_in_location as any).lat}, ${(e.clock_in_location as any).lng}`;
  }

  return {
    id: e.id,
    worker_name: e.worker_name ?? "Unknown",
    date: clockIn.slice(0, 10),
    scheduled_start: scheduledStart.length >= 16 ? scheduledStart.slice(11, 16) : scheduledStart,
    scheduled_end: scheduledEnd.length >= 16 ? scheduledEnd.slice(11, 16) : scheduledEnd,
    actual_start: clockIn.length >= 16 ? clockIn.slice(11, 16) : clockIn,
    actual_end: clockOut === "—" ? "—" : (clockOut.length >= 16 ? clockOut.slice(11, 16) : clockOut),
    variance_minutes: e.variance_minutes ?? 0,
    exception_type: exType,
    status,
    total_hours: e.total_hours ?? 0,
    clock_in_location: locationStr,
    notes: e.exception_notes ?? e.geofence_override_reason ?? "",
  };
}

/** Map a PayrollExport to the ExportRecord shape the UI expects */
function toExportRecord(exp: PayrollExport): ExportRecord {
  const start = exp.period_start?.slice(0, 10) ?? "";
  const end = exp.period_end?.slice(0, 10) ?? "";

  // Format period as "Mar 2–8, 2026"
  let period = `${start} – ${end}`;
  try {
    const s = new Date(start);
    const e = new Date(end);
    const month = s.toLocaleDateString("en-AU", { month: "short" });
    period = `${month} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  } catch { /* fallback to raw dates */ }

  return {
    id: exp.id,
    export_date: exp.created_at?.slice(0, 10) ?? "",
    period,
    platform: exp.target_platform?.toUpperCase() ?? "CSV",
    workers: exp.worker_count ?? 0,
    hours: exp.total_hours ?? 0,
    status: exp.batch_status === "partial_fail" ? "partial_fail" : exp.batch_status as ExportStatus,
  };
}

/** Build the grid data from raw time entries for a given week */
function buildGridData(
  allEntries: ServerTimeEntry[],
  weekStart: Date
): { workers: string[]; days: string[]; grid: Record<string, GridCell[]> } {
  // Build day labels for the week
  const days: string[] = [];
  const dayDates: string[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(`${dayNames[d.getDay()]} ${d.getDate()}`);
    dayDates.push(d.toISOString().slice(0, 10));
  }

  // Group entries by worker name
  const workerMap = new Map<string, ServerTimeEntry[]>();
  for (const e of allEntries) {
    const name = e.worker_name ?? "Unknown";
    if (!workerMap.has(name)) workerMap.set(name, []);
    workerMap.get(name)!.push(e);
  }

  const workers = Array.from(workerMap.keys()).sort();
  const grid: Record<string, GridCell[]> = {};

  for (const worker of workers) {
    const workerEntries = workerMap.get(worker) ?? [];
    const cells: GridCell[] = dayDates.map((dateStr) => {
      // Find entry(ies) for this worker on this day
      const dayEntries = workerEntries.filter((e) => e.clock_in?.slice(0, 10) === dateStr);
      if (dayEntries.length === 0) return { hours: null, status: "none" as const };

      const totalHours = dayEntries.reduce((s, e) => s + (e.total_hours ?? 0), 0);
      const hasUnresolved = dayEntries.some(
        (e) => e.exception_type && !e.exception_resolved
      );
      const allApproved = dayEntries.every(
        (e) => e.status === "approved" || e.status === "auto_resolved"
      );
      const hasMissing = dayEntries.some(
        (e) => e.status === "active" && !e.clock_out
      );

      if (hasMissing) return { hours: null, status: "missing" as const };
      if (hasUnresolved) return { hours: Math.round(totalHours * 10) / 10, status: "review" as const };
      if (allApproved) return { hours: Math.round(totalHours * 10) / 10, status: "approved" as const };
      return { hours: Math.round(totalHours * 10) / 10, status: "review" as const };
    });
    grid[worker] = cells;
  }

  return { workers, days, grid };
}

function formatVariance(v: number, type: ExceptionType): string {
  if (type === "missed_clock_out") return "Missing clock-out";
  if (type === "geofence_breach") return "GPS mismatch";
  const h = Math.abs(v) / 60;
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${h.toFixed(1)}h ${type === "overtime" ? "overtime" : type.replace("_", " ")}`;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase();
}

/** Get the Monday of the current week */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function TimesheetsPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [activeTab, setActiveTab] = useState<TSTab>("triage");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridSelectAll, setGridSelectAll] = useState(false);
  const [exportPlatform, setExportPlatform] = useState("xero");

  // ── Data state ─────────────────────────────────────────
  const [entries, setEntries] = useState<TriageEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<ServerTimeEntry[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [summary, setSummary] = useState<{
    statusCounts: Record<string, number>;
    totalHours: number;
    totalOvertime: number;
    totalTimesheets: number;
    unresolvedExceptions: number;
  } | null>(null);

  // ── Loading / error state ──────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Grid state (derived) ───────────────────────────────
  const weekStart = useMemo(() => getWeekStart(), []);
  const gridData = useMemo(
    () => buildGridData(allTimeEntries, weekStart),
    [allTimeEntries, weekStart]
  );

  // ── Fetch data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [timeEntries, payrollExports, summaryData] = await Promise.all([
        fetchTimeEntriesAction(orgId, { has_exception: true }),
        fetchPayrollExportsAction(orgId),
        fetchTimesheetSummaryAction(orgId),
      ]);

      // Also fetch all time entries for the grid view (current week)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const allEntries = await fetchTimeEntriesAction(orgId, {
        date_from: weekStart.toISOString(),
        date_to: weekEnd.toISOString(),
      });

      // Map to UI shapes
      const triageEntries = (timeEntries || []).map(toTriageEntry);
      const exportRecords = (payrollExports || []).map(toExportRecord);

      setEntries(triageEntries);
      setAllTimeEntries(allEntries || []);
      setExports(exportRecords);
      setSummary(summaryData);

      // Auto-select first pending entry
      const firstPending = triageEntries.find((e: TriageEntry) => e.status === "pending");
      if (firstPending) setSelectedId(firstPending.id);
    } catch (e: any) {
      console.error("[timesheets] Failed to load data:", e);
      setError(e.message || "Failed to load timesheet data");
    } finally {
      setLoading(false);
    }
  }, [orgId, weekStart]);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId, loadData]);

  /* ── Triage stats ─────────────────────────────────── */
  const stats = useMemo(() => {
    const pending = entries.filter((e) => e.status === "pending").length;
    const approved = entries.filter((e) => e.status === "approved").length;
    const total = entries.length;
    const hours = summary?.totalHours ?? entries.reduce((s, e) => s + e.total_hours, 0);
    return { pending, approved, total, hours };
  }, [entries, summary]);

  /* ── Filtered entries ─────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search) return entries.filter((e) => e.status === "pending");
    const q = search.toLowerCase();
    return entries.filter(
      (e) => e.status === "pending" && (e.worker_name.toLowerCase().includes(q) || e.exception_type.includes(q))
    );
  }, [entries, search]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);

  /* ── Actions ──────────────────────────────────────── */
  const handleApprove = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await resolveExceptionAction(id, "approve", "Approved via triage");
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "approved" as AnomalyStatus } : e)));
      setSelectedId(null);
    } catch (e: any) {
      console.error("[timesheets] Approve failed:", e);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleTruncate = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await resolveExceptionAction(id, "truncate", "Truncated to scheduled end time");
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "truncated" as AnomalyStatus } : e)));
      setSelectedId(null);
    } catch (e: any) {
      console.error("[timesheets] Truncate failed:", e);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // ── Global loading state ───────────────────────────
  if (orgLoading || (loading && entries.length === 0)) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-500" />
          <p className="text-[12px] text-zinc-600">Loading timesheets…</p>
        </div>
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle size={24} className="text-rose-400" />
          <p className="text-[13px] font-medium text-zinc-400">Failed to load timesheets</p>
          <p className="text-[11px] text-zinc-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      {/* Noise */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 z-0 h-64"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ═══ Sticky Header ═══ */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="px-4 pt-4 pb-0 md:px-6 md:pt-5">
          {/* Title row */}
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                Timesheets &amp; Payroll
              </p>
              <h1 className="text-[15px] font-medium tracking-tight text-zinc-200">Payroll Engine</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search entries..."
                  className="h-8 w-48 rounded-lg border border-white/[0.06] bg-white/[0.03] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500/30"
                />
                {/* Emerald focus bar */}
                <motion.div
                  className="absolute bottom-0 left-2 right-2 h-px bg-emerald-500"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: search ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </div>

              {/* CTA */}
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Log Time
                </div>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                    isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="ts-tab-dot"
                      className="absolute inset-x-0 -bottom-px mx-auto h-[3px] w-3 rounded-full bg-emerald-500"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Tab Content ═══ */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "triage" && (
            <motion.div key="triage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <TriageTab
                entries={filtered}
                selected={selected}
                stats={stats}
                onSelect={setSelectedId}
                onApprove={handleApprove}
                onTruncate={handleTruncate}
                actionLoading={actionLoading}
              />
            </motion.div>
          )}
          {activeTab === "grid" && (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <GridViewTab
                workers={gridData.workers}
                days={gridData.days}
                grid={gridData.grid}
                weekStart={weekStart}
                selectAll={gridSelectAll}
                onToggleSelectAll={() => setGridSelectAll((p) => !p)}
                loading={loading}
              />
            </motion.div>
          )}
          {activeTab === "export" && (
            <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ExportTab
                exports={exports}
                platform={exportPlatform}
                onPlatformChange={setExportPlatform}
                loading={loading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Footer ═══ */}
      <div className="border-t border-white/[0.03] bg-zinc-950/60 px-6 py-2">
        <div className="flex items-center gap-4 text-[10px] text-zinc-600">
          <span><kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[9px]">↵</kbd> Select</span>
          <span><kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[9px]">A</kbd> Approve</span>
          <span><kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[9px]">T</kbd> Truncate</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1 — TRIAGE
   ═══════════════════════════════════════════════════════════════════ */

function TriageTab({
  entries, selected, stats, onSelect, onApprove, onTruncate, actionLoading,
}: {
  entries: TriageEntry[];
  selected: TriageEntry | null;
  stats: { pending: number; approved: number; total: number; hours: number };
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onTruncate: (id: string) => void;
  actionLoading: string | null;
}) {
  return (
    <div className="flex flex-col">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 border-b border-white/[0.03] px-6 py-4">
        {[
          { label: "Pending Review", value: stats.pending, color: "text-amber-400", icon: AlertTriangle },
          { label: "Auto-Approved",  value: stats.approved, color: "text-emerald-400", icon: CheckCircle2 },
          { label: "Total Exceptions", value: stats.total, color: "text-rose-400", icon: BarChart3 },
          { label: "Hours This Period", value: `${stats.hours.toFixed(1)}h`, color: "text-zinc-300", icon: Timer },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
            <div className="mb-1 flex items-center gap-1.5">
              <s.icon size={11} className={s.color} />
              <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{s.label}</span>
            </div>
            <p className={`text-[20px] font-semibold tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Split panel */}
      <div className="flex flex-1">
        {/* LEFT — Anomaly Feed */}
        <div className="w-[60%] border-r border-white/[0.03]">
          {/* Column header */}
          <div className="grid grid-cols-[1fr_100px_120px_80px] gap-2 border-b border-white/[0.03] bg-[var(--surface-1)] px-6 py-2">
            {["Worker", "Date", "Variance", "Status"].map((h) => (
              <span key={h} className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{h}</span>
            ))}
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckCircle2 size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
              <p className="text-[13px] font-medium text-zinc-500">No exceptions to review</p>
              <p className="mt-1 text-[11px] text-zinc-700">All time entries are clean for this period.</p>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => {
                const exc = EXCEPTION_CONFIG[entry.exception_type] ?? EXCEPTION_CONFIG.overtime;
                const Icon = exc.icon;
                const isSelected = selected?.id === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    onClick={() => onSelect(entry.id)}
                    className={`grid cursor-pointer grid-cols-[1fr_100px_120px_80px] items-center gap-2 border-b border-white/[0.02] px-6 py-3 transition-colors ${
                      isSelected ? "bg-emerald-500/[0.04] border-l-2 border-l-emerald-500" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Worker */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-medium text-zinc-400">
                        {getInitials(entry.worker_name)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-zinc-200">{entry.worker_name}</p>
                        <p className="text-[10px] text-zinc-600">{entry.scheduled_start} – {entry.scheduled_end}</p>
                      </div>
                    </div>

                    {/* Date */}
                    <span className="text-[11px] text-zinc-500">{entry.date.slice(5)}</span>

                    {/* Variance */}
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} className={exc.color} />
                      <span className={`text-[11px] font-medium ${exc.color}`}>
                        {formatVariance(entry.variance_minutes, entry.exception_type)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-amber-400">Pending</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Resolution Pane */}
        <div className="w-[40%]">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="flex h-full flex-col"
              >
                {/* Header */}
                <div className="border-b border-white/[0.03] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-zinc-300">
                      {getInitials(selected.worker_name)}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-medium text-zinc-200">{selected.worker_name}</h3>
                      <p className="text-[11px] text-zinc-600">
                        {selected.date} · {selected.actual_start} – {selected.actual_end}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4 px-6 py-4">
                  {/* Exception type badge */}
                  <div className="flex items-center gap-2">
                    {(() => { const cfg = EXCEPTION_CONFIG[selected.exception_type] ?? EXCEPTION_CONFIG.overtime; const EIcon = cfg.icon; return <EIcon size={13} className={cfg.color} />; })()}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      selected.exception_type === "overtime" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                      selected.exception_type === "geofence_breach" || selected.exception_type === "missed_clock_out"
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                    }`}>
                      {(EXCEPTION_CONFIG[selected.exception_type] ?? EXCEPTION_CONFIG.overtime).label}
                    </span>
                  </div>

                  {/* Time breakdown */}
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <p className="mb-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Shift Details</p>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Scheduled</span>
                        <span className="text-zinc-400">{selected.scheduled_start} – {selected.scheduled_end}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Actual</span>
                        <span className="text-zinc-300 font-medium">{selected.actual_start} – {selected.actual_end}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Total</span>
                        <span className="font-medium text-emerald-400">{selected.total_hours}h</span>
                      </div>
                    </div>
                  </div>

                  {/* GPS indicator */}
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    <MapPin size={12} className={selected.exception_type === "geofence_breach" ? "text-rose-400" : "text-emerald-400"} />
                    <span className="text-[10px] text-zinc-500">
                      {selected.exception_type === "geofence_breach"
                        ? "Geofence Override — clocked in outside geofence"
                        : selected.clock_in_location
                          ? `GPS Verified: ${selected.clock_in_location}`
                          : "No GPS data available"}
                    </span>
                  </div>

                  {/* Notes */}
                  {selected.notes && (
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                      <p className="mb-1.5 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Shift Notes</p>
                      <p className="text-[11px] leading-relaxed text-zinc-400">{selected.notes}</p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="border-t border-white/[0.03] px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(selected.id)}
                      disabled={actionLoading === selected.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionLoading === selected.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Approve Overtime
                    </button>
                    <button
                      onClick={() => onTruncate(selected.id)}
                      disabled={actionLoading === selected.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      {actionLoading === selected.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Clock size={12} />
                      )}
                      Truncate to Schedule
                    </button>
                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06]">
                      <ChevronRight size={12} /> Message
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <Clock size={28} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                <p className="text-[12px] text-zinc-600">Select an entry to review</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2 — GRID VIEW
   ═══════════════════════════════════════════════════════════════════ */

function GridViewTab({
  workers, days, grid, weekStart, selectAll, onToggleSelectAll, loading,
}: {
  workers: string[];
  days: string[];
  grid: Record<string, GridCell[]>;
  weekStart: Date;
  selectAll: boolean;
  onToggleSelectAll: () => void;
  loading: boolean;
}) {
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    workers.forEach((w) => {
      const cells = grid[w] ?? [];
      result[w] = cells.reduce((s, c) => s + (c.hours ?? 0), 0);
    });
    return result;
  }, [workers, grid]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `Week of ${weekStart.toLocaleDateString("en-AU", { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-AU", { day: "numeric" })}, ${weekStart.getFullYear()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
        <span className="ml-2 text-[12px] text-zinc-600">Loading grid…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Period label */}
      <div className="flex items-center justify-between border-b border-white/[0.03] px-6 py-3">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-zinc-600" />
          <span className="text-[12px] font-medium text-zinc-300">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={12} className="text-zinc-600" />
          <span className="text-[11px] text-zinc-500">{workers.length} workers</span>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
          <p className="text-[13px] font-medium text-zinc-500">No time entries this week</p>
          <p className="mt-1 text-[11px] text-zinc-700">Time entries will appear here when workers clock in.</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              {/* Header */}
              <thead>
                <tr className="border-b border-white/[0.03] bg-[var(--surface-1)]">
                  <th className="w-48 px-6 py-2 text-left font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Worker</th>
                  {days.map((d) => (
                    <th key={d} className="px-3 py-2 text-center font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{d}</th>
                  ))}
                  <th className="px-4 py-2 text-right font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Total</th>
                </tr>
              </thead>

              <tbody>
                {workers.map((worker, wi) => (
                  <motion.tr
                    key={worker}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: wi * 0.04, duration: 0.3 }}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Worker name */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-medium text-zinc-400">
                          {getInitials(worker)}
                        </div>
                        <span className="text-[12px] font-medium text-zinc-300">{worker}</span>
                      </div>
                    </td>

                    {/* Day cells */}
                    {(grid[worker] ?? []).map((cell, di) => (
                      <td key={di} className="px-3 py-3 text-center">
                        {cell.status === "none" ? (
                          <span className="text-[11px] text-zinc-700">—</span>
                        ) : cell.status === "missing" ? (
                          <span className="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                            Missing
                          </span>
                        ) : (
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                            cell.status === "approved"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                          }`}>
                            {cell.hours?.toFixed(1)}h
                          </span>
                        )}
                      </td>
                    ))}

                    {/* Total */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-[12px] font-semibold text-zinc-200">{totals[worker]?.toFixed(1)}h</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.03] px-6 py-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={onToggleSelectAll}
                className="h-3.5 w-3.5 rounded border-white/[0.1] bg-white/[0.03] accent-emerald-500"
              />
              <span className="text-[11px] text-zinc-500">Select All Workers</span>
            </label>
            <button className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500">
              Bulk Approve
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3 — EXPORT
   ═══════════════════════════════════════════════════════════════════ */

function ExportTab({
  exports: exportRecords, platform, onPlatformChange, loading,
}: {
  exports: ExportRecord[];
  platform: string;
  onPlatformChange: (p: string) => void;
  loading: boolean;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
  }, []);

  return (
    <div className="space-y-6 px-6 py-5">
      {/* Run Payroll Export */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <FileSpreadsheet size={15} className="text-emerald-400" />
          <h2 className="text-[14px] font-medium text-zinc-200">Run Payroll Export</h2>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Period */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              Period Ending
            </label>
            <input
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="h-9 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-[12px] text-zinc-300 outline-none transition-colors focus:border-emerald-500/30"
            />
          </div>

          {/* Platform */}
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              Target Platform
            </label>
            <select
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value)}
              className="h-9 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 pr-8 text-[12px] text-zinc-300 outline-none transition-colors focus:border-emerald-500/30"
            >
              <option value="xero">Xero</option>
              <option value="myob">MYOB</option>
              <option value="keypay">KeyPay</option>
              <option value="csv">CSV Download</option>
            </select>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download size={13} />
                Export Payroll
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export History */}
      <div>
        <h2 className="mb-3 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Export History</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-emerald-500" />
            <span className="ml-2 text-[12px] text-zinc-600">Loading exports…</span>
          </div>
        ) : exportRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet size={32} strokeWidth={0.8} className="mb-3 text-zinc-800" />
            <p className="text-[13px] font-medium text-zinc-500">No exports yet</p>
            <p className="mt-1 text-[11px] text-zinc-700">Run your first payroll export above.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[120px_160px_80px_60px_80px_90px_80px] gap-2 border-b border-white/[0.03] bg-[var(--surface-1)] px-6 py-2">
              {["Export Date", "Period", "Platform", "Workers", "Hours", "Status", "Actions"].map((h) => (
                <span key={h} className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {exportRecords.map((exp, i) => {
              const sc = EXPORT_STATUS_CONFIG[exp.status] ?? EXPORT_STATUS_CONFIG.processing;
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="grid grid-cols-[120px_160px_80px_60px_80px_90px_80px] items-center gap-2 border-b border-white/[0.02] px-6 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[11px] text-zinc-400">{exp.export_date}</span>
                  <span className="text-[11px] text-zinc-300">{exp.period}</span>
                  <span className="text-[11px] text-zinc-400">{exp.platform}</span>
                  <span className="text-[11px] text-zinc-400">{exp.workers}</span>
                  <span className="text-[11px] font-medium text-zinc-300">{exp.hours}h</span>
                  <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${sc.bg} ${sc.text} ${
                    exp.status === "success" ? "border-emerald-500/20" : exp.status === "failed" ? "border-rose-500/20" : "border-amber-500/20"
                  }`}>
                    {sc.label}
                  </span>
                  <button className="text-[10px] text-zinc-600 transition-colors hover:text-zinc-300">
                    <Download size={12} />
                  </button>
                </motion.div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
