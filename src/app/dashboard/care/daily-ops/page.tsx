/**
 * @page /dashboard/care/daily-ops
 * @status COMPLETE
 * @description Daily operations board — realtime shift tracking, task checklists, and roster downloads
 * @dataSource supabase-client (realtime) + server-action: care actions
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useMemo, useState, useCallback, useTransition, useRef } from "react";
import {
  Play,
  Download,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";
import {
  listCareFacilitiesAction,
  listFacilityDailyOpsAction,
  listTaskInstancesForDateAction,
  triggerDailyTaskGenerationAction,
} from "@/app/actions/care-routines";

/* ── Types ────────────────────────────────────────────── */

type FacilitySummary = {
  facility_id: string;
  facility_name: string;
  total: number;
  completed: number;
  completion_pct: number;
  critical_pending: number;
};

type TaskRow = {
  id: string;
  title: string;
  status: "pending" | "completed" | "exempted" | "missed";
  is_critical: boolean;
  updated_at: string;
  target_date: string;
  care_facilities?: { name?: string | null };
  participant_profiles?: { preferred_name?: string | null };
  profiles?: { full_name?: string | null; email?: string | null };
};

/* ── Status Config ────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: "Pending",     bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  completed: { label: "Completed",   bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  exempted:  { label: "Exempted",    bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  missed:    { label: "Missed",      bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
  blocked:   { label: "Blocked",     bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
  in_progress: { label: "In Progress", bg: "bg-blue-500/10", text: "text-blue-400",    border: "border-blue-500/20" },
};

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Relative Time Hook ───────────────────────────────── */

function useRelativeTime(dateStr: string): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const ms = now - new Date(dateStr).getTime();
  if (ms < 60_000) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function RelativeTimestamp({ dateStr }: { dateStr: string }) {
  const rel = useRelativeTime(dateStr);
  return <span className="font-mono text-xs text-zinc-400">{rel}</span>;
}

/* ── Ghost Badge ──────────────────────────────────────── */

function GhostBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}

/* ── Critical Delays KPI ──────────────────────────────── */

function CriticalDelaysKPI({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="px-2.5 py-1 rounded-md bg-white/5 text-zinc-500 text-xs font-medium border border-white/5">
        0 Critical Delays
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold animate-pulse">
      {count} Critical Delay{count !== 1 ? "s" : ""}
    </span>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL_WIDTHS = [
  { task: "w-40", scope: "w-28", badge: "w-16", worker: "w-24", time: "w-12" },
  { task: "w-48", scope: "w-20", badge: "w-20", worker: "w-32", time: "w-14" },
  { task: "w-36", scope: "w-32", badge: "w-16", worker: "w-20", time: "w-10" },
  { task: "w-52", scope: "w-24", badge: "w-18", worker: "w-28", time: "w-12" },
  { task: "w-44", scope: "w-28", badge: "w-16", worker: "w-24", time: "w-14" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const w = SKEL_WIDTHS[idx % SKEL_WIDTHS.length];
  return (
    <tr className="border-b border-white/5 h-14">
      <td className="px-8 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${w.task} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-2 w-16 bg-zinc-900/60 rounded-sm animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${w.scope} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className={`h-5 ${w.badge} bg-zinc-900 rounded-md animate-pulse`} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-900 animate-pulse shrink-0" />
          <div className={`h-3 ${w.worker} bg-zinc-900 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${w.time} bg-zinc-900 rounded-sm animate-pulse`} /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <ClipboardCheck className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No tasks scheduled.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            You&apos;re all clear for this date. Run the generator to populate the board.
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-4 text-xs text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
          >
            {generating ? "Generating…" : "Run Generator"}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Flash Row (for Realtime inserts) ─────────────────── */

function TaskDataRow({ row, isNew }: { row: TaskRow; isNew: boolean }) {
  const workerName = row.profiles?.full_name || row.profiles?.email || "—";
  const workerInitials = workerName !== "—" ? getInitials(workerName) : "?";
  const scope = row.care_facilities?.name || row.participant_profiles?.preferred_name || "General";
  const taskIdShort = `TSK-${row.id.slice(0, 4).toUpperCase()}`;

  return (
    <tr
      className={`group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-14 ${
        isNew ? "animate-flash-green" : ""
      }`}
    >
      {/* Col 1: Task */}
      <td className="px-8 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {row.is_critical && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
          <div className="min-w-0">
            <span className="text-sm text-zinc-100 font-medium truncate block">{row.title}</span>
            <span className="text-[10px] font-mono text-zinc-600">{taskIdShort}</span>
          </div>
        </div>
      </td>

      {/* Col 2: Scope */}
      <td className="px-4 py-3">
        <span className="text-[13px] text-zinc-400 truncate block">{scope}</span>
      </td>

      {/* Col 3: Status */}
      <td className="px-4 py-3">
        <GhostBadge status={row.status} />
      </td>

      {/* Col 4: Worker */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
            <span className="text-[9px] text-zinc-400 font-medium">{workerInitials}</span>
          </div>
          <span className="text-[13px] text-zinc-300 truncate">{workerName}</span>
        </div>
      </td>

      {/* Col 5: Updated */}
      <td className="px-4 py-3">
        <RelativeTimestamp dateStr={row.updated_at} />
      </td>
    </tr>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CareDailyOpsPage() {
  const { orgId } = useOrg();
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [feed, setFeed] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const facilityRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [f, rows] = await Promise.all([
        listCareFacilitiesAction(orgId),
        listTaskInstancesForDateAction({
          organization_id: orgId,
          target_date: date,
          facility_id: selectedFacility || undefined,
        }),
      ]);
      setFacilities((f || []).map((x: any) => ({ id: x.id as string, name: x.name as string })));
      setFeed((rows || []) as TaskRow[]);
    } catch (err) {
      console.error("Failed to load daily ops:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, date, selectedFacility]);

  useEffect(() => { refresh(); }, [refresh]);

  // Close facility dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (facilityRef.current && !facilityRef.current.contains(e.target as Node)) {
        setFacilityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Supabase Realtime ──────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("daily-ops-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_instances",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as TaskRow;
            if (newRow.target_date === date) {
              setFeed((prev) => [newRow, ...prev]);
              setNewRowIds((prev) => new Set(prev).add(newRow.id));
              setTimeout(() => {
                setNewRowIds((prev) => {
                  const next = new Set(prev);
                  next.delete(newRow.id);
                  return next;
                });
              }, 1000);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as TaskRow;
            setFeed((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, date]);

  /* ── Computed ────────────────────────────────────────── */
  const criticalCount = useMemo(
    () => feed.filter((x) => x.is_critical && x.status === "pending").length,
    [feed],
  );

  const selectedFacilityName = facilities.find((x) => x.id === selectedFacility)?.name || "All Facilities";
  const exportUrl = selectedFacility
    ? `/api/care/facilities/${selectedFacility}/cleaning-log?orgId=${orgId}&start=${date}&end=${date}`
    : "#";

  function onGenerateNow() {
    startBusy(async () => {
      try {
        const inserted = await triggerDailyTaskGenerationAction({ target_date: date });
        setMsg(`Generation complete — ${inserted} new tasks created.`);
        await refresh();
        setTimeout(() => setMsg(""), 5000);
      } catch (error: any) {
        setMsg(error?.message || "Failed to generate tasks.");
      }
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Flash animation keyframes (injected once) ──── */}
      <style jsx global>{`
        @keyframes flash-green {
          0% { background-color: rgba(16, 185, 129, 0.1); }
          100% { background-color: transparent; }
        }
        .animate-flash-green { animation: flash-green 1s ease-out; }
      `}</style>

      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Daily Ops
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <span className="text-[10px] tracking-widest uppercase text-white font-medium select-none">
            Triage Board
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <a
            href={exportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors ${
              !selectedFacility ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <Download className="w-3 h-3" />
            Export Log
          </a>
          <button
            onClick={onGenerateNow}
            disabled={busy}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95 disabled:opacity-40"
          >
            <Play className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            Run Generator
          </button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center justify-between h-12 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0">
        {/* Left: Filters */}
        <div className="flex items-center gap-3">
          {/* Date Picker */}
          <div className="relative h-7 flex items-center">
            <Calendar className="absolute left-2.5 w-3 h-3 text-zinc-500 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 pl-7 pr-2 rounded border border-white/10 bg-transparent text-xs text-zinc-300 outline-none hover:bg-white/5 focus:border-zinc-600 transition-colors [color-scheme:dark] cursor-pointer"
            />
          </div>

          {/* Facility Filter (custom dropdown) */}
          <div className="relative" ref={facilityRef}>
            <button
              onClick={() => setFacilityDropdownOpen(!facilityDropdownOpen)}
              className="h-7 px-3 flex items-center gap-2 rounded border border-white/10 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors"
            >
              {selectedFacilityName}
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>
            {facilityDropdownOpen && (
              <div className="absolute z-20 mt-1 w-48 bg-zinc-900 border border-white/[0.08] rounded-md shadow-xl overflow-hidden">
                <button
                  onClick={() => { setSelectedFacility(""); setFacilityDropdownOpen(false); }}
                  className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                    !selectedFacility ? "text-white bg-white/5" : "text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  All Facilities
                </button>
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setSelectedFacility(f.id); setFacilityDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                      selectedFacility === f.id ? "text-white bg-white/5" : "text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Critical Delays KPI */}
        <CriticalDelaysKPI count={criticalCount} />
      </div>

      {/* ─── Success Toast ────────────────────────────────── */}
      {msg && (
        <div className="mx-8 mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {msg}
        </div>
      )}

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          {/* Column Headers */}
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Task</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Scope</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Status</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Worker</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Updated</th>
            </tr>
          </thead>
          <tbody>
            {/* Loading Skeletons */}
            {loading && feed.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            )}

            {/* Empty State */}
            {!loading && feed.length === 0 && (
              <EmptyState onGenerate={onGenerateNow} generating={busy} />
            )}

            {/* Data Rows */}
            {!loading && feed.map((row) => (
              <TaskDataRow key={row.id} row={row} isNew={newRowIds.has(row.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
