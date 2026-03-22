/**
 * @page /dashboard/analytics
 * @status COMPLETE
 * @description Panopticon BI analytics dashboard — KPI cards, charts, trend analysis, and drill-down views
 * @dataSource react-query via server-action: panopticon-bi actions
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  Activity,
  Database,
  Layers,
  Users,
  Briefcase,
  Calendar,
  GitBranch,
  Loader2,
  CheckCircle2,
  Zap,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  GripVertical,
  Table2,
  LayoutDashboard,
  HeartPulse,
  Eye,
} from "lucide-react";
import {
  getAnalyticsSummary,
  getProfitabilityByCategory,
  getRevenueTrend,
  getWorkerLeaderboard,
  getPivotData,
  refreshAnalyticsViews,
  getJobDrillDown,
  getWorkerDrillDown,
  getLastRefreshTime,
  type AnalyticsSummary,
  type CategoryMetric,
  type RevenueTrend,
  type WorkerLeaderboardEntry,
  type PivotRow,
} from "@/app/actions/panopticon-bi";
import { useOrg } from "@/lib/hooks/use-org";

/* ═══════════════════════════════════════════════════════════════════
   Constants & Types
   ═══════════════════════════════════════════════════════════════════ */

type MainTab = "dashboard" | "pivot" | "health";

const MAIN_TABS: { id: MainTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pivot", label: "Pivot Explorer", icon: Table2 },
  { id: "health", label: "Data Health", icon: HeartPulse },
];

type DateRange = "3M" | "6M" | "YTD" | "12M";
const DATE_RANGES: DateRange[] = ["3M", "6M", "YTD", "12M"];

type PivotSource = "job_profitability" | "worker_utilization" | "ndis_fund_burn" | "trade_estimate_vs_actual";
const PIVOT_SOURCES: { id: PivotSource; label: string }[] = [
  { id: "job_profitability", label: "Job Profitability" },
  { id: "worker_utilization", label: "Worker Utilization" },
  { id: "ndis_fund_burn", label: "NDIS Fund Burn" },
  { id: "trade_estimate_vs_actual", label: "Trade Estimate vs Actual" },
];

const GROUP_PILLS = ["Category", "Branch", "Worker", "Month", "Status"] as const;
type GroupDimension = (typeof GROUP_PILLS)[number];

const MV_VIEWS = [
  { name: "mv_job_profitability", label: "Job Profitability" },
  { name: "mv_worker_utilization", label: "Worker Utilization" },
  { name: "mv_ndis_fund_burn", label: "NDIS Fund Burn" },
  { name: "mv_trade_estimate_vs_actual", label: "Trade Estimate vs Actual" },
];

interface DrillDownData {
  type: "job" | "worker";
  title: string;
  rows: any[];
}

/* ═══════════════════════════════════════════════════════════════════
   Formatters
   ═══════════════════════════════════════════════════════════════════ */

const fmtDollar = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
};

const fmtDollarFull = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
};

const fmtPct = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "0.0%";
  return `${v.toFixed(1)}%`;
};

const fmtNum = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(v));
};

const fmtHours = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "0h";
  return `${v.toFixed(1)}h`;
};

const fmtRelativeTime = (iso: string | null | undefined) => {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};

const marginColor = (pct: number) => {
  if (pct >= 40) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-emerald-500" };
  if (pct >= 20) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", bar: "bg-amber-500" };
  return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", bar: "bg-rose-500" };
};

/* ═══════════════════════════════════════════════════════════════════
   Animation Variants
   ═══════════════════════════════════════════════════════════════════ */

const fadeIn: any = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const cardVariant: any = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ═══════════════════════════════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════════════════════════════ */

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 p-5 animate-pulse">
      <div className="h-3 w-24 rounded bg-zinc-800 mb-4" />
      <div className="h-8 w-36 rounded bg-zinc-800 mb-2" />
      <div className="h-3 w-20 rounded bg-zinc-800" />
    </div>
  );
}

function SkeletonChart({ height = "h-64" }: { height?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 bg-zinc-950 p-5 animate-pulse ${height}`}>
      <div className="h-3 w-32 rounded bg-zinc-800 mb-6" />
      <div className="flex items-end gap-2 h-[calc(100%-3rem)]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-zinc-800/60"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 p-5 animate-pulse">
      <div className="h-3 w-40 rounded bg-zinc-800 mb-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          <div className="h-4 flex-1 rounded bg-zinc-800/60" />
          <div className="h-4 w-16 rounded bg-zinc-800/60" />
          <div className="h-4 w-20 rounded bg-zinc-800/60" />
          <div className="h-4 w-24 rounded bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Progress Ring (SVG)
   ═══════════════════════════════════════════════════════════════════ */

function ProgressRing({ pct, size = 48, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#27272a"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Custom Bar Chart (Revenue Trend)
   ═══════════════════════════════════════════════════════════════════ */

function RevenueBarChart({ data }: { data: RevenueTrend[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.revenue ?? 0), 1), [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        No revenue data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tooltip */}
      <AnimatePresence>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-4 text-xs"
          >
            <span className="text-zinc-400">{(data[hoveredIdx] as any).created_month ?? (data[hoveredIdx] as any).month}</span>
            <span className="text-emerald-400 font-mono">{fmtDollar(data[hoveredIdx].revenue)}</span>
            <span className="text-zinc-500 font-mono">COGS: {fmtDollar(data[hoveredIdx].cogs)}</span>
            <span className="text-zinc-400 font-mono">
              Margin: {fmtPct(data[hoveredIdx].revenue ? ((data[hoveredIdx].revenue - (data[hoveredIdx].cogs ?? 0)) / data[hoveredIdx].revenue) * 100 : 0)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bars */}
      <div className="flex items-end gap-1.5 h-48">
        {data.map((d, i) => {
          const revHeight = ((d.revenue ?? 0) / maxRevenue) * 100;
          const cogsHeight = ((d.cogs ?? 0) / maxRevenue) * 100;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={(d as any).created_month ?? i}
              className="flex-1 flex flex-col items-center gap-0 cursor-pointer group relative"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="w-full flex items-end h-44 relative">
                {/* COGS bar (behind) */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${cogsHeight}%` }}
                  transition={{ duration: 0.6, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute bottom-0 left-0 right-0 rounded-t transition-colors duration-200 ${
                    isHovered ? "bg-zinc-600" : "bg-zinc-700/50"
                  }`}
                />
                {/* Revenue bar (front) */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${revHeight}%` }}
                  transition={{ duration: 0.6, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute bottom-0 left-[15%] right-[15%] rounded-t transition-all duration-200 ${
                    isHovered
                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      : "bg-emerald-500/80"
                  }`}
                />
              </div>
              {/* Month label */}
              <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
                isHovered ? "text-white" : "text-zinc-600"
              }`}>
                {((d as any).created_month ?? "")?.toString().slice(5, 7)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />
          Revenue
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-zinc-700/50" />
          COGS
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Profitability Horizontal Bar Chart
   ═══════════════════════════════════════════════════════════════════ */

function ProfitabilityChart({ data }: { data: CategoryMetric[] }) {
  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.revenue ?? 0), 1), [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        No category data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((cat, i) => {
        const pct = ((cat.revenue ?? 0) / maxRevenue) * 100;
        const mc = marginColor(cat.avg_margin_pct ?? 0);
        return (
          <motion.div
            key={cat.job_category ?? i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-300 truncate max-w-[200px]">
                {cat.job_category ?? "Uncategorised"}
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-zinc-400">{fmtDollar(cat.revenue)}</span>
                <span className={`font-mono font-medium px-1.5 py-0.5 rounded ${mc.bg} ${mc.text}`}>
                  {fmtPct(cat.avg_margin_pct)}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-zinc-800/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${mc.bar} group-hover:brightness-110 transition-all`}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Worker Leaderboard Table
   ═══════════════════════════════════════════════════════════════════ */

function WorkerTable({ data, onRowClick }: { data: WorkerLeaderboardEntry[]; onRowClick: (w: WorkerLeaderboardEntry) => void }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        No worker data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left text-[11px] text-zinc-500 font-medium pb-3 uppercase tracking-wider">Worker</th>
            <th className="text-right text-[11px] text-zinc-500 font-medium pb-3 uppercase tracking-wider">Total Hours</th>
            <th className="text-right text-[11px] text-zinc-500 font-medium pb-3 uppercase tracking-wider">Billable</th>
            <th className="text-right text-[11px] text-zinc-500 font-medium pb-3 uppercase tracking-wider w-36">Utilization</th>
            <th className="text-right text-[11px] text-zinc-500 font-medium pb-3 uppercase tracking-wider">OT Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((w, i) => {
            const util = w.avg_utilization_pct ?? 0;
            const utilColor = util >= 80 ? "bg-emerald-500" : util >= 60 ? "bg-amber-500" : "bg-rose-500";
            return (
              <motion.tr
                key={w.worker_name ?? i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => onRowClick(w)}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-medium shrink-0">
                      {(w.worker_name ?? "?")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <span className="text-zinc-200 truncate">{w.worker_name ?? "Unknown"}</span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-zinc-400">{fmtHours(w.total_hours)}</td>
                <td className="py-3 text-right font-mono text-zinc-400">{fmtHours(w.billable_hours)}</td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(util, 100)}%` }}
                        transition={{ duration: 0.6, delay: i * 0.03 }}
                        className={`h-full rounded-full ${utilColor}`}
                      />
                    </div>
                    <span className="font-mono text-zinc-400 w-12 text-right text-xs">{fmtPct(util)}</span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono">
                  <span className={(w.overtime_cost ?? 0) > 0 ? "text-rose-400" : "text-zinc-600"}>
                    {fmtDollar(w.overtime_cost)}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Drill-Down Slide-Over
   ═══════════════════════════════════════════════════════════════════ */

function DrillDownPanel({
  data,
  onClose,
}: {
  data: DrillDownData;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 220 }}
      className="fixed top-0 right-0 bottom-0 w-[420px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-0.5">Drill Down</p>
          <h3 className="text-white font-medium text-sm truncate max-w-[300px]">{data.title}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {data.rows.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center mt-8">No detail records found.</p>
        ) : (
          data.rows.map((row: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-lg border border-white/5 bg-zinc-900/50 p-3 text-xs space-y-1"
            >
              {Object.entries(row).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-zinc-500 capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="text-zinc-300 font-mono">
                    {typeof v === "number"
                      ? k.includes("cost") || k.includes("revenue") || k.includes("amount")
                        ? fmtDollarFull(v)
                        : k.includes("pct") || k.includes("percent") || k.includes("margin")
                        ? fmtPct(v)
                        : fmtNum(v)
                      : String(v ?? "—")}
                  </span>
                </div>
              ))}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Pivot Table
   ═══════════════════════════════════════════════════════════════════ */

function PivotTable({
  data,
  groupBy,
  onDrillDown,
}: {
  data: PivotRow[];
  groupBy: GroupDimension | null;
  onDrillDown: (row: PivotRow) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    if (!groupBy || !data.length) return null;
    const key = groupBy.toLowerCase();
    const groups: Record<string, PivotRow[]> = {};
    for (const row of data) {
      const gk = String((row as any)[key] ?? "Other");
      if (!groups[gk]) groups[gk] = [];
      groups[gk].push(row);
    }
    return groups;
  }, [data, groupBy]);

  const toggleGroup = (gk: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gk)) next.delete(gk);
      else next.add(gk);
      return next;
    });
  };

  // Determine numeric columns from first row
  const numericCols = useMemo(() => {
    if (!data.length) return [];
    const first = data[0];
    return Object.keys(first).filter((k) => typeof (first as any)[k] === "number");
  }, [data]);

  const allCols = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]);
  }, [data]);

  const calcSubtotals = useCallback(
    (rows: PivotRow[]) => {
      const totals: Record<string, number> = {};
      for (const col of numericCols) {
        const vals = rows.map((r) => (r as any)[col] ?? 0);
        if (col.includes("pct") || col.includes("percent") || col.includes("margin") || col.includes("utilization")) {
          totals[col] = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        } else {
          totals[col] = vals.reduce((a, b) => a + b, 0);
        }
      }
      return totals;
    },
    [numericCols]
  );

  const formatCell = (col: string, val: any) => {
    if (val == null) return "—";
    if (typeof val === "number") {
      if (col.includes("cost") || col.includes("revenue") || col.includes("amount") || col.includes("total") || col.includes("budget"))
        return fmtDollar(val);
      if (col.includes("pct") || col.includes("percent") || col.includes("margin") || col.includes("utilization"))
        return fmtPct(val);
      if (col.includes("hours")) return fmtHours(val);
      return fmtNum(val);
    }
    return String(val);
  };

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
        <Table2 size={32} className="mb-3 text-zinc-700" />
        <p className="text-sm">Select a data source and click a group dimension to explore.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5">
            {grouped && <th className="w-8" />}
            {allCols.map((col) => (
              <th
                key={col}
                className={`text-[10px] font-medium uppercase tracking-wider pb-2.5 px-2 ${
                  numericCols.includes(col) ? "text-right text-zinc-500" : "text-left text-zinc-500"
                }`}
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped
            ? Object.entries(grouped).map(([gk, rows]) => {
                const isExpanded = expandedGroups.has(gk);
                const subtotals = calcSubtotals(rows);
                return (
                  <React.Fragment key={gk}>
                    {/* Group header */}
                    <tr
                      className="border-b border-white/[0.03] bg-zinc-900/30 cursor-pointer hover:bg-zinc-900/50 transition-colors"
                      onClick={() => toggleGroup(gk)}
                    >
                      <td className="py-2.5 pl-2">
                        <ChevronRight
                          size={12}
                          className={`text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </td>
                      <td className="py-2.5 px-2 font-medium text-zinc-200" colSpan={1}>
                        {gk}
                        <span className="ml-2 text-zinc-600">({rows.length})</span>
                      </td>
                      {allCols.slice(1).map((col) => (
                        <td
                          key={col}
                          className={`py-2.5 px-2 font-mono font-medium ${
                            numericCols.includes(col) ? "text-right text-emerald-400/70" : "text-zinc-500"
                          }`}
                        >
                          {numericCols.includes(col) ? formatCell(col, subtotals[col]) : ""}
                        </td>
                      ))}
                    </tr>
                    {/* Expanded rows */}
                    <AnimatePresence>
                      {isExpanded &&
                        rows.map((row, ri) => (
                          <motion.tr
                            key={ri}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                            onClick={() => onDrillDown(row)}
                          >
                            <td />
                            {allCols.map((col) => (
                              <td
                                key={col}
                                className={`py-2 px-2 ${
                                  numericCols.includes(col)
                                    ? "text-right font-mono text-zinc-400"
                                    : "text-zinc-300"
                                }`}
                              >
                                {formatCell(col, (row as any)[col])}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            : data.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => onDrillDown(row)}
                >
                  {allCols.map((col) => (
                    <td
                      key={col}
                      className={`py-2 px-2 ${
                        numericCols.includes(col)
                          ? "text-right font-mono text-zinc-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {formatCell(col, (row as any)[col])}
                    </td>
                  ))}
                </motion.tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function AnalyticsPage() {
  const { orgId, loading: orgLoading } = useOrg();

  /* ── State ──────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>("6M");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pivot state
  const [pivotSource, setPivotSource] = useState<PivotSource>("job_profitability");
  const [pivotGroupBy, setPivotGroupBy] = useState<GroupDimension | null>(null);
  const [pivotSourceOpen, setPivotSourceOpen] = useState(false);

  // Drill-down state
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const queryClient = useQueryClient();

  /* ── Helpers ────────────────────────────────────────────── */
  const monthsFromRange = useCallback((range: DateRange): number => {
    switch (range) {
      case "3M": return 3;
      case "6M": return 6;
      case "YTD": return new Date().getMonth() + 1;
      case "12M": return 12;
    }
  }, []);

  const months = monthsFromRange(dateRange);

  /* ── Data fetching: Dashboard ───────────────────────────── */
  const { data: dashData, isLoading: dashLoading } = useQuery<{
    summary: AnalyticsSummary | null;
    profitability: CategoryMetric[];
    revenueTrend: RevenueTrend[];
    leaderboard: WorkerLeaderboardEntry[];
    lastRefresh: string | null;
  }>({
    queryKey: [...queryKeys.analytics.dashboard(orgId!), dateRange],
    queryFn: async () => {
      const [summaryRes, profitRes, trendRes, leaderRes, refreshRes] = await Promise.all([
        getAnalyticsSummary(orgId!, months),
        getProfitabilityByCategory(orgId!, months),
        getRevenueTrend(orgId!, months),
        getWorkerLeaderboard(orgId!, months),
        getLastRefreshTime(),
      ]);
      return {
        summary: (summaryRes as any)?.data ?? null,
        profitability: (profitRes as any)?.data ?? [],
        revenueTrend: (trendRes as any)?.data ?? [],
        leaderboard: (leaderRes as any)?.data ?? [],
        lastRefresh: (refreshRes as any)?.data?.last_refresh ?? null,
      };
    },
    enabled: !!orgId && activeTab === "dashboard",
  });

  const summary = dashData?.summary ?? null;
  const profitability = dashData?.profitability ?? [];
  const revenueTrend = dashData?.revenueTrend ?? [];
  const leaderboard = dashData?.leaderboard ?? [];
  const lastRefresh = dashData?.lastRefresh ?? null;

  /* ── Data fetching: Pivot ───────────────────────────────── */
  const { data: pivotData = [], isLoading: pivotLoading } = useQuery<PivotRow[]>({
    queryKey: [...queryKeys.analytics.dashboard(orgId!), "pivot", pivotSource, dateRange],
    queryFn: async () => {
      const res = await getPivotData(orgId!, pivotSource, months);
      return (res as any)?.data ?? [];
    },
    enabled: !!orgId && activeTab === "pivot",
  });

  /* ── Refresh handler ────────────────────────────────────── */
  const handleRefresh = useCallback(async () => {
    if (!orgId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshAnalyticsViews(orgId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard(orgId) });
    } catch (err: any) {
      setError(err?.message ?? "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }, [orgId, isRefreshing, queryClient]);

  /* ── Drill-down handler ─────────────────────────────────── */
  const handleDrillDown = useCallback(
    async (row: any, type: "job" | "worker" = "job") => {
      if (!orgId) return;
      setDrillLoading(true);
      try {
        const id = row.id ?? row.job_id ?? row.worker_id ?? row.category ?? "";
        let res: any[];
        let title: string;
        if (type === "worker" || row.worker_name) {
          const drillRes = await getWorkerDrillDown(orgId, String(id));
          res = (drillRes as any)?.data ?? [];
          title = row.worker_name ?? "Worker Detail";
        } else {
          const jobRes = await getJobDrillDown(orgId, String(id));
          res = (jobRes as any)?.data ?? [];
          title = row.category ?? row.name ?? "Job Detail";
        }
        setDrillDown({ type, title, rows: res });
      } catch (err: any) {
        console.error("Drill-down failed:", err);
      } finally {
        setDrillLoading(false);
      }
    },
    [orgId]
  );

  /* ── Computed values ────────────────────────────────────── */
  const nextRefreshMins = useMemo(() => {
    if (!lastRefresh) return null;
    try {
      const last = new Date(lastRefresh);
      const next = new Date(last.getTime() + 60 * 60 * 1000); // 1 hour cycle
      const diffMs = next.getTime() - Date.now();
      return Math.max(0, Math.ceil(diffMs / 60000));
    } catch {
      return null;
    }
  }, [lastRefresh]);

  /* ── KPI Data ───────────────────────────────────────────── */
  const kpis = useMemo(() => {
    if (!summary) return [];
    const margin = summary.blended_margin_pct ?? 0;
    const wip = summary.unbilled_wip ?? 0;
    return [
      {
        label: "Total Revenue",
        value: fmtDollar(summary.total_revenue),
        icon: DollarSign,
        trend: undefined as any,
        trendLabel: "vs prev period",
        color: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
      },
      {
        label: "Blended Gross Margin",
        value: fmtPct(margin),
        icon: TrendingUp,
        color: margin >= 40 ? "text-emerald-400" : margin >= 20 ? "text-amber-400" : "text-rose-400",
        iconBg: margin >= 40 ? "bg-emerald-500/10" : margin >= 20 ? "bg-amber-500/10" : "bg-rose-500/10",
        subtext: margin < 20 ? "Below target" : margin < 40 ? "Needs attention" : "Healthy",
      },
      {
        label: "Unbilled WIP",
        value: fmtDollar(wip),
        icon: Clock,
        color: wip > 10000 ? "text-amber-400" : "text-zinc-300",
        iconBg: wip > 10000 ? "bg-amber-500/10" : "bg-zinc-800",
        warning: wip > 10000,
        subtext: wip > 10000 ? "Exceeds $10k threshold" : undefined,
      },
      {
        label: "Labor Utilization",
        value: fmtPct(summary.labor_utilization_pct),
        icon: Users,
        color: "text-zinc-300",
        iconBg: "bg-zinc-800",
        ring: summary.labor_utilization_pct,
      },
      {
        label: "Overtime Leakage",
        value: fmtDollar(summary.overtime_leakage),
        icon: AlertTriangle,
        color: (summary.overtime_leakage ?? 0) > 0 ? "text-rose-400" : "text-zinc-500",
        iconBg: (summary.overtime_leakage ?? 0) > 0 ? "bg-rose-500/10" : "bg-zinc-800",
      },
    ];
  }, [summary]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505]">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* ── Error Banner ──────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm text-rose-400">
              <AlertTriangle size={14} />
              {error}
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-300">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-6 py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <BarChart3 size={18} className="text-emerald-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight">Panopticon BI</h1>
                <p className="text-xs text-zinc-500">Enterprise Analytics & Pivot Explorer</p>
              </div>
            </div>

            {/* Refresh status + button */}
            <div className="flex items-center gap-3">
              {lastRefresh && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-900/50 rounded-lg px-3 py-1.5 border border-white/5">
                  <div className="relative">
                    <Clock size={11} />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <span>
                    Data current as of {fmtRelativeTime(lastRefresh)}
                    {nextRefreshMins != null && (
                      <span className="text-zinc-600"> · Next refresh in {nextRefreshMins}m</span>
                    )}
                  </span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-xs text-zinc-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                {isRefreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Tab pills */}
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-0.5 border border-white/5">
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date range pills */}
            <div className="flex items-center gap-1">
              {DATE_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                    dateRange === range
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────── */}
      <div className="px-6 py-6">
        <AnimatePresence mode="wait">
          {/* ════════════ TAB 1: DASHBOARD ════════════ */}
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" {...fadeIn}>
              {dashLoading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <SkeletonChart height="h-80" />
                    <SkeletonChart height="h-80" />
                  </div>
                  <SkeletonTable />
                </div>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
                  {/* KPI Ribbon */}
                  <div className="grid grid-cols-5 gap-4">
                    {kpis.map((kpi, i) => (
                      <motion.div
                        key={kpi.label}
                        variants={cardVariant}
                        className={`rounded-xl border bg-zinc-950 p-5 relative overflow-hidden group hover:border-white/10 transition-colors ${
                          kpi.warning ? "border-amber-500/20" : "border-white/5"
                        }`}
                      >
                        {/* Subtle gradient glow */}
                        <div
                          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                            kpi.warning ? "bg-gradient-to-br from-amber-500/5 to-transparent" : "bg-gradient-to-br from-white/[0.02] to-transparent"
                          }`}
                        />

                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
                              {kpi.label}
                            </span>
                            <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                              <kpi.icon size={14} className={kpi.color} />
                            </div>
                          </div>

                          <div className="flex items-end gap-3">
                            <div>
                              <p className={`text-2xl font-semibold font-mono tracking-tight ${kpi.color}`}>
                                {kpi.value}
                              </p>
                              {kpi.trend != null && (
                                <div className="flex items-center gap-1 mt-1">
                                  {kpi.trend >= 0 ? (
                                    <ArrowUpRight size={11} className="text-emerald-500" />
                                  ) : (
                                    <ArrowDownRight size={11} className="text-rose-500" />
                                  )}
                                  <span
                                    className={`text-[11px] font-mono ${
                                      kpi.trend >= 0 ? "text-emerald-500" : "text-rose-500"
                                    }`}
                                  >
                                    {kpi.trend >= 0 ? "+" : ""}
                                    {fmtPct(kpi.trend)}
                                  </span>
                                  <span className="text-[10px] text-zinc-600">{kpi.trendLabel}</span>
                                </div>
                              )}
                              {kpi.subtext && (
                                <p className={`text-[10px] mt-1 ${kpi.warning ? "text-amber-500" : "text-zinc-600"}`}>
                                  {kpi.subtext}
                                </p>
                              )}
                            </div>
                            {kpi.ring != null && (
                              <div className="ml-auto">
                                <ProgressRing pct={kpi.ring} size={40} stroke={3} />
                              </div>
                            )}
                          </div>

                          {kpi.warning && (
                            <div className="absolute top-3 right-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Revenue Trend */}
                    <motion.div
                      variants={cardVariant}
                      className="rounded-xl border border-white/5 bg-zinc-950 p-5"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-sm font-medium text-white">Revenue Trend</h3>
                          <p className="text-[11px] text-zinc-600 mt-0.5">Monthly revenue vs cost of goods sold</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-zinc-800">
                          <BarChart3 size={14} className="text-zinc-500" />
                        </div>
                      </div>
                      <RevenueBarChart data={revenueTrend} />
                    </motion.div>

                    {/* Profitability by Category */}
                    <motion.div
                      variants={cardVariant}
                      className="rounded-xl border border-white/5 bg-zinc-950 p-5"
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-sm font-medium text-white">Profitability by Category</h3>
                          <p className="text-[11px] text-zinc-600 mt-0.5">Revenue and margin by job category</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-zinc-800">
                          <PieChart size={14} className="text-zinc-500" />
                        </div>
                      </div>
                      <ProfitabilityChart data={profitability} />
                    </motion.div>
                  </div>

                  {/* Worker Leaderboard */}
                  <motion.div
                    variants={cardVariant}
                    className="rounded-xl border border-white/5 bg-zinc-950 p-5"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-sm font-medium text-white">Worker Leaderboard</h3>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          Hours, utilization, and overtime by team member
                        </p>
                      </div>
                      <div className="p-1.5 rounded-lg bg-zinc-800">
                        <Users size={14} className="text-zinc-500" />
                      </div>
                    </div>
                    <WorkerTable
                      data={leaderboard}
                      onRowClick={(w) =>
                        handleDrillDown(w, "worker")
                      }
                    />
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ════════════ TAB 2: PIVOT EXPLORER ════════════ */}
          {activeTab === "pivot" && (
            <motion.div key="pivot" {...fadeIn} className="space-y-5">
              {/* Controls */}
              <div className="flex items-center justify-between">
                {/* Data source dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setPivotSourceOpen(!pivotSourceOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/70 border border-white/5 text-sm text-zinc-300 hover:border-white/10 transition-colors"
                  >
                    <Database size={13} className="text-zinc-500" />
                    {PIVOT_SOURCES.find((s) => s.id === pivotSource)?.label}
                    <ChevronDown size={13} className="text-zinc-600" />
                  </button>
                  <AnimatePresence>
                    {pivotSourceOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        className="absolute top-full left-0 mt-1 w-56 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl z-30 overflow-hidden"
                      >
                        {PIVOT_SOURCES.map((src) => (
                          <button
                            key={src.id}
                            onClick={() => {
                              setPivotSource(src.id);
                              setPivotSourceOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors ${
                              pivotSource === src.id
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-zinc-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {src.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Group By pills */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 uppercase tracking-wider mr-2">Group by</span>
                  {GROUP_PILLS.map((pill) => (
                    <button
                      key={pill}
                      onClick={() => setPivotGroupBy(pivotGroupBy === pill ? null : pill)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                        pivotGroupBy === pill
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10"
                      }`}
                    >
                      <GripVertical size={10} className="opacity-50" />
                      {pill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pivot Table */}
              <div className="rounded-xl border border-white/5 bg-zinc-950 p-5 min-h-[400px]">
                {pivotLoading ? (
                  <SkeletonTable />
                ) : (
                  <PivotTable
                    data={pivotData}
                    groupBy={pivotGroupBy}
                    onDrillDown={(row) => handleDrillDown(row, "job")}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════ TAB 3: DATA HEALTH ════════════ */}
          {activeTab === "health" && (
            <motion.div key="health" {...fadeIn} className="space-y-6">
              {/* Refresh Status */}
              <motion.div variants={cardVariant} className="rounded-xl border border-white/5 bg-zinc-950 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-white">Refresh Status</h3>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Materialized view refresh cycle and data freshness
                    </p>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                    {isRefreshing ? "Refreshing all views…" : "Refresh All Views"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-900/50 border border-white/5 p-4">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Last Refresh</p>
                    <p className="text-sm font-mono text-white">{fmtRelativeTime(lastRefresh)}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900/50 border border-white/5 p-4">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Refresh Cycle</p>
                    <p className="text-sm font-mono text-white">Every 60 minutes</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900/50 border border-white/5 p-4">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Next Refresh</p>
                    <p className="text-sm font-mono text-white">
                      {nextRefreshMins != null ? `In ${nextRefreshMins} minutes` : "—"}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Materialized View Cards */}
              <div>
                <h3 className="text-sm font-medium text-white mb-4">Materialized Views</h3>
                <div className="grid grid-cols-2 gap-4">
                  {MV_VIEWS.map((mv, i) => (
                    <motion.div
                      key={mv.name}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-xl border border-white/5 bg-zinc-950 p-5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-200">{mv.label}</h4>
                          <p className="text-[11px] font-mono text-zinc-600 mt-0.5">{mv.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Rows</p>
                          <p className="text-sm font-mono text-zinc-300 mt-0.5">—</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Last Refresh</p>
                          <p className="text-sm font-mono text-zinc-300 mt-0.5">
                            {fmtRelativeTime(lastRefresh)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Duration</p>
                          <p className="text-sm font-mono text-zinc-300 mt-0.5">—</p>
                        </div>
                      </div>

                      <div className="mt-4 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, delay: i * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-500/20"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Data Quality Checks */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl border border-white/5 bg-zinc-950 p-5"
              >
                <h3 className="text-sm font-medium text-white mb-4">Data Quality Checks</h3>
                <div className="space-y-2">
                  {[
                    { check: "RLS policies on analytics views", status: "pass" },
                    { check: "Indexes on date/org_id columns", status: "pass" },
                    { check: "No orphaned records in job_line_items", status: "pass" },
                    { check: "Worker hours match timesheet entries", status: "warn" },
                    { check: "All invoices linked to jobs", status: "pass" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.status === "pass" ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-500" />
                        )}
                        <span className="text-sm text-zinc-300">{item.check}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.status === "pass"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Drill-Down Slide-Over ─────────────────────────── */}
      <AnimatePresence>
        {drillDown && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setDrillDown(null)}
            />
            <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />
          </>
        )}
      </AnimatePresence>

      {/* Loading overlay for drill-down */}
      <AnimatePresence>
        {drillLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"
          >
            <div className="bg-zinc-900 rounded-xl border border-white/10 px-6 py-4 flex items-center gap-3 shadow-2xl">
              <Loader2 size={16} className="animate-spin text-emerald-500" />
              <span className="text-sm text-zinc-300">Loading details…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
