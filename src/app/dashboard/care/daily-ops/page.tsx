"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileDown, Radio, RefreshCw } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  listCareFacilitiesAction,
  listFacilityDailyOpsAction,
  listTaskInstancesForDateAction,
  triggerDailyTaskGenerationAction,
} from "@/app/actions/care-routines";

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

export default function CareDailyOpsPage() {
  const { orgId } = useOrg();
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [summary, setSummary] = useState<FacilitySummary[]>([]);
  const [feed, setFeed] = useState<TaskRow[]>([]);

  async function refresh() {
    if (!orgId) return;
    const [f, s, rows] = await Promise.all([
      listCareFacilitiesAction(orgId),
      listFacilityDailyOpsAction({ organization_id: orgId, target_date: date }),
      listTaskInstancesForDateAction({
        organization_id: orgId,
        target_date: date,
        facility_id: selectedFacility || undefined,
      }),
    ]);
    setFacilities((f || []).map((x: any) => ({ id: x.id as string, name: x.name as string })));
    setSummary((s || []) as FacilitySummary[]);
    setFeed((rows || []) as TaskRow[]);
  }

  useEffect(() => {
    refresh();
  }, [orgId, date, selectedFacility]);

  const criticalCount = useMemo(
    () => feed.filter((x) => x.is_critical && x.status === "pending").length,
    [feed],
  );

  function onGenerateNow() {
    startBusy(async () => {
      try {
        const inserted = await triggerDailyTaskGenerationAction({ target_date: date });
        setMsg(`Generation run complete (${inserted} new tasks).`);
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to generate tasks.");
      }
    });
  }

  const selectedName = facilities.find((x) => x.id === selectedFacility)?.name || "Facility";
  const exportUrl = selectedFacility
    ? `/api/care/facilities/${selectedFacility}/cleaning-log?orgId=${orgId}&start=${date}&end=${date}`
    : "#";

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Project Choreography</p>
          <h1 className="text-lg font-semibold text-zinc-200">Daily Operations Triage Board</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="stealth-btn-secondary" onClick={onGenerateNow} disabled={busy}>
            <RefreshCw size={14} />
            Run Generator
          </button>
          <a
            className={`stealth-btn-secondary ${!selectedFacility ? "pointer-events-none opacity-50" : ""}`}
            href={exportUrl}
            target="_blank"
          >
            <FileDown size={14} />
            Export Cleaning Log
          </a>
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </div>
      )}

      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Target Date</p>
          <input className="stealth-input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Facility Filter</p>
          <select
            className="stealth-input mt-1"
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
          >
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Critical Pending</p>
          <p className="text-2xl font-semibold text-rose-300">{criticalCount}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {summary.map((s) => (
          <div key={s.facility_id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-sm font-medium text-zinc-200">{s.facility_name}</p>
            <p className="text-xs text-zinc-500">
              {s.completed}/{s.total} complete ({s.completion_pct}%)
            </p>
            <p className="mt-1 text-xs text-rose-300">{s.critical_pending} critical pending</p>
          </div>
        ))}
      </div>

      <section className="stealth-panel">
        <div className="mb-3 flex items-center gap-2">
          <Radio size={16} className="text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-200">Live Task Feed</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Worker</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {feed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-zinc-500">
                    No task activity for this date.
                  </td>
                </tr>
              ) : (
                feed.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 text-sm text-zinc-300">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.is_critical && <AlertTriangle size={13} className="text-rose-400" />}
                        <span>{row.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {row.care_facilities?.name || row.participant_profiles?.preferred_name || "General"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{row.profiles?.full_name || row.profiles?.email || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{new Date(row.updated_at).toLocaleTimeString("en-AU")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {selectedFacility && (
          <p className="mt-2 text-xs text-zinc-500">
            Export scope: {selectedName} on {date}.
          </p>
        )}
      </section>
    </div>
  );
}
