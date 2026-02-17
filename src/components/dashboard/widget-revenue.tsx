"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
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

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    Math.floor(v).toLocaleString("en-US")
  );

  useEffect(() => {
    const controls = animate(count, revenueMTD, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [count, revenueMTD]);

  /* ── Chart geometry ───────────────────────────────── */
  const chartRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const amounts = useMemo(() => dailyRevenue.map((d) => d.amount), [dailyRevenue]);
  const maxAmount = useMemo(() => Math.max(...amounts, 1), [amounts]);
  const W = 400;
  const H = 80;
  const padX = 0;
  const padY = 6;

  const points = useMemo(
    () =>
      amounts.map((v, i) => ({
        x: padX + (i / Math.max(amounts.length - 1, 1)) * (W - padX * 2),
        y: padY + (1 - v / maxAmount) * (H - padY * 2),
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
    const ctrl = animate(lineLen, 0, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
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
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      });
      setHoverIndex(closest);
    },
    [points]
  );

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverData = hoverIndex !== null ? dailyRevenue[hoverIndex] : null;

  /* ── Loading Skeleton ──────────────────────────────── */
  if (!financeLoaded && dailyRevenue.length === 0) {
    return (
      <WidgetShell delay={0}>
        <div className="p-5">
          <div className="h-3 w-20 rounded-md bg-zinc-800/50 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>
          <div className="mt-4 h-8 w-32 rounded-md bg-zinc-800/40 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>
          {size !== "small" && <div className="mt-5 h-[55px] w-full rounded-md bg-zinc-800/25 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>}
        </div>
      </WidgetShell>
    );
  }

  /* ── SMALL: Simple KPI Number ───────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-3"
          onClick={() => router.push("/dashboard/finance")}
        >
          <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Revenue</span>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-[10px] text-zinc-600">$</span>
            <span className="text-[22px] font-medium tracking-tight text-white">
              {Math.floor(revenueMTD / 1000)}k
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {isPositiveGrowth ? (
              <TrendingUp size={9} className="text-emerald-500" />
            ) : (
              <TrendingDown size={9} className="text-red-400" />
            )}
            <span className={`text-[9px] font-medium ${isPositiveGrowth ? "text-emerald-500" : "text-red-400"}`}>
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
          </div>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE: Sparkline + KPI ─────────────────── */
  const showCrosshair = size === "large";
  const chartHeight = size === "large" ? "h-[65%]" : "h-[55%]";

  return (
    <WidgetShell delay={0}>
      <div
        className="relative h-full cursor-pointer p-5"
        onClick={() => router.push("/dashboard/finance")}
      >
        {/* Background sparkline */}
        <svg
          ref={chartRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={`absolute inset-x-0 bottom-0 ${chartHeight} w-full`}
          onMouseMove={showCrosshair ? handleMouseMove : undefined}
          onMouseLeave={showCrosshair ? () => setHoverIndex(null) : undefined}
        >
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={areaPath}
            fill="url(#revenueGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ strokeDasharray: 2000, strokeDashoffset: lineLen }}
          />

          {showCrosshair && hoverPoint && (
            <>
              <line x1={hoverPoint.x} y1={0} x2={hoverPoint.x} y2={H} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3.5" fill="#10B981" stroke="#0A0A0A" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {showCrosshair && hoverData && hoverPoint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 rounded-lg border border-white/[0.08] bg-[#0A0A0A]/95 px-3 py-2 shadow-xl backdrop-blur-sm"
            style={{
              left: `${Math.min(Math.max((hoverPoint.x / W) * 100, 10), 80)}%`,
              bottom: "60%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-[10px] text-zinc-500">{hoverData.date}</div>
            <div className="text-[13px] font-medium text-white">
              ${hoverData.amount.toLocaleString()}
            </div>
          </motion.div>
        )}

        {/* KPI text overlay */}
        <div className="relative z-10">
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            Revenue MTD
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xs text-zinc-600">$</span>
            <motion.span className="text-[32px] font-medium tracking-tight text-white">
              {rounded}
            </motion.span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isPositiveGrowth
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-400"
            }`}>
              {isPositiveGrowth ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
            <span className="text-[11px] text-zinc-600">vs last month</span>
          </div>

          {/* Large: additional stats */}
          {size === "large" && stats && (
            <div className="mt-4 flex items-center gap-5 border-t border-white/[0.04] pt-3">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Prev Month</div>
                <div className="mt-0.5 text-[14px] font-medium text-zinc-400">${stats.revenue_previous.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Active Jobs</div>
                <div className="mt-0.5 text-[14px] font-medium text-zinc-400">{stats.active_jobs_count}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Unassigned</div>
                <div className="mt-0.5 text-[14px] font-medium text-zinc-400">{stats.unassigned_jobs_count}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
