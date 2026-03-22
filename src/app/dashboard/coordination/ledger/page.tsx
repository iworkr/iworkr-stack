/**
 * @page /dashboard/coordination/ledger
 * @status COMPLETE
 * @description Coordination of supports ledger with billable units, activity log, and daily KPIs
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getCoordinationDailyKPIAction, listCoordinationEntriesAction } from "@/app/actions/coordination";
import { Activity, Clock3 } from "lucide-react";

type Entry = {
  id: string;
  participant_id: string;
  start_time: string;
  end_time: string;
  billable_units: number;
  activity_type: string;
  case_note: string;
  total_charge: number;
  status: string;
  metadata?: Record<string, unknown>;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default function CoordinationLedgerPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kpi, setKpi] = useState<{ billable_hours_today: number; target_hours: number; progress_percent: number } | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!orgId) return;
    startTransition(async () => {
      try {
        const [rows, daily] = await Promise.all([
          listCoordinationEntriesAction({ organization_id: orgId, limit: 300 }),
          getCoordinationDailyKPIAction({ organization_id: orgId }),
        ]);
        setEntries((rows || []) as Entry[]);
        setKpi(daily);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }, [orgId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const row of entries) {
      const key = new Date(row.start_time).toDateString();
      const arr = map.get(key) || [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-cyan-300" />
          <h1 className="text-lg font-semibold">Support Coordination Ledger</h1>
        </div>

        {kpi && (
          <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Daily Billable KPI</p>
              <p className="font-mono text-sm text-zinc-300">
                {kpi.billable_hours_today.toFixed(1)}h / {kpi.target_hours.toFixed(1)}h
              </p>
            </div>
            <div className="mt-2 h-2 rounded bg-zinc-800">
              <div className="h-2 rounded bg-cyan-400" style={{ width: `${Math.min(100, kpi.progress_percent)}%` }} />
            </div>
          </section>
        )}

        {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}

        <section className="space-y-4">
          {grouped.map(([date, rows]) => (
            <div key={date} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">{date}</p>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-zinc-200">
                          {fmtTime(row.start_time)} - {fmtTime(row.end_time)} ({(row.billable_units * 0.1).toFixed(1)}h) · {row.activity_type}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{row.case_note}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-emerald-300">${Number(row.total_charge || 0).toFixed(2)}</p>
                        <p className="text-xs text-zinc-500">{row.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!pending && entries.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-500">
              <Activity className="mx-auto mb-2 h-4 w-4" />
              No coordination logs yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

