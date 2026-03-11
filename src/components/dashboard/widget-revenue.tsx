"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFinanceStore } from "@/lib/finance-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import { useDashboardStore } from "@/lib/dashboard-store";
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
  const cachedStats = useDashboardStore((s) => s.widgetRevenueStats);
  const setWidgetCache = useDashboardStore((s) => s.setWidgetCache);
  const isWidgetFresh = useDashboardStore((s) => s.isWidgetFresh);
  const [stats, setStats] = useState<DashboardStats | null>(cachedStats.data);

  useEffect(() => {
    if (!orgId) return;
    // Use cached data immediately, skip fetch if fresh
    if (isWidgetFresh('widgetRevenueStats') && cachedStats.data) {
      setStats(cachedStats.data);
      return;
    }
    getDashboardStats(orgId).then(({ data }) => {
      if (data) {
        setStats(data);
        setWidgetCache('widgetRevenueStats', data);
      }
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Revenue</span>
          <div className="mt-1.5 flex items-baseline gap-0.5">
            <span className={`font-mono text-[10px] tabular-nums ${isZero ? "text-zinc-700" : "text-[var(--text-dim)]"}`}>$</span>
            <span className={`font-mono text-[24px] font-medium tabular-nums tracking-tight ${isZero ? "text-zinc-700" : "text-[var(--text-primary)]"}`}>
              {Math.floor(revenueMTD / 1000)}k
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ background: isPositiveGrowth ? "var(--ghost-emerald)" : "var(--ghost-rose)" }}>
            {isPositiveGrowth ? (
              <TrendingUp size={9} style={{ color: "var(--ghost-emerald-text)" }} />
            ) : (
              <TrendingDown size={9} style={{ color: "var(--ghost-rose-text)" }} />
            )}
            <span className="font-mono text-[9px] font-medium tabular-nums" style={{ color: isPositiveGrowth ? "var(--ghost-emerald-text)" : "var(--ghost-rose-text)" }}>
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
              <stop offset="5%" stopColor="var(--brand)" stopOpacity="0.15" />
              <stop offset="95%" stopColor="var(--brand)" stopOpacity="0" />
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
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ strokeDasharray: 2000, strokeDashoffset: lineLen }}
          />

          {/* Hollow data point circles — only show on hover (PRD §4.3) */}
          {hoverIndex !== null && points[hoverIndex] && (
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r={3}
              fill="var(--surface-0)"
              stroke="var(--brand)"
              strokeWidth={1.5}
              className="transition-all duration-150"
            />
          )}

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
            className="absolute z-20 rounded-lg border p-3 shadow-2xl"
            style={{
              left: `${Math.min(Math.max((hoverPoint.x / W) * 100, 12), 85)}%`,
              bottom: "58%",
              transform: "translateX(-50%)",
              background: "var(--overlay-bg)",
              borderColor: "var(--border-active)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-muted)]">
              {formatTooltipDate(hoverData.date)}
            </div>
            <div className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">
              ${hoverData.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </motion.div>
        )}

        {/* KPI (PRD §5.1 Level 3) */}
        <div className="relative z-10">
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`font-mono text-sm tabular-nums ${isZero ? "text-zinc-700" : "text-[var(--text-dim)]"}`}>$</span>
            <motion.span className={`font-mono text-4xl font-medium tabular-nums tracking-tight ${isZero ? "text-zinc-700" : "text-[var(--text-primary)]"}`}>
              {rounded}
            </motion.span>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums"
              style={{
                background: isPositiveGrowth ? "var(--ghost-emerald)" : "var(--ghost-rose)",
                color: isPositiveGrowth ? "var(--ghost-emerald-text)" : "var(--ghost-rose-text)",
              }}
            >
              {isPositiveGrowth ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
            <span className="text-xs text-[var(--text-dim)]">vs last month</span>
          </div>

          {size === "large" && stats && (
            <div className="mt-5 flex items-center gap-6 border-t pt-4" style={{ borderColor: "var(--border-base)" }}>
              <div>
                <div className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Prev Month</div>
                <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-[var(--text-body)]">${stats.revenue_previous.toLocaleString()}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Active Jobs</div>
                <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-[var(--text-body)]">{stats.active_jobs_count}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Unassigned</div>
                <div className="mt-0.5 font-mono text-sm font-medium tabular-nums text-[var(--text-body)]">{stats.unassigned_jobs_count}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
