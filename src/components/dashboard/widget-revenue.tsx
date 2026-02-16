"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFinanceStore } from "@/lib/finance-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getDashboardStats, type DashboardStats } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";

export function WidgetRevenue() {
  const router = useRouter();
  const { orgId } = useOrg();
  const dailyRevenue = useFinanceStore((s) => s.dailyRevenue);
  const financeLoaded = useFinanceStore((s) => s.loaded);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Fetch dashboard stats from RPC
  useEffect(() => {
    if (!orgId) return;
    getDashboardStats(orgId).then(({ data }) => {
      if (data) setStats(data);
    });
  }, [orgId]);

  // Calculate revenue from store data (fallback if RPC unavailable)
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

  /* ── Draw animation ───────────────────────────────── */
  const lineLen = useMotionValue(2000);
  useEffect(() => {
    const ctrl = animate(lineLen, 0, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
    return ctrl.stop;
  }, [lineLen]);

  /* ── Scrub crosshair ──────────────────────────────── */
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

  // Show skeleton while loading
  if (!financeLoaded && dailyRevenue.length === 0) {
    return (
      <WidgetShell delay={0}>
        <div className="p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-900" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-zinc-900" />
          <div className="mt-4 h-[55px] w-full animate-pulse rounded bg-zinc-900" />
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell delay={0}>
      <div
        className="relative cursor-pointer p-5"
        onClick={() => router.push("/dashboard/finance")}
      >
        {/* Area chart fills the card */}
        <svg
          ref={chartRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-[55%] w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor="#10B981" floodOpacity="0.5" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Filled area */}
          <motion.path
            d={areaPath}
            fill="url(#revenueGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          />
          {/* Line stroke with draw animation */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ strokeDasharray: 2000, strokeDashoffset: lineLen }}
          />
          {/* Crosshair */}
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                y1={0}
                x2={hoverPoint.x}
                y2={H}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="12"
                fill="transparent"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="4"
                fill="#10B981"
                stroke="#0C0C0C"
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hoverData && hoverPoint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 rounded-md border border-[rgba(255,255,255,0.1)] bg-zinc-900/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
            style={{
              left: `${Math.min(Math.max((hoverPoint.x / W) * 100, 10), 80)}%`,
              bottom: "60%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-[10px] text-zinc-500">{hoverData.date}</div>
            <div className="text-[12px] font-medium text-zinc-200">
              ${hoverData.amount.toLocaleString()}
            </div>
          </motion.div>
        )}

        {/* Content overlay */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Revenue MTD
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xs text-zinc-500">$</span>
            <motion.span className="text-[32px] font-medium tracking-tight text-zinc-100">
              {rounded}
            </motion.span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {isPositiveGrowth ? (
              <TrendingUp size={12} className="text-emerald-400" />
            ) : (
              <TrendingDown size={12} className="text-red-400" />
            )}
            <span className={`text-[11px] font-medium ${isPositiveGrowth ? "text-emerald-400" : "text-red-400"}`}>
              {isPositiveGrowth ? "+" : ""}{growthPct}%
            </span>
            <span className="text-[11px] text-zinc-600">vs last month</span>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
