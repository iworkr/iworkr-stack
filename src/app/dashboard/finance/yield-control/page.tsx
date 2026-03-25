/**
 * @page Yield Control — Auto-Yield Command Center
 * @status COMPLETE
 * @description Project Auto-Yield: Unified financial control panel with real-time
 *   telemetry for the bifurcated payroll + AR pipeline.
 * @lastAudit 2026-03-24
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import {
  executeYieldPipelineAction,
  fetchReadyTimesheetsAction,
  fetchYieldStatsAction,
  fetchPayRunsAction,
  lockPayRunAction,
  exportPayRunAction,
  fetchYieldLogAction,
  type YieldResult,
  type PayRun,
  type YieldStats,
  type ReadyTimesheets,
  type YieldLogEntry,
} from "@/app/actions/auto-yield";

type YieldMode = "BOTH" | "PAYROLL_ONLY" | "AR_ONLY";

export default function YieldControlPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);

  const [ready, setReady] = useState<ReadyTimesheets>({
    ready_count: 0,
    total_hours: 0,
    worker_count: 0,
  });
  const [stats, setStats] = useState<YieldStats | null>(null);
  const [payRuns, setPayRuns] = useState<PayRun[]>([]);
  const [log, setLog] = useState<YieldLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Pipeline state
  const [executing, setExecuting] = useState(false);
  const [mode, setMode] = useState<YieldMode>("BOTH");
  const [result, setResult] = useState<YieldResult | null>(null);
  const [livePayroll, setLivePayroll] = useState(0);
  const [liveAr, setLiveAr] = useState(0);
  const [liveProcessed, setLiveProcessed] = useState(0);

  // Refs for animation
  const payrollRef = useRef(0);
  const arRef = useRef(0);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [readyData, statsData, payRunsData, logData] = await Promise.all([
      fetchReadyTimesheetsAction(orgId),
      fetchYieldStatsAction(orgId),
      fetchPayRunsAction(orgId),
      fetchYieldLogAction(orgId),
    ]);
    setReady(readyData);
    setStats(statsData);
    setPayRuns(payRunsData);
    setLog(logData);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for yield_processing_log
  useEffect(() => {
    if (!orgId) return;
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("yield-telemetry")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "yield_processing_log",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as YieldLogEntry;
          setLog((prev) => [row, ...prev].slice(0, 200));

          if (row.status === "COMPLETED") {
            payrollRef.current += row.payroll_amount || 0;
            arRef.current += row.ar_amount || 0;
            setLivePayroll(payrollRef.current);
            setLiveAr(arRef.current);
            setLiveProcessed((p) => p + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const handleExecute = async () => {
    if (!orgId || executing) return;
    setExecuting(true);
    setResult(null);
    payrollRef.current = 0;
    arRef.current = 0;
    setLivePayroll(0);
    setLiveAr(0);
    setLiveProcessed(0);

    const { ok, result: res, error } = await executeYieldPipelineAction(
      orgId,
      { mode },
    );

    if (ok && res) {
      setResult(res);
    } else if (error) {
      setResult(null);
    }

    setExecuting(false);
    loadData();
  };

  const handleLockPayRun = async (id: string) => {
    await lockPayRunAction(id);
    loadData();
  };

  const handleExport = async (id: string) => {
    if (!orgId) return;
    const { ok, csv } = await exportPayRunAction(orgId, id);
    if (ok && csv) {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payrun-${id.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    loadData();
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(v);

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold tracking-tight text-white">
          Yield Control
        </h1>
        <p className="text-xs text-neutral-500">
          Project Auto-Yield — Zero-touch billing & payroll engine
        </p>
      </div>

      {/* Funnel Bar */}
      <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <FunnelStat
              label="Verified Timesheets"
              value={ready.ready_count}
              unit="ready"
            />
            <FunnelStat
              label="Total Hours"
              value={ready.total_hours}
              unit="hrs"
            />
            <FunnelStat
              label="Workers"
              value={ready.worker_count}
              unit=""
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as YieldMode)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="BOTH">Both Forks</option>
              <option value="PAYROLL_ONLY">Payroll Only</option>
              <option value="AR_ONLY">AR / Invoicing Only</option>
            </select>

            <button
              onClick={handleExecute}
              disabled={executing || ready.ready_count === 0}
              className="relative overflow-hidden rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              {executing ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                "Execute Auto-Yield"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Telemetry (visible during/after execution) */}
      {(executing || result) && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <TelemetryCard
            label="Payroll Generated"
            value={livePayroll || result?.payroll.total || 0}
            formatted={formatCurrency(livePayroll || result?.payroll.total || 0)}
            sublabel={`${result?.payroll.lines || liveProcessed} pay lines`}
            color="emerald"
          />
          <TelemetryCard
            label="Revenue Invoiced"
            value={liveAr || result?.ar.total || 0}
            formatted={formatCurrency(liveAr || result?.ar.total || 0)}
            sublabel={`${result?.ar.lines || 0} invoice lines`}
            color="blue"
          />
          <TelemetryCard
            label="Timesheets Processed"
            value={liveProcessed || result?.timesheets_processed || 0}
            formatted={String(liveProcessed || result?.timesheets_processed || 0)}
            sublabel={
              result?.timesheets_failed
                ? `${result.timesheets_failed} failed`
                : "0 failed"
            }
            color="neutral"
          />
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          <StatCard
            label="Payroll (30d)"
            value={formatCurrency(stats.total_payroll_30d)}
          />
          <StatCard
            label="Invoiced (30d)"
            value={formatCurrency(stats.total_invoiced_30d)}
          />
          <StatCard
            label="Processed (7d)"
            value={String(stats.yield_processed_7d)}
          />
          <StatCard
            label="Failed (7d)"
            value={String(stats.yield_failed_7d)}
            isError={stats.yield_failed_7d > 0}
          />
        </div>
      )}

      {/* Split Layout: Pay Runs + Log */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pay Runs */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Pay Runs
          </h3>
          {loading ? (
            <LoadingSpinner />
          ) : payRuns.length === 0 ? (
            <EmptyState text="No pay runs yet" />
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {payRuns.map((pr) => (
                <div
                  key={pr.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {formatCurrency(pr.total_gross)}
                        </span>
                        <StatusBadge status={pr.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {pr.period_start} — {pr.period_end} ·{" "}
                        {pr.worker_count} workers · {pr.total_lines} lines
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {pr.status === "DRAFT" && (
                        <button
                          onClick={() => handleLockPayRun(pr.id)}
                          className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30"
                        >
                          Lock
                        </button>
                      )}
                      {(pr.status === "LOCKED" || pr.status === "DRAFT") && (
                        <button
                          onClick={() => handleExport(pr.id)}
                          className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Processing Log */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Processing Log
          </h3>
          {loading ? (
            <LoadingSpinner />
          ) : log.length === 0 ? (
            <EmptyState text="No processing history" />
          ) : (
            <div className="max-h-[400px] space-y-1 overflow-y-auto">
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-neutral-800/30"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        entry.status === "COMPLETED"
                          ? "bg-emerald-400"
                          : entry.status === "FAILED"
                            ? "bg-red-400"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="text-xs text-neutral-400">
                      {entry.fork}
                    </span>
                    {entry.payroll_amount > 0 && (
                      <span className="text-xs text-emerald-400">
                        +{formatCurrency(entry.payroll_amount)}
                      </span>
                    )}
                    {entry.ar_amount > 0 && (
                      <span className="text-xs text-blue-400">
                        +{formatCurrency(entry.ar_amount)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.processing_ms && (
                      <span className="font-mono text-[10px] text-neutral-600">
                        {entry.processing_ms}ms
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-600">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Errors from last run */}
      {result && result.errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-900/50 bg-red-900/10 p-4">
          <h3 className="mb-2 text-xs font-semibold text-red-400">
            Pipeline Errors ({result.errors.length})
          </h3>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300/70">
                <span className="font-mono text-red-400">
                  {e.timesheet_id.slice(0, 8)}
                </span>{" "}
                — {e.error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function FunnelStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-neutral-600">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function TelemetryCard({
  label,
  formatted,
  sublabel,
  color,
}: {
  label: string;
  value: number;
  formatted: string;
  sublabel: string;
  color: "emerald" | "blue" | "neutral";
}) {
  const colorMap = {
    emerald: "border-emerald-800/50 bg-emerald-900/10",
    blue: "border-blue-800/50 bg-blue-900/10",
    neutral: "border-neutral-800 bg-neutral-900/50",
  };

  const textMap = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    neutral: "text-white",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl font-bold tracking-tight ${textMap[color]}`}
      >
        {formatted}
      </p>
      <p className="mt-0.5 text-xs text-neutral-600">{sublabel}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  isError,
}: {
  label: string;
  value: string;
  isError?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p
        className={`mt-0.5 font-mono text-sm font-semibold ${
          isError ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-neutral-800 text-neutral-400",
    LOCKED: "bg-amber-900/50 text-amber-400",
    APPROVED: "bg-emerald-900/50 text-emerald-400",
    EXPORTED: "bg-blue-900/50 text-blue-400",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        colors[status] || colors.DRAFT
      }`}
    >
      {status}
    </span>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex h-20 items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-20 items-center justify-center">
      <p className="text-xs text-neutral-600">{text}</p>
    </div>
  );
}
