"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, UserRoundX, Waves } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  calculateLeaveImpactAction,
  createLeaveRequestAction,
  listLeaveRequestsAction,
  listLeaveWorkersAction,
  reportEmergencySickAction,
  reviewLeaveRequestAction,
  triggerLeaveShadowInjectionAction,
} from "@/app/actions/team-leave";

type LeaveType = "annual" | "sick" | "rdo" | "unpaid" | "compassionate";
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

type WorkerOption = {
  id: string;
  name: string;
  role: string;
};

type LeaveRequestRow = {
  id: string;
  organization_id: string;
  worker_id: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  emergency_reported: boolean;
  source: "manual" | "mobile" | "emergency_sick";
  reason: string | null;
  manager_notes: string | null;
  created_at: string;
  worker?: { full_name?: string | null; email?: string | null };
  balance?: { annual_leave_hours?: number; sick_leave_hours?: number; last_synced_at?: string | null };
};

type Impact = {
  impacted_shift_count: number;
  revenue_at_risk: number;
  unique_participants_affected: number;
  master_roster_impacts: number;
};

const defaultImpact: Impact = {
  impacted_shift_count: 0,
  revenue_at_risk: 0,
  unique_participants_affected: 0,
  master_roster_impacts: 0,
};

export default function TeamLeavePage() {
  const { orgId } = useOrg();
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [rows, setRows] = useState<LeaveRequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");

  const [workerId, setWorkerId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [impact, setImpact] = useState<Impact>(defaultImpact);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const [workerRes, leaveRes] = await Promise.all([
      listLeaveWorkersAction(orgId),
      listLeaveRequestsAction(orgId),
    ]);
    setWorkers(workerRes as WorkerOption[]);
    setRows((leaveRes || []) as LeaveRequestRow[]);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [orgId, refresh]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const selectedWorkerName = useMemo(
    () => workers.find((w) => w.id === workerId)?.name || "Worker",
    [workerId, workers],
  );

  useEffect(() => {
    if (!workerId || !startDate || !endDate) {
      setImpact(defaultImpact);
      return;
    }
    calculateLeaveImpactAction({
      worker_id: workerId,
      start_at: `${startDate}T00:00:00.000Z`,
      end_at: `${endDate}T23:59:59.999Z`,
    })
      .then((res) => setImpact((res as Impact) || defaultImpact))
      .catch(() => setImpact(defaultImpact));
  }, [workerId, startDate, endDate]);

  const emergencyRows = rows.filter((r) => r.emergency_reported);
  const pendingRows = rows.filter((r) => !r.emergency_reported && r.status === "pending");
  const historyRows = rows.filter((r) => !r.emergency_reported && r.status !== "pending");

  async function onCreateLeave() {
    if (!orgId || !workerId || !startDate || !endDate) return;
    startBusy(async () => {
      setMsg("");
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
        setMsg("Leave request created and queued for triage.");
        setReason("");
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to create leave request.");
      }
    });
  }

  async function onEmergencySick() {
    if (!orgId || !workerId) return;
    startBusy(async () => {
      setMsg("");
      try {
        await reportEmergencySickAction({
          organization_id: orgId,
          worker_id: workerId,
          reason: "Emergency sick report from Team Leave command center",
        });
        setMsg("Emergency sick activated. Shift reassignment cascade has started.");
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to trigger emergency sick.");
      }
    });
  }

  async function onReview(status: "approved" | "rejected" | "cancelled", leaveId?: string) {
    const targetId = leaveId || selected?.id;
    if (!orgId || !targetId) return;
    startBusy(async () => {
      try {
        await reviewLeaveRequestAction({
          leave_request_id: targetId,
          organization_id: orgId,
          status,
          manager_notes: status === "approved" ? "Approved & trigger cover search" : undefined,
        });
        setMsg(`Request ${status}.`);
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to review request.");
      }
    });
  }

  async function onInjectShadowEntries() {
    if (!orgId) return;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    startBusy(async () => {
      try {
        const result = await triggerLeaveShadowInjectionAction({
          organization_id: orgId,
          period_start: start.toISOString().slice(0, 10),
          period_end: end.toISOString().slice(0, 10),
        });
        setMsg(`Shadow timesheet injection complete (${result.inserted} entries).`);
      } catch (error: any) {
        setMsg(error?.message || "Shadow timesheet injection failed.");
      }
    });
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Project Equinox</p>
          <h1 className="text-lg font-semibold text-zinc-200">Leave Triage & Emergency Cover</h1>
        </div>
        <button
          className="stealth-btn-secondary"
          onClick={onInjectShadowEntries}
          disabled={!orgId || busy}
        >
          Inject Shadow Timesheets
        </button>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="stealth-panel lg:col-span-5">
          <div className="mb-3 flex items-center gap-2">
            <Waves size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Request Leave</h2>
          </div>

          <label className="stealth-label mb-1 block">Worker</label>
          <select className="stealth-input mb-3" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">Select worker</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <label className="stealth-label mb-1 block">Leave Type</label>
          <select
            className="stealth-input mb-3"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          >
            <option value="annual">Annual Leave</option>
            <option value="sick">Personal/Carer&apos;s Leave</option>
            <option value="rdo">Rostered Day Off</option>
            <option value="unpaid">Unpaid Leave</option>
            <option value="compassionate">Compassionate Leave</option>
          </select>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="stealth-label mb-1 block">Start</label>
              <input className="stealth-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="stealth-label mb-1 block">End</label>
              <input className="stealth-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <label className="stealth-label mb-1 block">Reason</label>
          <textarea
            className="stealth-input mb-3 min-h-[72px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional context or notes"
          />

          <div className="mb-4 grid grid-cols-2 gap-2">
            <ImpactTile label="Impacted Shifts" value={impact.impacted_shift_count.toString()} />
            <ImpactTile label="Participants" value={impact.unique_participants_affected.toString()} />
            <ImpactTile label="Revenue At Risk" value={`$${Number(impact.revenue_at_risk || 0).toFixed(2)}`} />
            <ImpactTile label="Master Roster Hits" value={impact.master_roster_impacts.toString()} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="stealth-btn-primary justify-center"
              onClick={onCreateLeave}
              disabled={!orgId || !workerId || !startDate || !endDate || busy}
            >
              Submit Request
            </button>
            <button
              className="stealth-btn-danger justify-center"
              onClick={onEmergencySick}
              disabled={!orgId || !workerId || busy}
            >
              <UserRoundX size={14} />
              Emergency Sick
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-300">
            Emergency sick auto-approves and immediately launches Drop & Cover.
          </p>
        </section>

        <section className="stealth-panel lg:col-span-7">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Triage Board</h2>
          </div>

          {loading ? (
            <p className="text-sm text-zinc-500">Loading leave requests…</p>
          ) : (
            <div className="space-y-4">
              {emergencyRows.length > 0 && (
                <BoardGroup
                  title="Emergency Sick Calls"
                  tone="crimson"
                  rows={emergencyRows}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}

              <BoardGroup
                title="Pending Requests"
                tone="blue"
                rows={pendingRows}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />

              <BoardGroup
                title="History"
                tone="neutral"
                rows={historyRows}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}

          {selected && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-100">
                  {selected.worker?.full_name || selected.worker?.email || selected.worker_id}
                </p>
                <p className="text-xs uppercase tracking-wide text-zinc-500">{selected.status}</p>
              </div>
              <p className="mb-3 text-xs text-zinc-400">
                {selected.leave_type} • {selected.start_date} to {selected.end_date} • source: {selected.source}
              </p>
              {(selected.balance?.annual_leave_hours != null || selected.balance?.sick_leave_hours != null) && (
                <p className="mb-3 text-xs text-amber-300">
                  Balance cache — Annual: {Number(selected.balance?.annual_leave_hours || 0).toFixed(1)}h, Sick: {Number(selected.balance?.sick_leave_hours || 0).toFixed(1)}h
                </p>
              )}
              {selected.reason && <p className="mb-3 text-sm text-zinc-300">{selected.reason}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  className="stealth-btn-primary"
                  onClick={() => onReview("approved", selected.id)}
                  disabled={busy}
                >
                  <CheckCircle2 size={14} />
                  Approve & Trigger Cover
                </button>
                <button
                  className="stealth-btn-secondary"
                  onClick={() => onReview("rejected", selected.id)}
                  disabled={busy}
                >
                  Reject
                </button>
                <button
                  className="stealth-btn-secondary"
                  onClick={() => onReview("cancelled", selected.id)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!selected && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-500">
              Select a request to open context and action controls.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ImpactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function BoardGroup({
  title,
  tone,
  rows,
  selectedId,
  onSelect,
}: {
  title: string;
  tone: "crimson" | "blue" | "neutral";
  rows: LeaveRequestRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const toneClass =
    tone === "crimson"
      ? "border-rose-500/30"
      : tone === "blue"
        ? "border-blue-500/30"
        : "border-white/10";

  const icon =
    tone === "crimson" ? <AlertTriangle size={13} className="text-rose-400" /> : <CheckCircle2 size={13} className="text-zinc-400" />;

  return (
    <div className={`rounded-lg border ${toneClass} bg-white/[0.01]`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        {icon}
        <p className="text-xs font-medium text-zinc-200">{title}</p>
      </div>
      <div>
        {rows.length === 0 && <p className="px-3 py-3 text-xs text-zinc-500">No items.</p>}
        {rows.map((row) => {
          const active = selectedId === row.id;
          return (
            <button
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2 text-left transition ${
                active ? "bg-emerald-500/10" : "hover:bg-white/[0.03]"
              }`}
            >
              <div>
                <p className="text-sm text-zinc-200">
                  {row.worker?.full_name || row.worker?.email || row.worker_id}
                </p>
                <p className="text-xs text-zinc-500">
                  {row.leave_type} • {row.start_date} to {row.end_date}
                </p>
              </div>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{row.status}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

