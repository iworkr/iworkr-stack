/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import {
  Search, Clock, AlertTriangle, Check, ChevronRight, MapPin,
  ArrowUpRight, ArrowDownRight, Timer, Users, Calendar, Download,
  CheckCircle2, XCircle, Loader2, BarChart3, FileSpreadsheet,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Types & Mock Data
   ═══════════════════════════════════════════════════════════════════ */

type ExceptionType = "overtime" | "late_start" | "early_finish" | "missed_clock_out" | "geofence_breach";
type AnomalyStatus = "pending" | "approved" | "truncated" | "dismissed";
type ExportStatus = "success" | "processing" | "failed";
type TSTab = "triage" | "grid" | "export";

interface TimeEntry {
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

const MOCK_ENTRIES: TimeEntry[] = [
  { id: "ts-001", worker_name: "Sarah Chen",      date: "2026-03-09", scheduled_start: "07:00", scheduled_end: "15:00", actual_start: "06:55", actual_end: "16:30", variance_minutes: 90,  exception_type: "overtime",         status: "pending",  total_hours: 9.5,  clock_in_location: "-27.4705, 153.0260", notes: "Client requested extended session — additional wound care needed." },
  { id: "ts-002", worker_name: "James Mitchell",  date: "2026-03-09", scheduled_start: "08:00", scheduled_end: "16:00", actual_start: "08:42", actual_end: "16:00", variance_minutes: 42,  exception_type: "late_start",       status: "pending",  total_hours: 7.3,  clock_in_location: "-27.4698, 153.0285", notes: "Traffic accident on M1 — called ahead." },
  { id: "ts-003", worker_name: "Priya Sharma",    date: "2026-03-10", scheduled_start: "07:00", scheduled_end: "15:00", actual_start: "07:02", actual_end: "16:45", variance_minutes: 105, exception_type: "overtime",         status: "pending",  total_hours: 9.7,  clock_in_location: "-27.4712, 153.0243", notes: "Double shift — covering for absent colleague." },
  { id: "ts-004", worker_name: "Tom O'Brien",     date: "2026-03-10", scheduled_start: "09:00", scheduled_end: "17:00", actual_start: "09:00", actual_end: "14:30", variance_minutes: -150, exception_type: "early_finish",     status: "pending",  total_hours: 5.5,  clock_in_location: "-27.4690, 153.0271", notes: "Client cancelled afternoon appointment." },
  { id: "ts-005", worker_name: "Aisha Mohamed",   date: "2026-03-11", scheduled_start: "06:00", scheduled_end: "14:00", actual_start: "06:00", actual_end: "—",     variance_minutes: 0,   exception_type: "missed_clock_out", status: "pending",  total_hours: 8.0,  clock_in_location: "-27.4718, 153.0255", notes: "App crashed — worker reported manual sign-off." },
  { id: "ts-006", worker_name: "Liam Walsh",      date: "2026-03-11", scheduled_start: "07:00", scheduled_end: "15:00", actual_start: "07:00", actual_end: "16:00", variance_minutes: 60,  exception_type: "overtime",         status: "pending",  total_hours: 9.0,  clock_in_location: "-27.4685, 153.0298", notes: "Emergency callout after scheduled shift." },
  { id: "ts-007", worker_name: "Sarah Chen",      date: "2026-03-12", scheduled_start: "07:00", scheduled_end: "15:00", actual_start: "07:35", actual_end: "15:00", variance_minutes: 35,  exception_type: "late_start",       status: "pending",  total_hours: 7.4,  clock_in_location: "-27.4708, 153.0265", notes: "Bus delay — notified supervisor." },
  { id: "ts-008", worker_name: "James Mitchell",  date: "2026-03-13", scheduled_start: "08:00", scheduled_end: "16:00", actual_start: "08:00", actual_end: "16:00", variance_minutes: 0,   exception_type: "geofence_breach",  status: "pending",  total_hours: 8.0,  clock_in_location: "-27.5102, 153.0410", notes: "Clocked in 2.1 km from job site — was at satellite office." },
];

const WORKERS = ["Sarah Chen", "James Mitchell", "Priya Sharma", "Tom O'Brien", "Aisha Mohamed", "Liam Walsh"];
const DAYS = ["Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14", "Sun 15"];

const MOCK_GRID: Record<string, GridCell[]> = {
  "Sarah Chen":      [{ hours: 9.5, status: "review" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 7.4, status: "review" }, { hours: 8.0, status: "approved" }, { hours: null, status: "none" }, { hours: null, status: "none" }],
  "James Mitchell":  [{ hours: 7.3, status: "review" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "review" }, { hours: 4.0, status: "approved" }, { hours: null, status: "none" }],
  "Priya Sharma":    [{ hours: 8.0, status: "approved" }, { hours: 9.7, status: "review" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: null, status: "none" }, { hours: null, status: "none" }],
  "Tom O'Brien":     [{ hours: 8.0, status: "approved" }, { hours: 5.5, status: "review" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: null, status: "none" }, { hours: null, status: "none" }],
  "Aisha Mohamed":   [{ hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: null, status: "missing" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: null, status: "none" }, { hours: null, status: "none" }],
  "Liam Walsh":      [{ hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 9.0, status: "review" }, { hours: 8.0, status: "approved" }, { hours: 8.0, status: "approved" }, { hours: 5.0, status: "approved" }, { hours: null, status: "none" }],
};

const MOCK_EXPORTS: ExportRecord[] = [
  { id: "exp-001", export_date: "2026-03-07", period: "Mar 2–8, 2026",   platform: "Xero",  workers: 6, hours: 234.5, status: "success" },
  { id: "exp-002", export_date: "2026-02-28", period: "Feb 23–Mar 1, 2026", platform: "Xero", workers: 6, hours: 241.0, status: "success" },
  { id: "exp-003", export_date: "2026-02-21", period: "Feb 16–22, 2026", platform: "CSV",   workers: 5, hours: 198.0, status: "success" },
  { id: "exp-004", export_date: "2026-02-14", period: "Feb 9–15, 2026",  platform: "MYOB",  workers: 6, hours: 229.5, status: "failed" },
];

const EXPORT_STATUS_CONFIG: Record<ExportStatus, { label: string; bg: string; text: string }> = {
  success:    { label: "Complete",    bg: "bg-emerald-500/10", text: "text-emerald-400" },
  processing: { label: "Processing",  bg: "bg-amber-500/10",   text: "text-amber-400" },
  failed:     { label: "Failed",      bg: "bg-rose-500/10",    text: "text-rose-400" },
};

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function TimesheetsPage() {
  const [activeTab, setActiveTab] = useState<TSTab>("triage");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_ENTRIES[0]?.id ?? null);
  const [entries, setEntries] = useState<TimeEntry[]>(MOCK_ENTRIES);
  const [gridSelectAll, setGridSelectAll] = useState(false);
  const [exportPlatform, setExportPlatform] = useState("xero");

  /* ── Triage stats ─────────────────────────────────── */
  const stats = useMemo(() => {
    const pending = entries.filter((e) => e.status === "pending").length;
    const approved = entries.filter((e) => e.status === "approved").length;
    const total = entries.length;
    const hours = entries.reduce((s, e) => s + e.total_hours, 0);
    return { pending, approved, total, hours };
  }, [entries]);

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
  const handleApprove = useCallback((id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "approved" as AnomalyStatus } : e)));
    setSelectedId(null);
  }, []);

  const handleTruncate = useCallback((id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "truncated" as AnomalyStatus } : e)));
    setSelectedId(null);
  }, []);

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
              />
            </motion.div>
          )}
          {activeTab === "grid" && (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <GridViewTab selectAll={gridSelectAll} onToggleSelectAll={() => setGridSelectAll((p) => !p)} />
            </motion.div>
          )}
          {activeTab === "export" && (
            <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ExportTab platform={exportPlatform} onPlatformChange={setExportPlatform} />
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
  entries, selected, stats, onSelect, onApprove, onTruncate,
}: {
  entries: TimeEntry[];
  selected: TimeEntry | null;
  stats: { pending: number; approved: number; total: number; hours: number };
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onTruncate: (id: string) => void;
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
                const exc = EXCEPTION_CONFIG[entry.exception_type];
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
                    {(() => { const cfg = EXCEPTION_CONFIG[selected.exception_type]; const EIcon = cfg.icon; return <EIcon size={13} className={cfg.color} />; })()}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      selected.exception_type === "overtime" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                      selected.exception_type === "geofence_breach" || selected.exception_type === "missed_clock_out"
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                    }`}>
                      {EXCEPTION_CONFIG[selected.exception_type].label}
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
                        ? "Geofence Override — clocked in 2.1 km from site"
                        : `GPS Verified: ${selected.clock_in_location}`}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <p className="mb-1.5 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Shift Notes</p>
                    <p className="text-[11px] leading-relaxed text-zinc-400">{selected.notes}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="border-t border-white/[0.03] px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(selected.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500"
                    >
                      <Check size={12} /> Approve Overtime
                    </button>
                    <button
                      onClick={() => onTruncate(selected.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
                    >
                      <Clock size={12} /> Truncate to Schedule
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

function GridViewTab({ selectAll, onToggleSelectAll }: { selectAll: boolean; onToggleSelectAll: () => void }) {
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    WORKERS.forEach((w) => {
      const cells = MOCK_GRID[w] ?? [];
      result[w] = cells.reduce((s, c) => s + (c.hours ?? 0), 0);
    });
    return result;
  }, []);

  return (
    <div className="flex flex-col">
      {/* Period label */}
      <div className="flex items-center justify-between border-b border-white/[0.03] px-6 py-3">
        <div className="flex items-center gap-2">
          <Calendar size={13} className="text-zinc-600" />
          <span className="text-[12px] font-medium text-zinc-300">Week of March 9 – 15, 2026</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={12} className="text-zinc-600" />
          <span className="text-[11px] text-zinc-500">{WORKERS.length} workers</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          {/* Header */}
          <thead>
            <tr className="border-b border-white/[0.03] bg-[var(--surface-1)]">
              <th className="w-48 px-6 py-2 text-left font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Worker</th>
              {DAYS.map((d) => (
                <th key={d} className="px-3 py-2 text-center font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{d}</th>
              ))}
              <th className="px-4 py-2 text-right font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Total</th>
            </tr>
          </thead>

          <tbody>
            {WORKERS.map((worker, wi) => (
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
                {(MOCK_GRID[worker] ?? []).map((cell, di) => (
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3 — EXPORT
   ═══════════════════════════════════════════════════════════════════ */

function ExportTab({ platform, onPlatformChange }: { platform: string; onPlatformChange: (p: string) => void }) {
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
              defaultValue="2026-03-15"
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

        {/* Table header */}
        <div className="grid grid-cols-[120px_160px_80px_60px_80px_90px_80px] gap-2 border-b border-white/[0.03] bg-[var(--surface-1)] px-6 py-2">
          {["Export Date", "Period", "Platform", "Workers", "Hours", "Status", "Actions"].map((h) => (
            <span key={h} className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {MOCK_EXPORTS.map((exp, i) => {
          const sc = EXPORT_STATUS_CONFIG[exp.status];
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
      </div>
    </div>
  );
}
