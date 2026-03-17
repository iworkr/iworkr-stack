/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useTransition } from "react";
import {
  Search, ChevronRight, Filter, Plus, Clock, MapPin,
  Loader2, AlertTriangle, CheckCircle2, X,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchTimesheetTriageAction,
  getTimesheetTelemetryAction,
  resolveExceptionAction,
  bulkResolveTimeEntriesAction,
  createManualTimeEntryAction,
  type TriageRow,
} from "@/app/actions/timesheets";
import { PayrollEngineBreakdown } from "@/components/timesheets/payroll-engine-breakdown";

/* ═══════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════ */

type PillTab = "triage" | "all" | "export_ready";

const PILL_TABS: { id: PillTab; label: string }[] = [
  { id: "triage", label: "Triage" },
  { id: "all", label: "All Timesheets" },
  { id: "export_ready", label: "Export Ready" },
];

interface Telemetry {
  pending_review: number;
  auto_approved: number;
  total_exceptions: number;
  hours_this_period: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatShiftDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
}

function formatVarianceHours(minutes: number): string {
  const h = Math.abs(minutes) / 60;
  const sign = minutes >= 0 ? "+" : "−";
  return `${sign}${h.toFixed(1)}h`;
}

function isException(varianceMinutes: number): boolean {
  return Math.abs(varianceMinutes) > 15;
}

function deriveDisplayStatus(row: TriageRow): "auto_approved" | "exception" | "manually_approved" | "draft" {
  if (row.exception_type && !row.exception_resolved) return "exception";
  if (row.exception_resolved && row.status === "manually_approved") return "manually_approved";
  if (row.status === "auto_approved" || row.status === "manually_approved") return "auto_approved";
  if (row.status === "exception") return "exception";
  return "draft";
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════ */

function GhostBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    auto_approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    exception: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    manually_approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    export_ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  const labels: Record<string, string> = {
    auto_approved: "AUTO-APPROVED",
    exception: "EXCEPTION",
    manually_approved: "MANUALLY APPROVED",
    draft: "DRAFT",
    export_ready: "EXPORT READY",
  };
  const cls = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  );
}

function MetricNode({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {alert && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
        )}
        <span
          className={`font-mono text-[20px] leading-none ${alert ? "text-amber-500 font-bold" : "text-white"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 h-16 animate-pulse">
      <td className="px-8 py-3"><div className="h-4 w-4 rounded bg-white/5" /></td>
      <td className="py-3"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-white/5" /><div className="space-y-1.5"><div className="h-3 w-28 rounded bg-white/5" /><div className="h-2 w-20 rounded bg-white/5" /></div></div></td>
      <td className="py-3"><div className="space-y-1.5"><div className="h-3 w-24 rounded bg-white/5" /><div className="h-2 w-20 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="space-y-1.5"><div className="h-3 w-20 rounded bg-white/5" /><div className="h-2 w-16 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-3 w-12 rounded bg-white/5" /></td>
      <td className="py-3"><div className="h-5 w-24 rounded-full bg-white/5" /></td>
      <td className="py-3 pr-8"><div className="h-4 w-4 rounded bg-white/5" /></td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-white/10">
        <Clock size={28} strokeWidth={0.8} className="text-zinc-700" />
      </div>
      <p className="text-[13px] font-medium text-zinc-400">No timesheet entries found</p>
      <p className="mt-1 max-w-xs text-[11px] text-zinc-600">
        Time entries will appear here when workers clock in to their shifts.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over: Exception Review
   ═══════════════════════════════════════════════════════════════════ */

function ExceptionReviewSlideOver({
  entry,
  onClose,
  onApprove,
  onReject,
  loading,
  orgId,
}: {
  entry: TriageRow;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
  orgId: string;
}) {
  const schedStart = formatTime(entry.scheduled_start);
  const schedEnd = formatTime(entry.scheduled_end);
  const actualStart = formatTime(entry.clock_in);
  const actualEnd = formatTime(entry.clock_out);
  const variance = entry.variance_minutes;
  const isExc = isException(variance);

  // GPS data
  const hasGps = entry.clock_in_location && typeof entry.clock_in_location === "object";
  const gpsLat = hasGps ? (entry.clock_in_location as any).lat : null;
  const gpsLng = hasGps ? (entry.clock_in_location as any).lng : null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: 500 }}
        animate={{ x: 0 }}
        exit={{ x: 500 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[500px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-zinc-300">
              {getInitials(entry.worker_name)}
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-zinc-200">{entry.worker_name}</h3>
              <p className="text-[11px] text-zinc-500">{formatShiftDate(entry.shift_date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* GPS Map placeholder */}
          {hasGps && (
            <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Clock-In Location</p>
              <div className="flex items-center gap-2 rounded-md bg-zinc-800/50 px-3 py-2">
                <MapPin size={14} className={entry.is_geofence_override ? "text-rose-400" : "text-emerald-400"} />
                <span className="font-mono text-[12px] text-zinc-300">
                  {gpsLat?.toFixed(5)}, {gpsLng?.toFixed(5)}
                </span>
                {entry.is_geofence_override && (
                  <span className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20">
                    GEOFENCE OVERRIDE
                  </span>
                )}
              </div>
              {entry.geofence_override_reason && (
                <p className="mt-2 text-[11px] italic text-zinc-500">{entry.geofence_override_reason}</p>
              )}
            </div>
          )}

          {/* Variance Breakdown */}
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Variance Breakdown</p>
            <div className="space-y-3">
              {/* Timeline visual */}
              <div className="relative h-12 rounded-md bg-zinc-800/50 overflow-hidden">
                {/* Scheduled block */}
                <div className="absolute inset-y-0 left-[10%] right-[10%] flex items-center">
                  <div className="h-6 w-full rounded bg-zinc-700/50 border border-white/5" />
                </div>
                {/* Actual overrun */}
                {isExc && variance > 0 && (
                  <div className="absolute inset-y-0 right-[2%] flex items-center" style={{ width: `${Math.min(variance / 5, 8)}%` }}>
                    <div className="h-6 w-full rounded-r bg-amber-500/20 border border-amber-500/30" />
                  </div>
                )}
                {/* Labels */}
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="font-mono text-[10px] text-zinc-500">Scheduled</span>
                  {isExc && (
                    <span className="font-mono text-[10px] text-amber-400">
                      {formatVarianceHours(variance)} variance
                    </span>
                  )}
                </div>
              </div>

              {/* Data rows */}
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Scheduled</span>
                  <span className="font-mono text-[12px] text-zinc-300">{schedStart} — {schedEnd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Actual</span>
                  <span className="font-mono text-[12px] text-white font-medium">{actualStart} — {actualEnd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Logged</span>
                  <span className="font-mono text-[12px] text-white font-medium">
                    {entry.total_hours != null ? `${entry.total_hours.toFixed(1)}h` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Scheduled Duration</span>
                  <span className="font-mono text-[12px] text-zinc-400">
                    {entry.scheduled_hours != null ? `${entry.scheduled_hours.toFixed(1)}h` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-zinc-500 font-medium">Variance</span>
                  <span className={`font-mono text-[14px] font-bold ${isExc ? "text-amber-500" : "text-zinc-600"}`}>
                    {formatVarianceHours(entry.variance_minutes)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Exception Type */}
          {entry.exception_type && (
            <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Exception Type</p>
              <GhostBadge status="exception" />
              <span className="ml-2 text-[12px] text-zinc-300">
                {entry.exception_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
          )}

          {/* Worker Notes */}
          {entry.notes && (
            <div className="border-l-2 border-zinc-700 pl-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worker Note</p>
              <p className="text-[14px] italic leading-relaxed text-zinc-300">
                &ldquo;{entry.notes}&rdquo;
              </p>
            </div>
          )}

          {/* SCHADS Payroll Engine Breakdown */}
          {entry.timesheet_id ? (
            <PayrollEngineBreakdown
              timesheetId={entry.timesheet_id}
              orgId={orgId}
              workerName={entry.worker_name}
              periodLabel={entry.shift_date}
            />
          ) : (
            <div className="mt-6 border-t border-white/5 pt-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Payroll Engine Breakdown</p>
              <p className="text-[11px] text-zinc-700 italic">No timesheet linked to this time entry — payroll cannot be run.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 bg-[#050505] p-6 flex gap-3">
          <button
            onClick={() => onReject(entry.id)}
            disabled={loading}
            className="flex w-1/2 items-center justify-center gap-2 rounded-md border border-rose-500/20 bg-transparent px-4 py-2.5 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Reject Overtime
          </button>
          <button
            onClick={() => onApprove(entry.id)}
            disabled={loading}
            className="flex w-1/2 items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Approve Override
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Log Time Slide-Over
   ═══════════════════════════════════════════════════════════════════ */

function LogTimeSlideOver({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [workerId, setWorkerId] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = workerId && clockIn && clockOut;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await createManualTimeEntryAction({
        organization_id: orgId,
        worker_id: workerId,
        clock_in: clockIn,
        clock_out: clockOut,
        notes: notes || undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to log time entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[440px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <h3 className="text-[16px] font-medium text-white">Log Manual Time Entry</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worker ID</label>
            <input value={workerId} onChange={(e) => setWorkerId(e.target.value)} placeholder="Worker UUID" className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Clock In</label>
            <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Clock Out</label>
            <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Notes (Optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason for manual entry..." className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none" />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
        <div className="border-t border-white/5 bg-[#050505] p-6">
          <button onClick={handleSave} disabled={!canSave || saving} className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
            {saving ? "Saving..." : "Log Time Entry"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function TimesheetsPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [activeTab, setActiveTab] = useState<PillTab>("triage");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    pending_review: 0,
    auto_approved: 0,
    total_exceptions: 0,
    hours_this_period: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slideOverEntry, setSlideOverEntry] = useState<TriageRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [, startTransition] = useTransition();

  // ── Load data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [triageData, telemetryData] = await Promise.all([
        fetchTimesheetTriageAction(orgId, { tab: activeTab }),
        getTimesheetTelemetryAction(orgId),
      ]);
      setRows(triageData);
      setTelemetry(telemetryData);
    } catch (e: any) {
      console.error("[timesheets] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId, activeTab]);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId, loadData]);

  // ── Filtered rows ─────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.worker_name.toLowerCase().includes(q) ||
        r.worker_id.toLowerCase().includes(q) ||
        (r.exception_type && r.exception_type.toLowerCase().includes(q))
    );
  }, [rows, search]);

  // ── Selection ─────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  }, [selectedIds.size, filteredRows]);

  // ── Actions ───────────────────────────────────────
  const handleApprove = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        await resolveExceptionAction(id, "approve", "Approved via triage");
        startTransition(() => {
          setRows((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, status: "manually_approved", exception_resolved: true } : r
            )
          );
          setSlideOverEntry(null);
          setTelemetry((t) => ({
            ...t,
            pending_review: Math.max(0, t.pending_review - 1),
            total_exceptions: Math.max(0, t.total_exceptions - 1),
          }));
        });
        // Re-fetch from DB to ensure UI/DB parity
        loadData();
      } catch (e: any) {
        console.error("[timesheets] approve failed:", e);
      } finally {
        setActionLoading(false);
      }
    },
    [startTransition, loadData]
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActionLoading(true);
      try {
        await resolveExceptionAction(id, "dispute", "Rejected via triage");
        startTransition(() => {
          setRows((prev) => prev.filter((r) => r.id !== id));
          setSlideOverEntry(null);
          setTelemetry((t) => ({
            ...t,
            pending_review: Math.max(0, t.pending_review - 1),
            total_exceptions: Math.max(0, t.total_exceptions - 1),
          }));
        });
        // Re-fetch from DB to ensure UI/DB parity
        loadData();
      } catch (e: any) {
        console.error("[timesheets] reject failed:", e);
      } finally {
        setActionLoading(false);
      }
    },
    [startTransition, loadData]
  );

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await bulkResolveTimeEntriesAction(Array.from(selectedIds), "approve");
      startTransition(() => {
        setRows((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id) ? { ...r, status: "manually_approved", exception_resolved: true } : r
          )
        );
        setTelemetry((t) => ({
          ...t,
          pending_review: Math.max(0, t.pending_review - selectedIds.size),
          total_exceptions: Math.max(0, t.total_exceptions - selectedIds.size),
        }));
        setSelectedIds(new Set());
      });
      loadData();
    } catch (e: any) {
      console.error("[timesheets] bulk approve failed:", e);
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, startTransition, loadData]);

  const handleBulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await bulkResolveTimeEntriesAction(Array.from(selectedIds), "reject");
      startTransition(() => {
        setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        setTelemetry((t) => ({
          ...t,
          pending_review: Math.max(0, t.pending_review - selectedIds.size),
          total_exceptions: Math.max(0, t.total_exceptions - selectedIds.size),
        }));
        setSelectedIds(new Set());
      });
      loadData();
    } catch (e: any) {
      console.error("[timesheets] bulk reject failed:", e);
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, startTransition, loadData]);

  // ── Loading ───────────────────────────────────────
  if (orgLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#050505]">
      {/* ═══ COMMAND HEADER (h-14) ═══ */}
      <div className="flex h-14 items-center justify-between border-b border-white/5 bg-[#050505] px-8">
        {/* Left Cluster */}
        <div className="flex items-center">
          {/* Breadcrumb */}
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            WORKFORCE
          </span>

          {/* Divider */}
          <div className="mx-4 h-4 w-px bg-white/10" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-zinc-900/50 p-1">
            {PILL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedIds(new Set());
                }}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white font-medium shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Cluster */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex h-8 w-64 items-center rounded-md border border-white/5 bg-zinc-900 px-3">
            <Search className="h-3 w-3 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search worker name, ID..."
              className="ml-2 w-full bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
            />
          </div>

          {/* Filter */}
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/5 bg-transparent px-3 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
            <Filter className="h-3 w-3" />
            Filters
          </button>

          {/* Log Time CTA */}
          <button onClick={() => setShowLogTime(true)} className="ml-3 flex h-8 items-center gap-1.5 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200">
            <Plus className="h-3 w-3" />
            Log Time
          </button>
        </div>
      </div>

      {/* ═══ TELEMETRY RIBBON (h-16) ═══ */}
      <div className="flex h-16 w-full items-center overflow-x-auto border-b border-white/5 bg-zinc-950/30 px-8">
        <MetricNode label="PENDING REVIEW" value={telemetry.pending_review} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode label="AUTO-APPROVED" value={telemetry.auto_approved} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="TOTAL EXCEPTIONS"
          value={telemetry.total_exceptions}
          alert={telemetry.total_exceptions > 0}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="HOURS THIS PERIOD"
          value={`${telemetry.hours_this_period.toLocaleString()}h`}
        />
      </div>

      {/* ═══ FLOATING ACTION BAR (Bulk) ═══ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="sticky top-0 z-40 mx-8 mt-3 flex h-14 items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-6 shadow-2xl"
          >
            <span className="text-[13px] font-medium text-emerald-400">
              {selectedIds.size} timesheet{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkReject}
                disabled={actionLoading}
                className="rounded-md px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                Reject Selected
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={actionLoading}
                className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Approve Selected"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DATA GRID ═══ */}
      <div className="flex-1 overflow-y-auto px-8 mt-4">
        <table className="w-full text-left border-collapse">
          {/* Header */}
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="w-[5%] pl-0 pr-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-white/10 bg-white/[0.03] accent-emerald-500 cursor-pointer"
                />
              </th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">WORKER</th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">SHIFT CLOCK</th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">SCHED vs ACTUAL</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">VARIANCE</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">STATUS</th>
              <th className="w-[5%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">ACTION</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              filteredRows.map((row, i) => {
                const displayStatus = deriveDisplayStatus(row);
                const varianceExc = isException(row.variance_minutes);
                const isChecked = selectedIds.has(row.id);

                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.25 }}
                    onClick={() => setSlideOverEntry(row)}
                    className={`group cursor-pointer border-b border-white/5 transition-colors h-16 ${
                      isChecked ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="pl-0 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(row.id)}
                        className="h-3.5 w-3.5 rounded border-white/10 bg-white/[0.03] accent-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* WORKER */}
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {row.worker_avatar ? (
                          <img
                            src={row.worker_avatar}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                            {getInitials(row.worker_name)}
                          </div>
                        )}
                        <span className="text-[14px] font-medium text-zinc-100">
                          {row.worker_name}
                        </span>
                      </div>
                    </td>

                    {/* SHIFT CLOCK */}
                    <td className="py-3">
                      <div>
                        <p className="font-mono text-[12px] text-white">
                          {formatShiftDate(row.shift_date)}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {formatTime(row.clock_in)} — {formatTime(row.clock_out)}
                        </p>
                      </div>
                    </td>

                    {/* SCHED vs ACTUAL */}
                    <td className="py-3">
                      <div>
                        <p className="text-[12px] text-white">
                          {row.total_hours != null ? `${row.total_hours.toFixed(1)}h logged` : "—"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {row.scheduled_hours != null ? `${row.scheduled_hours.toFixed(1)}h sched` : "No schedule"}
                        </p>
                      </div>
                    </td>

                    {/* VARIANCE */}
                    <td className="py-3">
                      <span
                        className={`font-mono text-[14px] ${
                          varianceExc ? "text-amber-500" : "text-zinc-600"
                        }`}
                      >
                        {formatVarianceHours(row.variance_minutes)}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="py-3">
                      <GhostBadge status={displayStatus} />
                    </td>

                    {/* ACTION */}
                    <td className="py-3 pr-0">
                      <ChevronRight className="h-4 w-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ EXCEPTION REVIEW SLIDE-OVER ═══ */}
      <AnimatePresence>
        {slideOverEntry && (
          <ExceptionReviewSlideOver
            entry={slideOverEntry}
            onClose={() => setSlideOverEntry(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={actionLoading}
            orgId={orgId!}
          />
        )}
      </AnimatePresence>

      {/* ═══ LOG TIME SLIDE-OVER ═══ */}
      <AnimatePresence>
        {showLogTime && orgId && (
          <LogTimeSlideOver orgId={orgId} onClose={() => setShowLogTime(false)} onSaved={loadData} />
        )}
      </AnimatePresence>
    </div>
  );
}
