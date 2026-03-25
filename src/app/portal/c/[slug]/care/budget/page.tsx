/**
 * @page /portal/c/[slug]/care/budget
 * @status COMPLETE
 * @description NDIS budget tracker with donut chart — shows plan total, funds utilized,
 *   funds quarantined (scheduled shifts), and remaining balance. The ShiftCare killer.
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, TrendingUp, TrendingDown, AlertTriangle, Loader2, Calendar } from "lucide-react";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalBudgetSummary, type BudgetSummary } from "@/app/actions/portal-client";

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function BudgetDonut({ total, utilized, quarantined, remaining, brandColor }: {
  total: number;
  utilized: number;
  quarantined: number;
  remaining: number;
  brandColor: string;
}) {
  const size = 220;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const utilizedPct = total > 0 ? utilized / total : 0;
  const quarantinedPct = total > 0 ? quarantined / total : 0;
  const remainingPct = total > 0 ? remaining / total : 1;

  const utilizedDash = circumference * utilizedPct;
  const quarantinedDash = circumference * quarantinedPct;
  const remainingDash = circumference * remainingPct;

  const utilizedOffset = 0;
  const quarantinedOffset = -utilizedDash;
  const remainingOffset = -(utilizedDash + quarantinedDash);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
        />
        {/* Remaining */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={brandColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${remainingDash} ${circumference - remainingDash}`}
          strokeDashoffset={remainingOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${remainingDash} ${circumference - remainingDash}` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
        />
        {/* Quarantined */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={strokeWidth}
          strokeDasharray={`${quarantinedDash} ${circumference - quarantinedDash}`}
          strokeDashoffset={quarantinedOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${quarantinedDash} ${circumference - quarantinedDash}` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
        {/* Utilized */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#6366F1"
          strokeWidth={strokeWidth}
          strokeDasharray={`${utilizedDash} ${circumference - utilizedDash}`}
          strokeDashoffset={utilizedOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${utilizedDash} ${circumference - utilizedDash}` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Remaining</p>
        <motion.p
          className="text-2xl font-bold tabular-nums"
          style={{ color: brandColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          ${fmtMoney(remaining)}
        </motion.p>
      </div>
    </div>
  );
}

export default function PortalBudgetPage() {
  const tenant = usePortalStore((s) => s.activeTenant);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!activeEntityId) return;
    setLoading(true);
    getPortalBudgetSummary(activeEntityId).then((result) => {
      setBudget(result.budget);
      setTelemetry(result.telemetry);
      setLoading(false);
    });
  }, [activeEntityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
        <PieChart size={32} className="mx-auto mb-3 text-zinc-700" />
        <p className="text-zinc-400">No active service agreement found</p>
        <p className="mt-1 text-[12px] text-zinc-600">
          Budget tracking requires an active NDIS service agreement.
        </p>
      </div>
    );
  }

  const total = Number(budget.plan_total || 0);
  const utilized = Number(budget.funds_utilized || 0);
  const quarantined = Number(budget.funds_quarantined || 0);
  const remaining = Number(budget.funds_remaining || 0);
  const burnRate = Number(budget.burn_rate_pct || 0);

  // Calculate pro-rata position
  const planStart = budget.plan_start_date ? new Date(budget.plan_start_date) : null;
  const planEnd = budget.plan_end_date ? new Date(budget.plan_end_date) : null;
  let proRataPct = 50;
  let daysRemaining = 0;
  if (planStart && planEnd) {
    const totalDays = (planEnd.getTime() - planStart.getTime()) / 86400000;
    const elapsed = Math.min((Date.now() - planStart.getTime()) / 86400000, totalDays);
    proRataPct = totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 50;
    daysRemaining = Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / 86400000));
  }

  const burnStatus =
    remaining <= 0
      ? "depleted"
      : burnRate > proRataPct + 20
        ? "critical"
        : burnRate > proRataPct + 10
          ? "over_burning"
          : "on_track";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">NDIS Budget</h1>
        <p className="text-[12px] text-zinc-500">
          {budget.agreement_title || "Service Agreement"} — {budget.support_category || "Core Supports"}
        </p>
      </div>

      {/* Burn Status Banner */}
      {burnStatus !== "on_track" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 rounded-xl p-4 ${
            burnStatus === "depleted"
              ? "border border-red-500/20 bg-red-500/10"
              : burnStatus === "critical"
                ? "border border-red-500/15 bg-red-500/8"
                : "border border-amber-500/15 bg-amber-500/8"
          }`}
        >
          <AlertTriangle
            size={18}
            className={burnStatus === "over_burning" ? "text-amber-400" : "text-red-400"}
          />
          <div>
            <p className={`text-[13px] font-medium ${burnStatus === "over_burning" ? "text-amber-300" : "text-red-300"}`}>
              {burnStatus === "depleted"
                ? "Budget Depleted"
                : burnStatus === "critical"
                  ? "Budget Critical — Pace Significantly Over Target"
                  : "Budget Caution — Spending Ahead of Schedule"}
            </p>
            <p className="text-[11px] text-zinc-500">
              {burnRate.toFixed(1)}% consumed vs {proRataPct}% of plan year elapsed
            </p>
          </div>
        </motion.div>
      )}

      {/* Donut Chart + Legend */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-8"
        >
          <BudgetDonut
            total={total}
            utilized={utilized}
            quarantined={quarantined}
            remaining={remaining}
            brandColor={brandColor}
          />
        </motion.div>

        <div className="space-y-4">
          <LegendItem color={brandColor} label="Funds Remaining" value={remaining} total={total} />
          <LegendItem color="#F59E0B" label="Quarantined (Upcoming Shifts)" value={quarantined} total={total} />
          <LegendItem color="#6366F1" label="Funds Utilized (Invoiced)" value={utilized} total={total} />

          <div className="mt-4 rounded-xl border border-white/[0.04] bg-zinc-950/50 p-4">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <Calendar size={12} />
              Plan Period
            </div>
            <p className="mt-1 text-[13px] text-zinc-300">
              {fmtDate(budget.plan_start_date)} — {fmtDate(budget.plan_end_date)}
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Plan period ended"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-zinc-950/50 p-4">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              {burnRate <= proRataPct ? (
                <TrendingDown size={12} className="text-emerald-400" />
              ) : (
                <TrendingUp size={12} className="text-amber-400" />
              )}
              Burn Rate
            </div>
            <p className="mt-1 text-[13px] text-zinc-300">
              {burnRate.toFixed(1)}% of total plan budget consumed
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: burnStatus === "on_track" ? brandColor : burnStatus === "over_burning" ? "#F59E0B" : "#EF4444" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(burnRate, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
              <span>0%</span>
              <span className="text-zinc-500">Pro-rata target: {proRataPct}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Total */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total NDIS Plan Budget</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-100">${fmtMoney(total)}</p>
      </div>
    </div>
  );
}

function LegendItem({ color, label, value, total }: {
  color: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-zinc-950/30 p-4">
      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-zinc-400">{label}</p>
        <p className="text-[16px] font-semibold tabular-nums text-zinc-200">
          ${fmtMoney(value)}
        </p>
      </div>
      <span className="text-[12px] tabular-nums text-zinc-500">{pct}%</span>
    </div>
  );
}
