"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFinanceStore } from "@/lib/finance-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

/* ── SVG helpers ───────────────────────────────────── */

/** Horizontal dashed grid lines per PRD §4.1 */
function SvgGridLines({ w, h }: { w: number; h: number }) {
  const rows = 4;
  return (
    <g>
      {Array.from({ length: rows + 1 }, (_, r) => {
        const y = (r / rows) * h;
        return (
          <line
            key={r}
            x1={0} y1={y} x2={w} y2={y}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        );
      })}
    </g>
  );
}

/** Build a monotoneX SVG path (smooth curves that pass through every point) */
function monotoneXPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

/** Format date string as "Tuesday, Feb 24" per PRD §4.4 */
function formatTooltipDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

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
  const PAD = 8;

  const points = useMemo(
    () =>
      amounts.map((v, i) => ({
        x: (i / Math.max(amounts.length - 1, 1)) * W,
        y: PAD + (1 - v / maxAmount) * (H - PAD * 2),
      })),
    [amounts, maxAmount]
  );

  /* Smooth monotoneX curve */
  const linePath = useMemo(() => monotoneXPath(points), [points]);
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
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Revenue</span>
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
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Revenue MTD</span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/finance")}
          className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          Details <ArrowRight size={11} />
        </button>
      }
    >
      <div
        className="relative h-full cursor-pointer p-6"
        onClick={() => router.push("/dashboard/finance")}
      >
        {/* Sparkline Chart */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={`absolute inset-x-0 bottom-0 ${chartHeight} w-full`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="revenueGradFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity="0.15" />
              <stop offset="95%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal dashed grid (PRD §4.1) */}
          <SvgGridLines w={W} h={H} />

          {/* Area fill — the fog (PRD §4.2) */}
          <motion.path
            d={areaPath}
            fill="url(#revenueGradFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
          />

          {/* Smooth monotoneX line (PRD §4.2) */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ strokeDasharray: 2000, strokeDashoffset: lineLen }}
          />

          {/* Hollow data point circles at every node (PRD §4.3) */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 3.5}
              fill="#09090B"
              stroke="#10B981"
              strokeWidth={2}
              opacity={hoverIndex === i ? 1 : 0.5}
              className="transition-all duration-150"
            />
          ))}

          {/* Crosshair on hover (PRD §4.4) */}
          {hoverPoint && (
            <line
              x1={hoverPoint.x} y1={0} x2={hoverPoint.x} y2={H}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {/* Glassmorphic Tooltip (PRD §4.4) */}
        {hoverData && hoverPoint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 rounded-lg border border-white/10 p-3 shadow-2xl"
            style={{
              left: `${Math.min(Math.max((hoverPoint.x / W) * 100, 12), 85)}%`,
              bottom: "58%",
              transform: "translateX(-50%)",
              background: "rgba(9,9,11,0.95)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="text-[11px] uppercase tracking-wider text-zinc-400">
              {formatTooltipDate(hoverData.date)}
            </div>
            <div className="mt-0.5 font-mono text-[18px] font-semibold text-white">
              ${hoverData.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </motion.div>
        )}

        {/* KPI (PRD §5.1 Level 3) */}
        <div className="relative z-10">
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`font-mono text-sm ${isZero ? "text-zinc-700" : "text-zinc-600"}`}>$</span>
            <motion.span className={`font-mono text-4xl font-medium tracking-tight ${isZero ? "text-zinc-700" : "text-white"}`}>
              {rounded}
            </motion.span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
              isPositiveGrowth
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}>
              {isPositiveGrowth ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
            <span className="text-xs text-zinc-600">vs last month</span>
          </div>

          {size === "large" && stats && (
            <div className="mt-5 flex items-center gap-6 border-t border-white/5 pt-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">Prev Month</div>
                <div className="mt-0.5 font-mono text-sm font-medium text-zinc-400">${stats.revenue_previous.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">Active Jobs</div>
                <div className="mt-0.5 font-mono text-sm font-medium text-zinc-400">{stats.active_jobs_count}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-zinc-500">Unassigned</div>
                <div className="mt-0.5 font-mono text-sm font-medium text-zinc-400">{stats.unassigned_jobs_count}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
