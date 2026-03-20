"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Argus-Panopticon System Telemetry
   ═══════════════════════════════════════════════════════════════════ */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ScatterChart, BarChart } from "@tremor/react";
import { RefreshCw, Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getTelemetryDashboardStats,
  getLatencyTimeSeries,
  getErrorsByHour,
  listSystemTelemetry,
  type SystemTelemetryRow,
  type TelemetryDashboardStats,
} from "@/app/actions/system-telemetry";

const PAGE_SIZE = 25;

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
] as const;

const SEVERITY_FILTER = ["", "INFO", "WARN", "ERROR", "FATAL"] as const;

const CATEGORY_FILTER = [
  "",
  "WEB_VITALS",
  "CONSOLE_ERROR",
  "NETWORK_LATENCY",
  "REACT_CRASH",
  "UNHANDLED_ERROR",
] as const;

function payloadMessage(payload: Record<string, unknown>): string {
  const m = payload.message;
  return typeof m === "string" ? m : "";
}

function severityBadgeClass(sev: string): string {
  switch (sev) {
    case "FATAL":
    case "ERROR":
      return "bg-red-500/15 text-red-400 ring-1 ring-red-500/25";
    case "WARN":
      return "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25";
    case "INFO":
      return "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20";
    default:
      return "bg-zinc-500/15 text-zinc-400 ring-1 ring-white/10";
  }
}

function healthStatus(errorRate: number): { label: string; className: string } {
  if (errorRate < 1) {
    return { label: "NOMINAL", className: "text-emerald-400" };
  }
  if (errorRate < 5) {
    return { label: "ELEVATED", className: "text-amber-400" };
  }
  return { label: "CRITICAL", className: "text-red-400" };
}

export default function OlympusTelemetryPage() {
  const [hours, setHours] = useState(24);
  const [stats, setStats] = useState<TelemetryDashboardStats | null>(null);
  const [latencyRows, setLatencyRows] = useState<
    Awaited<ReturnType<typeof getLatencyTimeSeries>>
  >([]);
  const [errorsByHour, setErrorsByHour] = useState<
    Awaited<ReturnType<typeof getErrorsByHour>>
  >([]);
  const [rows, setRows] = useState<SystemTelemetryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const sinceIso = useMemo(
    () => new Date(Date.now() - hours * 3600_000).toISOString(),
    [hours],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadCharts = useCallback(async () => {
    setLoading(true);
    try {
      const [s, lat, err] = await Promise.all([
        getTelemetryDashboardStats(hours),
        getLatencyTimeSeries(hours),
        getErrorsByHour(hours),
      ]);
      setStats(s);
      setLatencyRows(lat);
      setErrorsByHour(err);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [hours]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const { data, total: t } = await listSystemTelemetry({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        severity: severity || undefined,
        category: category || undefined,
        search: debouncedSearch || undefined,
        since: sinceIso,
      });
      setRows(data);
      setTotal(t);
    } finally {
      setListLoading(false);
    }
  }, [page, severity, category, debouncedSearch, sinceIso]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCharts(), loadList()]);
  }, [loadCharts, loadList]);

  useEffect(() => {
    void loadCharts();
  }, [loadCharts]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setPage(0);
  }, [hours, severity, category, debouncedSearch]);

  const scatterData = useMemo(
    () =>
      latencyRows.map((r) => ({
        ts: new Date(r.created_at).getTime(),
        duration_ms: r.duration_ms,
        severity: r.severity,
      })),
    [latencyRows],
  );

  const barData = useMemo(
    () =>
      errorsByHour.map((row) => ({
        ...row,
        hourLabel: new Date(row.hour).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [errorsByHour],
  );

  const errorRate = stats?.error_rate ?? 0;
  const status = healthStatus(errorRate);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rangeLabel = TIME_RANGES.find((r) => r.hours === hours)?.label ?? `${hours}h`;

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (severity) params.set("severity", severity);
      if (category) params.set("category", category);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("since", sinceIso);
      const res = await fetch(`/api/telemetry/export?${params.toString()}`);
      if (!res.ok) {
        console.error("Export failed", res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `telemetry-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-full bg-black text-zinc-100">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/[0.04] px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
              TELEMETRY
            </span>
            <h1 className="mt-1 text-[15px] font-semibold text-white">
              Argus-Panopticon Observability
            </h1>
            <p className="mt-1 font-sans text-[10px] text-zinc-600">
              Last refreshed: {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setHours(r.hours)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors ${
                    hours === r.hours
                      ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/20"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Download size={12} className={exporting ? "animate-pulse" : ""} />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading || listLoading}
              className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={loading || listLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-8">
        {/* Metrics ribbon */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Total events ({rangeLabel})
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-100">
              {loading ? "—" : (stats?.total_24h ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Error rate
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-100">
              {loading ? "—" : `${errorRate.toFixed(2)}%`}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Errors ({rangeLabel})
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-100">
              {loading ? "—" : (stats?.errors_24h ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Status
            </p>
            <p
              className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${loading ? "text-zinc-600" : status.className}`}
            >
              {loading ? "—" : status.label}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Network latency
              </span>
              <span className="font-mono text-[9px] text-zinc-600">duration_ms vs time</span>
            </div>
            <div className="dark">
              <ScatterChart
                className="h-72"
                data={scatterData}
                x="ts"
                y="duration_ms"
                category="severity"
                colors={["emerald", "amber", "red", "rose", "zinc"]}
                showOpacity
                showLegend
                minYValue={0}
                valueFormatter={{
                  x: (v) => new Date(Number(v)).toLocaleString(),
                  y: (v) => `${v} ms`,
                }}
                noDataText="No latency samples in range"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Error spikes by hour
              </span>
              <span className="font-mono text-[9px] text-zinc-600">stacked by category</span>
            </div>
            <div className="dark">
              <BarChart
                className="h-72"
                data={barData}
                index="hourLabel"
                categories={[
                  "CONSOLE_ERROR",
                  "REACT_CRASH",
                  "NETWORK_LATENCY",
                  "UNHANDLED_ERROR",
                ]}
                colors={["red", "rose", "amber", "zinc"]}
                stack
                showLegend
                valueFormatter={(v) => v.toLocaleString()}
                noDataText="No errors in range"
              />
            </div>
          </div>
        </div>

        {/* Forensic log explorer */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
              Forensic log explorer
            </span>
          </div>

          <div className="flex flex-wrap gap-3 border-b border-white/[0.04] px-4 py-3">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="rounded-md border border-white/[0.06] bg-black px-2 py-1.5 font-sans text-[11px] text-zinc-200 outline-none focus:ring-1 focus:ring-red-500/40"
            >
              {SEVERITY_FILTER.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? s : "All severities"}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-white/[0.06] bg-black px-2 py-1.5 font-sans text-[11px] text-zinc-200 outline-none focus:ring-1 focus:ring-red-500/40"
            >
              {CATEGORY_FILTER.map((c) => (
                <option key={c || "all"} value={c}>
                  {c ? c : "All categories"}
                </option>
              ))}
            </select>
            <input
              type="search"
              placeholder="Search path or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md border border-white/[0.06] bg-black px-3 py-1.5 font-sans text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-500">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Path</th>
                  <th className="px-4 py-2 font-medium">Message</th>
                  <th className="px-4 py-2 font-medium">Workspace ID</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-mono text-zinc-600">
                      Loading…
                    </td>
                  </tr>
                )}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-mono text-zinc-600">
                      No rows match filters.
                    </td>
                  </tr>
                )}
                {!listLoading &&
                  rows.map((row) => {
                    const open = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => setExpandedId(open ? null : row.id)}
                          className="cursor-pointer border-b border-white/[0.04] font-mono text-zinc-300 transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="whitespace-nowrap px-4 py-2 text-zinc-400">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${severityBadgeClass(row.severity)}`}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-zinc-400">{row.event_category}</td>
                          <td className="max-w-[180px] truncate px-4 py-2 text-zinc-500">
                            {row.url_path ?? "—"}
                          </td>
                          <td className="max-w-[240px] truncate px-4 py-2 text-zinc-400">
                            {payloadMessage(row.payload) || "—"}
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-2 text-zinc-500">
                            {row.workspace_id ?? "—"}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-white/[0.06] bg-black/40">
                            <td colSpan={6} className="px-4 py-3">
                              <pre className="max-h-64 overflow-auto rounded-lg border border-white/[0.06] bg-black p-3 font-mono text-[10px] leading-relaxed text-zinc-400">
                                {JSON.stringify(row.payload, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
            <span className="font-mono text-[10px] text-zinc-600">
              {total.toLocaleString()} total · page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 0 || listLoading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages - 1 || listLoading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
