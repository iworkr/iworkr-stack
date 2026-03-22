/**
 * @page /dashboard/finance/travel
 * @status COMPLETE
 * @description Shift travel logs with distance adjustment and variance approval
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MapPinned, RefreshCw, Route } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  adjustTravelClaimDistanceAction,
  approveTravelVarianceAction,
  listShiftTravelLogsAction,
  type ShiftTravelLogRow,
} from "@/app/actions/travel";

function currency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export default function FinanceTravelPage() {
  const { orgId } = useOrg();
  const [logs, setLogs] = useState<ShiftTravelLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShiftTravelLogRow | null>(null);
  const [distanceInput, setDistanceInput] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await listShiftTravelLogsAction(orgId, {});
      setLogs(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } finally {
      setLoading(false);
    }
  }, [orgId, selected]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDistanceInput(selected?.claimed_distance_km?.toString() || "");
  }, [selected?.id, selected?.claimed_distance_km]);

  const flagged = useMemo(
    () => logs.filter((l) => l.variance_status === "flagged_amber" || !l.is_approved),
    [logs],
  );

  const totals = useMemo(() => {
    let allowance = 0;
    let billed = 0;
    for (const row of logs) {
      allowance += row.payroll_allowance_amount || 0;
      billed += row.ndis_billed_amount || 0;
    }
    return { allowance, billed };
  }, [logs]);

  const handleApprove = (logId: string, approved: boolean) =>
    startTransition(async () => {
      await approveTravelVarianceAction({ log_id: logId, approved });
      await load();
    });

  const handleAdjust = (logId: string) =>
    startTransition(async () => {
      const km = Number(distanceInput);
      if (!Number.isFinite(km) || km < 0) return;
      await adjustTravelClaimDistanceAction({
        log_id: logId,
        claimed_distance_km: km,
        reason: "Adjusted during Odyssey map forensics review",
      });
      await load();
    });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-400">ODYSSEY</p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Travel & Transport Ledger</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Validate route variance, approve claims, and inspect kilometer financial splits.
          </p>
        </div>
        <button className="stealth-btn-ghost" onClick={load} disabled={loading || pending}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="r-card p-4 border border-[var(--border-base)] bg-[var(--surface-1)]">
          <p className="text-xs text-[var(--text-muted)]">Logs</p>
          <p className="text-2xl font-mono text-[var(--text-primary)]">{logs.length}</p>
        </div>
        <div className="r-card p-4 border border-[var(--border-base)] bg-[var(--surface-1)]">
          <p className="text-xs text-[var(--text-muted)]">Flagged</p>
          <p className="text-2xl font-mono text-amber-400">{flagged.length}</p>
        </div>
        <div className="r-card p-4 border border-[var(--border-base)] bg-[var(--surface-1)]">
          <p className="text-xs text-[var(--text-muted)]">Allowance / NDIS</p>
          <p className="text-sm font-mono text-emerald-400">{currency(totals.allowance)} / {currency(totals.billed)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-base)] text-xs text-[var(--text-muted)] font-mono uppercase tracking-[0.1em]">
            Travel Ledger
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">Loading travel logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-sm text-[var(--text-muted)]">No travel logs yet.</div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              {logs.map((row) => {
                const isFlagged = row.variance_status === "flagged_amber" || !row.is_approved;
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border-base)] hover:bg-white/[0.03] ${
                      selected?.id === row.id ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isFlagged ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        <span className="text-sm text-[var(--text-primary)]">{row.travel_type === "provider_travel" ? "Provider Travel" : "Participant Transport"}</span>
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)]">{row.claimed_distance_km.toFixed(2)} km</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Expected {row.expected_distance_km?.toFixed(2) ?? "-"} km · Variance {row.variance_percent?.toFixed(2) ?? "-"}%
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <MapPinned className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold">Map Forensics</h2>
          </div>
          {!selected ? (
            <p className="text-sm text-[var(--text-muted)]">Select a travel row.</p>
          ) : (
            <>
              <div className="text-xs text-[var(--text-muted)]">Claimed vs expected route delta</div>
              <div className="p-3 rounded-lg border border-[var(--border-base)] bg-black/20">
                <div className="text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Route className="w-4 h-4 text-cyan-400" />
                  {(selected.raw_breadcrumbs?.length || 0).toString()} breadcrumbs captured
                </div>
                <div className="mt-2 text-xs text-[var(--text-muted)]">
                  Claimed: {selected.claimed_distance_km.toFixed(2)} km · Expected: {selected.expected_distance_km?.toFixed(2) ?? "-"} km
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Payroll allowance: {currency(selected.payroll_allowance_amount || 0)} · NDIS billed: {currency(selected.ndis_billed_amount || 0)}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[var(--text-muted)]">Adjust claimed KM</label>
                <input
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-base)] text-sm text-[var(--text-primary)]"
                />
                <button className="stealth-btn-ghost w-full justify-center" onClick={() => handleAdjust(selected.id)} disabled={pending}>
                  Adjust to reviewed KM
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="stealth-btn-brand justify-center" onClick={() => handleApprove(selected.id, true)} disabled={pending}>
                  Approve variance
                </button>
                <button className="stealth-btn-ghost justify-center" onClick={() => handleApprove(selected.id, false)} disabled={pending}>
                  Keep flagged
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

