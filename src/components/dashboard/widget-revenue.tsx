"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFinanceStore } from "@/lib/finance-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

export function WidgetRevenue({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const dailyRevenue = useFinanceStore((s) => s.dailyRevenue);
  const financeLoaded = useFinanceStore((s) => s.loaded);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!orgId) return;
    getDashboardStats(orgId).then(({ data }) => {
      if (data) setStats(data);
    });
  }, [orgId]);

  const revenueMTD = useMemo(() => {
    if (stats?.revenue_current) return stats.revenue_current;
    return dailyRevenue.reduce((sum, d) => sum + d.amount, 0);
  }, [stats, dailyRevenue]);

  const growthPct = stats?.revenue_growth_pct ?? 0;
  const isPositiveGrowth = growthPct >= 0;
  const isZero = revenueMTD === 0;

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    Math.floor(v).toLocaleString("en-US")
  );

  useEffect(() => {
    const controls = animate(count, revenueMTD, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [count, revenueMTD]);

  /* ── Chart geometry ───────────────────────────────── */
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const amounts = useMemo(() => dailyRevenue.map((d) => d.amount), [dailyRevenue]);
  const maxAmount = useMemo(() => Math.max(...amounts, 1), [amounts]);
  const W = 400;
  const H = 90;

  const points = useMemo(
    () =>
      amounts.map((v, i) => ({
        x: (i / Math.max(amounts.length - 1, 1)) * W,
        y: 8 + (1 - v / maxAmount) * (H - 16),
      })),
    [amounts, maxAmount]
  );

  const linePath = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "),
    [points]
  );
  const areaPath = useMemo(
    () => `${linePath} L ${W} ${H} L 0 ${H} Z`,
    [linePath]
  );

  const lineLen = useMotionValue(2000);
  useEffect(() => {
    const ctrl = animate(lineLen, 0, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return ctrl.stop;
  }, [lineLen]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * W;
      let closest = 0;
      let minDist = Infinity;
      points.forEach((p, i) => {
        const d = Math.abs(p.x - relX);
        if (d < minDist) { minDist = d; closest = i; }
      });
      setHoverIndex(closest);
    },
    [points]
  );

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverData = hoverIndex !== null ? dailyRevenue[hoverIndex] : null;

  /* ── Loading ──────────────────────────────────────── */
  if (!financeLoaded && dailyRevenue.length === 0) {
    return (
      <WidgetShell delay={0.1}>
        <div className="p-6">
          <div className="h-3 w-20 rounded-md bg-zinc-800/30 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>
          <div className="mt-4 h-8 w-32 rounded-md bg-zinc-800/20 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>
          {size !== "small" && <div className="mt-6 h-[60px] w-full rounded-md bg-zinc-800/15 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>}
        </div>
      </WidgetShell>
    );
  }

  /* ── SMALL ───────────────────────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.1}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-4"
          onClick={() => router.push("/dashboard/finance")}
        >
          <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-600">Revenue</span>
          <div className="mt-1.5 flex items-baseline gap-0.5">
            <span className={`text-[10px] ${isZero ? "text-zinc-700" : "text-zinc-600"}`}>$</span>
            <span className={`font-mono text-[24px] font-medium tracking-tight ${isZero ? "text-zinc-700" : "text-white"}`}>
              {Math.floor(revenueMTD / 1000)}k
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {isPositiveGrowth ? (
              <TrendingUp size={9} className="text-emerald-500" />
            ) : (
              <TrendingDown size={9} className="text-red-400" />
            )}
            <span className={`font-mono text-[9px] font-medium ${isPositiveGrowth ? "text-emerald-500" : "text-red-400"}`}>
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE ──────────────────────────────── */
  const chartHeight = size === "large" ? "h-[60%]" : "h-[50%]";

  return (
    <WidgetShell
      delay={0.1}
      header={
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-zinc-600" />
          <span className="text-[13px] font-medium text-zinc-300">Revenue</span>
          <span className="text-[11px] text-zinc-700">MTD</span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/finance")}
          className="flex items-center gap-1 text-[11px] text-zinc-700 transition-colors hover:text-zinc-300"
        >
          Details <ArrowRight size={11} />
        </button>
      }
    >
      <div
        className="relative h-full cursor-pointer p-6"
        onClick={() => router.push("/dashboard/finance")}
      >
        {/* Sparkline */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={`absolute inset-x-0 bottom-0 ${chartHeight} w-full`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="revenueGradFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <filter id="lineGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <motion.path
            d={areaPath}
            fill="url(#revenueGradFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#lineGlow)"
            style={{ strokeDasharray: 2000, strokeDashoffset: lineLen }}
          />

          {hoverPoint && (
            <>
              <line x1={hoverPoint.x} y1={0} x2={hoverPoint.x} y2={H} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" fill="#10B981" stroke="#0A0A0A" strokeWidth="2.5">
                <animate attributeName="r" values="4;5;4" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hoverData && hoverPoint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 rounded-xl border border-white/[0.06] bg-zinc-900/95 px-3.5 py-2 shadow-2xl backdrop-blur-xl"
            style={{
              left: `${Math.min(Math.max((hoverPoint.x / W) * 100, 12), 85)}%`,
              bottom: "58%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-mono text-[9px] text-zinc-600">{hoverData.date}</div>
            <div className="font-mono text-[14px] font-medium text-white">
              ${hoverData.amount.toLocaleString()}
            </div>
          </motion.div>
        )}

        {/* KPI */}
        <div className="relative z-10">
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`font-mono text-xs ${isZero ? "text-zinc-700" : "text-zinc-600"}`}>$</span>
            <motion.span className={`font-mono text-[36px] font-medium tracking-tighter ${isZero ? "text-zinc-700" : "text-white"}`}>
              {rounded}
            </motion.span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
              isPositiveGrowth
                ? "bg-emerald-500/[0.08] text-emerald-400"
                : "bg-red-500/[0.08] text-red-400"
            }`}>
              {isPositiveGrowth ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
            <span className="text-[11px] text-zinc-700">vs last month</span>
          </div>

          {size === "large" && stats && (
            <div className="mt-5 flex items-center gap-6 border-t border-white/[0.03] pt-4">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-700">Prev Month</div>
                <div className="mt-0.5 font-mono text-[14px] font-medium text-zinc-500">${stats.revenue_previous.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-700">Active Jobs</div>
                <div className="mt-0.5 font-mono text-[14px] font-medium text-zinc-500">{stats.active_jobs_count}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.15em] text-zinc-700">Unassigned</div>
                <div className="mt-0.5 font-mono text-[14px] font-medium text-zinc-500">{stats.unassigned_jobs_count}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
