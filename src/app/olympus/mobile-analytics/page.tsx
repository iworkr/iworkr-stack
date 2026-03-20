"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Flutter Mobile Telemetry & Analytics
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, BarChart, DonutChart } from "@tremor/react";
import { RefreshCw, Smartphone } from "lucide-react";
import {
  getMobileStats,
  type MobileStatsResult,
} from "@/app/actions/olympus-mobile";

const RANGE_DAYS = [7, 30, 90] as const;

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatAvgSeconds(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export default function OlympusMobileAnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_DAYS)[number]>(30);
  const [stats, setStats] = useState<MobileStatsResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await getMobileStats(rangeDays);
      if (res && "error" in res) {
        setAuthError(res.error);
        setStats(null);
        return;
      }
      setStats(res);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const lineData = useMemo(
    () =>
      (stats?.dau ?? []).map((d) => ({
        date: d.date,
        DAU: d.count,
      })),
    [stats?.dau],
  );

  const barData = useMemo(
    () =>
      (stats?.screens ?? []).map((s) => ({
        screen:
          s.screen.length > 42 ? `${s.screen.slice(0, 40)}…` : s.screen,
        visits: s.count,
      })),
    [stats?.screens],
  );

  const donutData = useMemo(
    () =>
      (stats?.versions ?? []).map((v) => ({
        name: v.version,
        value: v.count,
      })),
    [stats?.versions],
  );

  const tremorColors = useMemo(
    () => ["emerald", "cyan", "amber", "violet", "fuchsia", "pink", "rose", "zinc"],
    [],
  );

  return (
    <div className="min-h-full bg-black text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-[#222] px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-[#222] bg-zinc-950 text-emerald-500/90">
              <Smartphone size={16} strokeWidth={1.75} />
            </div>
            <div>
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-emerald-500/70 uppercase">
                MOBILE ANALYTICS
              </span>
              <h1 className="mt-1 text-[16px] font-semibold tracking-tight text-white">
                Flutter Session Intelligence
              </h1>
              <p className="mt-1 font-sans text-[10px] text-zinc-600">
                system_telemetry · Dart / Flutter UA · platform mobile_ios ·
                mobile_android
              </p>
              <p className="mt-0.5 font-sans text-[10px] text-zinc-600">
                Last refreshed:{" "}
                {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-[#222] bg-zinc-950 p-0.5">
              {RANGE_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRangeDays(d)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors ${
                    rangeDays === d
                      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-[#222] bg-zinc-950 px-3 py-1.5 font-mono text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {authError && (
        <div className="mx-8 mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[11px] text-red-300">
          {authError}
        </div>
      )}

      <div className="space-y-8 p-8">
        {/* Metrics ribbon */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "DAU (today)",
              value: loading ? "—" : (stats?.dauToday ?? 0).toLocaleString(),
              hint: "Distinct user_ids · UTC day",
            },
            {
              label: "MAU (this month)",
              value: loading ? "—" : (stats?.mauMonth ?? 0).toLocaleString(),
              hint: "Distinct user_ids · month to date",
            },
            {
              label: "Avg session duration",
              value: loading
                ? "—"
                : formatAvgSeconds(stats?.avgSessionSeconds ?? null),
              hint: "From payload duration fields",
            },
            {
              label: "App version fragmentation",
              value: loading
                ? "—"
                : (stats?.distinctVersionCount ?? 0).toLocaleString(),
              hint: "Distinct app_version values",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[#222] bg-zinc-950 p-4"
            >
              <p className="font-sans text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {card.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-zinc-100">
                {card.value}
              </p>
              <p className="mt-1 font-mono text-[9px] text-zinc-600">{card.hint}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-xl border border-[#222] bg-zinc-950 p-4 xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                DAU over time
              </span>
              <span className="font-mono text-[9px] text-zinc-600">
                Last 30 days · UTC
              </span>
            </div>
            <div className="dark">
              <LineChart
                className="h-72"
                data={lineData}
                index="date"
                categories={["DAU"]}
                colors={["emerald"]}
                showLegend={false}
                curveType="monotone"
                valueFormatter={(v) => v.toLocaleString()}
                yAxisWidth={48}
                noDataText="No mobile telemetry in window"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#222] bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                App versions
              </span>
              <span className="font-mono text-[9px] text-zinc-600">
                payload.app_version
              </span>
            </div>
            <div className="dark">
              <DonutChart
                className="h-72"
                data={donutData}
                category="value"
                index="name"
                colors={tremorColors}
                showLabel
                valueFormatter={(v) => v.toLocaleString()}
                noDataText="No version data"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#222] bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Most visited screens
            </span>
            <span className="font-mono text-[9px] text-zinc-600">
              Top 10 url_path · {rangeDays}d window
            </span>
          </div>
          <div className="dark">
            <BarChart
              className="h-80"
              data={barData}
              index="screen"
              categories={["visits"]}
              colors={["emerald"]}
              layout="vertical"
              showLegend={false}
              valueFormatter={(v) => v.toLocaleString()}
              yAxisWidth={120}
              noDataText="No screen hits"
            />
          </div>
        </div>

        {/* User journey */}
        <div className="rounded-xl border border-[#222] bg-zinc-950">
          <div className="border-b border-[#222] px-4 py-3">
            <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
              User journey · recent mobile sessions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-[#222] text-zinc-500">
                  <th className="px-4 py-2 font-medium">Timestamp</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Screen</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center font-mono text-zinc-600"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading &&
                  (stats?.sessions?.length ?? 0) === 0 &&
                  !authError && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center font-mono text-zinc-600"
                      >
                        No mobile sessions in range.
                      </td>
                    </tr>
                  )}
                {!loading &&
                  (stats?.sessions ?? []).map((row, i) => (
                    <tr
                      key={`${row.created_at}-${i}`}
                      className="border-b border-[#222]/80 font-mono text-zinc-300"
                    >
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-400">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-2 text-zinc-300">
                        {row.user_id ?? "—"}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-2 text-zinc-400">
                        {row.url_path ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-400">
                        {formatDuration(row.duration_ms)}
                      </td>
                      <td className="max-w-[320px] truncate px-4 py-2 text-zinc-500">
                        {row.user_agent ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
