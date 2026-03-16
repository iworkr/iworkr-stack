/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect, useTransition } from "react";
import {
  Search, ChevronRight, Plus, AlertTriangle, X,
  Loader2, Calendar, Clock,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getLeaveTriageDataAction,
  getLeaveTelemetryAction,
  getOrphanedShiftsForLeaveAction,
  listLeaveWorkersAction,
  createLeaveRequestAction,
  reportEmergencySickAction,
  reviewLeaveRequestAction,
  calculateLeaveImpactAction,
} from "@/app/actions/team-leave";

/* ═══════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════ */

type PillTab = "triage" | "approved" | "history";
type LeaveType = "annual" | "sick" | "rdo" | "unpaid" | "compassionate";
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

const PILL_TABS: { id: PillTab; label: string }[] = [
  { id: "triage", label: "Triage Queue" },
  { id: "approved", label: "Approved & Active" },
  { id: "history", label: "History" },
];

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Personal / Carer's Leave" },
  { value: "rdo", label: "Rostered Day Off" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "compassionate", label: "Compassionate Leave" },
];

interface LeaveRow {
  id: string;
  organization_id: string;
  worker_id: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  start_at: string | null;
  end_at: string | null;
  days: number | null;
  emergency_reported: boolean;
  source: string;
  reason: string | null;
  manager_notes: string | null;
  created_at: string;
  worker?: { id?: string; full_name?: string | null; email?: string | null; avatar_url?: string | null };
}

interface Telemetry {
  pending_requests: number;
  impacted_shifts_7d: number;
  participants_affected: number;
  revenue_at_risk: number;
}

interface WorkerOption {
  id: string;
  name: string;
  role: string;
}

interface ImpactResult {
  impacted_shift_count: number;
  revenue_at_risk: number;
  unique_participants_affected: number;
  master_roster_impacts: number;
}

interface OrphanShift {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  participant_id: string | null;
  participant_profiles?: { preferred_name?: string | null; full_name?: string | null } | null;
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateShort(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatTime(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return iso.slice(11, 16);
  }
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1);
}

function leaveTypeLabel(t: string): string {
  const map: Record<string, string> = {
    annual: "Annual Leave",
    sick: "Sick / Carer's",
    rdo: "RDO",
    unpaid: "Unpaid Leave",
    compassionate: "Compassionate",
  };
  return map[t] || t;
}

function workerName(row: LeaveRow): string {
  return row.worker?.full_name || row.worker?.email || "Unknown Worker";
}

function workerAvatar(row: LeaveRow): string | null {
  return row.worker?.avatar_url || null;
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════ */

function GhostBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    declined: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  const labels: Record<string, string> = {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "DECLINED",
    cancelled: "CANCELLED",
    declined: "DECLINED",
  };
  const cls = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  );
}

function MetricNode({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
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
        <span className={`font-mono text-[20px] leading-none ${alert ? "text-amber-500 font-bold" : "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 h-16 animate-pulse">
      <td className="px-8 py-3"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-white/5" /><div className="space-y-1.5"><div className="h-3 w-28 rounded bg-white/5" /><div className="h-2 w-16 rounded bg-white/5" /></div></div></td>
      <td className="py-3"><div className="space-y-1.5"><div className="h-3 w-20 rounded bg-white/5" /><div className="h-2 w-32 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="space-y-1.5"><div className="h-3 w-36 rounded bg-white/5" /><div className="h-2 w-12 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-3 w-28 rounded bg-white/5" /></td>
      <td className="py-3"><div className="h-5 w-16 rounded-full bg-white/5" /></td>
      <td className="py-3 pr-8"><div className="h-4 w-4 rounded bg-white/5" /></td>
    </tr>
  );
}

function EmptyState({ tab }: { tab: PillTab }) {
  const messages: Record<PillTab, { title: string; sub: string }> = {
    triage: { title: "Triage queue is clear.", sub: "There are no pending leave requests requiring your attention." },
    approved: { title: "No active leave.", sub: "Approved and currently active leave requests will appear here." },
    history: { title: "No leave history.", sub: "Past leave requests and their resolutions will appear here." },
  };
  const m = messages[tab];
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-zinc-950/50 mx-8 mt-8">
      <Calendar size={32} strokeWidth={0.8} className="mb-4 text-emerald-500/50" />
      <p className="text-[15px] font-medium text-white">{m.title}</p>
      <p className="mt-1 text-[13px] text-zinc-500">{m.sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over A: Request Leave
   ═══════════════════════════════════════════════════════════════════ */

function RequestLeaveSlideOver({
  orgId,
  workers,
  onClose,
  onCreated,
}: {
  orgId: string;
  workers: WorkerOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [workerId, setWorkerId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Async impact calculation when dates selected
  useEffect(() => {
    if (!workerId || !startDate || !endDate) {
      setImpact(null);
      return;
    }
    setImpactLoading(true);
    calculateLeaveImpactAction({
      worker_id: workerId,
      start_at: `${startDate}T00:00:00.000Z`,
      end_at: `${endDate}T23:59:59.999Z`,
    })
      .then((res) => setImpact((res as ImpactResult) || null))
      .catch(() => setImpact(null))
      .finally(() => setImpactLoading(false));
  }, [workerId, startDate, endDate]);

  const handleSubmit = async () => {
    if (!orgId || !workerId || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      await createLeaveRequestAction({
        organization_id: orgId,
        worker_id: workerId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        is_full_day: true,
        reason: reason || undefined,
        source: "manual",
        emergency_reported: false,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      console.error("[leave] create failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/5 px-6">
          <h3 className="text-[14px] font-medium text-white">Request Leave</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worker</label>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-white/20">
              <option value="">Select worker...</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Leave Type</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-white/20">
              {LEAVE_TYPES.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-white/20" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional context or notes..." rows={3} className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-white/20 resize-none" />
          </div>

          {/* Impact Analysis Box */}
          {(impact || impactLoading) && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-500">Impact Analysis</p>
              {impactLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-amber-400" />
                  <span className="text-xs text-zinc-400">Calculating impact...</span>
                </div>
              ) : impact ? (
                <div className="space-y-1.5">
                  {impact.impacted_shift_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-[12px] font-medium text-amber-400">
                        This request will orphan {impact.impacted_shift_count} scheduled shift{impact.impacted_shift_count > 1 ? "s" : ""}.
                      </span>
                    </div>
                  )}
                  {impact.revenue_at_risk > 0 && (
                    <p className="text-[12px] text-zinc-400">
                      Total revenue at risk: <span className="font-mono font-medium text-amber-400">${impact.revenue_at_risk.toFixed(2)}</span>
                    </p>
                  )}
                  {impact.unique_participants_affected > 0 && (
                    <p className="text-[12px] text-zinc-400">
                      {impact.unique_participants_affected} participant{impact.unique_participants_affected > 1 ? "s" : ""} affected.
                    </p>
                  )}
                  {impact.impacted_shift_count === 0 && (
                    <p className="text-[12px] text-zinc-500">No shift conflicts detected.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 bg-[#050505] p-6">
          <button
            onClick={handleSubmit}
            disabled={!workerId || !startDate || !endDate || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Submit Request
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over B: Triage Review
   ═══════════════════════════════════════════════════════════════════ */

function TriageReviewSlideOver({
  entry,
  orgId,
  onClose,
  onResolved,
}: {
  entry: LeaveRow;
  orgId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [shifts, setShifts] = useState<OrphanShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setShiftsLoading(true);
    const startAt = entry.start_at || `${entry.start_date}T00:00:00.000Z`;
    const endAt = entry.end_at || `${entry.end_date}T23:59:59.999Z`;
    getOrphanedShiftsForLeaveAction(entry.worker_id, startAt, endAt)
      .then((res) => setShifts((res || []) as OrphanShift[]))
      .catch(() => setShifts([]))
      .finally(() => setShiftsLoading(false));
  }, [entry]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await reviewLeaveRequestAction({
        leave_request_id: entry.id,
        organization_id: orgId,
        status: "approved",
        manager_notes: "Approved & shifts dropped via triage",
      });
      onResolved();
      onClose();
    } catch (e: any) {
      console.error("[leave] approve failed:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await reviewLeaveRequestAction({
        leave_request_id: entry.id,
        organization_id: orgId,
        status: "rejected",
        manager_notes: "Declined via triage",
      });
      onResolved();
      onClose();
    } catch (e: any) {
      console.error("[leave] decline failed:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const name = workerName(entry);
  const days = entry.days || calcDays(entry.start_date, entry.end_date);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
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
            {workerAvatar(entry) ? (
              <img src={workerAvatar(entry)!} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">{getInitials(name)}</div>
            )}
            <div>
              <h3 className="text-[14px] font-medium text-white">{name}</h3>
              <p className="text-[11px] text-zinc-500">Leave Request Review</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Leave Details */}
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Leave Details</p>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="text-white font-medium">{leaveTypeLabel(entry.leave_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Period</span>
                <span className="font-mono text-[12px] text-white">{formatDate(entry.start_date)} — {formatDate(entry.end_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duration</span>
                <span className="font-mono text-[12px] text-white">{days} Day{days > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Source</span>
                <span className="text-zinc-400 capitalize">{entry.source}</span>
              </div>
              {entry.emergency_reported && (
                <div className="flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="h-3 w-3 text-rose-400" />
                  <span className="text-[11px] font-medium text-rose-400">Emergency Reported</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          {entry.reason && (
            <div className="border-l-2 border-zinc-700 pl-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worker&apos;s Reason</p>
              <p className="text-[14px] italic leading-relaxed text-zinc-300">
                &ldquo;{entry.reason}&rdquo;
              </p>
            </div>
          )}

          {/* Orphaned Shifts */}
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Shifts Requiring Coverage
            </p>
            {shiftsLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 size={14} className="animate-spin text-zinc-500" />
                <span className="text-xs text-zinc-500">Loading shift conflicts...</span>
              </div>
            ) : shifts.length === 0 ? (
              <p className="text-[12px] text-zinc-500">No scheduled shifts conflict with this leave period.</p>
            ) : (
              <div className="space-y-2">
                {shifts.map((s) => {
                  const pName = s.participant_profiles?.preferred_name || s.participant_profiles?.full_name || "Unassigned";
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-white/5 bg-zinc-800/50 px-3 py-2">
                      <div>
                        <p className="font-mono text-[11px] text-white">
                          {formatDateShort(s.start_time)} · {formatTime(s.start_time)} — {formatTime(s.end_time)}
                        </p>
                        <p className="text-[10px] text-zinc-500">{s.title || pName}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] text-amber-400">Orphaned</span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-amber-400 font-medium mt-2">
                  {shifts.length} shift{shifts.length > 1 ? "s" : ""} will be dropped if approved.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 bg-[#050505] p-6 flex gap-3">
          <button
            onClick={handleDecline}
            disabled={actionLoading}
            className="flex w-1/3 items-center justify-center gap-2 rounded-md border border-rose-500/20 bg-transparent px-4 py-2.5 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="flex w-2/3 items-center justify-center gap-2 rounded-md bg-emerald-500 border-none px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Approve & Drop Shifts
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over C: Emergency Drop Protocol
   ═══════════════════════════════════════════════════════════════════ */

function EmergencyDropSlideOver({
  orgId,
  workers,
  onClose,
  onDropped,
}: {
  orgId: string;
  workers: WorkerOption[];
  onClose: () => void;
  onDropped: () => void;
}) {
  const [workerId, setWorkerId] = useState("");
  const [reason, setReason] = useState("");
  const [dropping, setDropping] = useState(false);

  const handleDrop = async () => {
    if (!orgId || !workerId) return;
    setDropping(true);
    try {
      await reportEmergencySickAction({
        organization_id: orgId,
        worker_id: workerId,
        reason: reason || "Emergency sick drop from triage command center",
      });
      onDropped();
      onClose();
    } catch (e: any) {
      console.error("[leave] emergency drop failed:", e);
    } finally {
      setDropping(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-rose-500/20 bg-rose-950/20 shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-rose-500/20 px-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="text-[14px] font-medium text-rose-400">Emergency Drop Protocol</h3>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <p className="text-[11px] leading-relaxed text-rose-300">
              This action <strong>instantly approves sick leave</strong>, orphans today&apos;s shifts, and dispatches SMS alerts to the cover pool. Use only for same-day emergencies.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worker</label>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="h-9 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-rose-500/30">
              <option value="">Select worker...</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for emergency drop..." rows={3} className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none resize-none focus:border-rose-500/30" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-rose-500/20 bg-[#050505] p-6">
          <button
            onClick={handleDrop}
            disabled={!workerId || dropping}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-rose-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-400 disabled:opacity-50"
          >
            {dropping ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            Drop & Alert Cover Pool
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function TeamLeavePage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [activeTab, setActiveTab] = useState<PillTab>("triage");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    pending_requests: 0,
    impacted_shifts_7d: 0,
    participants_affected: 0,
    revenue_at_risk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  // Slide-over states
  const [showRequestSlideOver, setShowRequestSlideOver] = useState(false);
  const [showEmergencySlideOver, setShowEmergencySlideOver] = useState(false);
  const [reviewEntry, setReviewEntry] = useState<LeaveRow | null>(null);

  // ── Load data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [triageData, telemetryData, workerData] = await Promise.all([
        getLeaveTriageDataAction(orgId),
        getLeaveTelemetryAction(orgId),
        listLeaveWorkersAction(orgId),
      ]);
      setRows(triageData as LeaveRow[]);
      setTelemetry(telemetryData);
      setWorkers(workerData as WorkerOption[]);
    } catch (e: any) {
      console.error("[leave] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId, loadData]);

  // ── Filter rows by tab + search ───────────────────
  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (activeTab === "triage") {
      filtered = rows.filter((r) => r.status === "pending");
    } else if (activeTab === "approved") {
      filtered = rows.filter((r) => r.status === "approved");
    } else {
      filtered = rows.filter((r) => r.status === "rejected" || r.status === "cancelled");
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          workerName(r).toLowerCase().includes(q) ||
          r.leave_type.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.worker_id.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [rows, activeTab, search]);

  // Pending count for badge
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  // Callback for data refresh after mutations
  const handleRefresh = useCallback(() => {
    startTransition(() => {
      loadData();
    });
  }, [loadData, startTransition]);

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            WORKFORCE
          </span>
          <div className="mx-4 h-4 w-px bg-white/10" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-zinc-900/50 p-1">
            {PILL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white font-medium shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
                }`}
              >
                {tab.label}
                {tab.id === "triage" && pendingCount > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1 text-[9px] font-bold text-amber-500">
                    {pendingCount}
                  </span>
                )}
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
              placeholder="Search worker, role, status..."
              className="ml-2 w-full bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
            />
          </div>

          {/* Request Leave CTA */}
          <button
            onClick={() => setShowRequestSlideOver(true)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            <Plus className="h-3 w-3" />
            Request Leave
          </button>

          {/* Emergency Drop CTA */}
          <button
            onClick={() => setShowEmergencySlideOver(true)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/20"
          >
            <AlertTriangle className="h-3 w-3" />
            Emergency Drop
          </button>
        </div>
      </div>

      {/* ═══ TELEMETRY RIBBON (h-16) ═══ */}
      <div className="flex h-16 w-full items-center overflow-x-auto border-b border-white/5 bg-zinc-950/30 px-8">
        <MetricNode label="PENDING REQUESTS" value={telemetry.pending_requests} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="IMPACTED SHIFTS (7D)"
          value={telemetry.impacted_shifts_7d}
          alert={telemetry.impacted_shifts_7d > 0}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode label="PARTICIPANTS AFFECTED" value={telemetry.participants_affected} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="REVENUE AT RISK"
          value={`$${telemetry.revenue_at_risk.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`}
        />
      </div>

      {/* ═══ DATA GRID ═══ */}
      <div className="flex-1 overflow-y-auto px-8 mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">WORKER</th>
              <th className="w-[25%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">LEAVE TYPE & REASON</th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">DATE RANGE</th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">OPERATIONAL IMPACT</th>
              <th className="w-[10%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">STATUS</th>
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
                <SkeletonRow />
              </>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState tab={activeTab} />
                </td>
              </tr>
            ) : (
              filteredRows.map((row, i) => {
                const name = workerName(row);
                const avatar = workerAvatar(row);
                const days = row.days || calcDays(row.start_date, row.end_date);
                // We derive operational impact from the emergency flag as a proxy
                // (real impact computed in telemetry; per-row impact shown on slide-over)
                const hasImpact = row.emergency_reported || row.status === "pending";

                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.25 }}
                    onClick={() => setReviewEntry(row)}
                    className="group cursor-pointer border-b border-white/5 transition-colors h-16 hover:bg-white/[0.02]"
                  >
                    {/* WORKER */}
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
                            {getInitials(name)}
                          </div>
                        )}
                        <div>
                          <p className="text-[14px] font-medium text-zinc-100">{name}</p>
                          <p className="font-mono text-[10px] text-zinc-500 capitalize">{row.source === "emergency_sick" ? "Emergency" : row.source}</p>
                        </div>
                      </div>
                    </td>

                    {/* LEAVE TYPE & REASON */}
                    <td className="py-3">
                      <div>
                        <p className="text-[13px] text-white">{leaveTypeLabel(row.leave_type)}</p>
                        {row.reason && (
                          <p className="max-w-[200px] truncate text-[12px] text-zinc-400">{row.reason}</p>
                        )}
                      </div>
                    </td>

                    {/* DATE RANGE */}
                    <td className="py-3">
                      <div>
                        <p className="font-mono text-[12px] text-white">
                          {formatDate(row.start_date)} — {formatDate(row.end_date)}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500">{days} Day{days > 1 ? "s" : ""}</p>
                      </div>
                    </td>

                    {/* OPERATIONAL IMPACT */}
                    <td className="py-3">
                      {row.emergency_reported ? (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-rose-500" />
                          <span className="text-[12px] font-medium text-rose-400">Emergency Drop</span>
                        </div>
                      ) : hasImpact ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-amber-500" />
                          <span className="text-[12px] font-medium text-amber-500">Shifts at risk</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-zinc-500">No shift conflicts</span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="py-3">
                      <GhostBadge status={row.status} />
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

      {/* ═══ SLIDE-OVERS ═══ */}
      <AnimatePresence>
        {showRequestSlideOver && orgId && (
          <RequestLeaveSlideOver
            orgId={orgId}
            workers={workers}
            onClose={() => setShowRequestSlideOver(false)}
            onCreated={handleRefresh}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewEntry && orgId && (
          <TriageReviewSlideOver
            entry={reviewEntry}
            orgId={orgId}
            onClose={() => setReviewEntry(null)}
            onResolved={handleRefresh}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmergencySlideOver && orgId && (
          <EmergencyDropSlideOver
            orgId={orgId}
            workers={workers}
            onClose={() => setShowEmergencySlideOver(false)}
            onDropped={handleRefresh}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
