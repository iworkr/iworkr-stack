/**
 * @component ShiftCostTooltip
 * @status COMPLETE
 * @description Animated tooltip displaying shift cost breakdown with penalty and overtime indicators
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getShiftFinancialLedger } from "@/app/actions/shift-cost";

/* ── Types ────────────────────────────────────────────── */

interface ShiftCostTooltipProps {
  scheduleBlockId: string;
  visible: boolean;
  position: { x: number; y: number };
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);

/* ── Component ────────────────────────────────────────── */

export function ShiftCostTooltip({ scheduleBlockId, visible, position }: ShiftCostTooltipProps) {
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !scheduleBlockId) return;
    setLoading(true);
    getShiftFinancialLedger(scheduleBlockId)
      .then(setLedger)
      .catch(() => setLedger(null))
      .finally(() => setLoading(false));
  }, [scheduleBlockId, visible]);

  if (!visible) return null;

  const cost = ledger?.projected_cost || 0;
  const revenue = ledger?.projected_revenue || 0;
  const margin = ledger?.projected_margin || 0;
  const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 4 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[100] w-56 rounded-xl border border-white/[0.08] bg-zinc-900/95 shadow-xl shadow-black/40 backdrop-blur-xl p-3"
          style={{ left: position.x, top: position.y + 8 }}
        >
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-zinc-300" />
              <span className="text-[11px] text-zinc-500">Loading costs...</span>
            </div>
          ) : !ledger ? (
            <p className="text-[11px] text-zinc-600 py-1">No financial data available</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 pb-1.5 border-b border-white/[0.06]">
                <DollarSign size={12} className="text-zinc-500" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Shift Financial</span>
              </div>

              {/* Cost */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">SCHADS Cost</span>
                <span className="font-mono text-[12px] font-medium text-rose-400 tabular-nums">{fmtCurrency(cost)}</span>
              </div>

              {/* Revenue */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">NDIS Revenue</span>
                <span className="font-mono text-[12px] font-medium text-emerald-400 tabular-nums">{fmtCurrency(revenue)}</span>
              </div>

              {/* Travel */}
              {(ledger.travel_cost > 0 || ledger.travel_revenue > 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">Travel</span>
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                    {fmtCurrency(ledger.travel_cost)} / {fmtCurrency(ledger.travel_revenue)}
                  </span>
                </div>
              )}

              {/* Margin */}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06]">
                <span className="text-[11px] font-medium text-zinc-300">Margin</span>
                <div className="flex items-center gap-1.5">
                  {margin >= 0 ? (
                    <TrendingUp size={10} className="text-emerald-400" />
                  ) : (
                    <TrendingDown size={10} className="text-rose-400" />
                  )}
                  <span className={`font-mono text-[12px] font-bold tabular-nums ${
                    marginPct >= 20 ? "text-emerald-400" : marginPct >= 0 ? "text-amber-400" : "text-rose-400"
                  }`}>
                    {fmtCurrency(margin)} ({marginPct}%)
                  </span>
                </div>
              </div>

              {/* Flags */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {ledger.is_overtime && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                    <Clock size={8} /> OT
                  </span>
                )}
                {ledger.is_public_holiday && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-medium text-rose-400">
                    <Zap size={8} /> PH 2.5×
                  </span>
                )}
                {ledger.is_broken_shift && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                    <AlertTriangle size={8} /> Broken
                  </span>
                )}
                {ledger.penalty_type && ledger.penalty_type !== "public_holiday" && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">
                    {ledger.penalty_type}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Worker Weekly Hours Bar ──────────────────────────── */

export function WorkerWeeklyHoursBar({
  scheduledHours,
  maxHours,
}: {
  scheduledHours: number;
  maxHours: number;
}) {
  const pct = Math.min(Math.round((scheduledHours / maxHours) * 100), 100);
  const color = pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 90 ? "text-rose-400" : pct >= 75 ? "text-amber-400" : "text-zinc-400";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono text-[10px] font-medium tabular-nums ${textColor}`}>
        {scheduledHours}h
      </span>
      <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-zinc-600 tabular-nums">{maxHours}h</span>
    </div>
  );
}

/* ── Fatigue Warning Badge ────────────────────────────── */

export function FatigueWarningBadge({
  gapHours,
  minimumRequired,
}: {
  gapHours: number;
  minimumRequired: number;
}) {
  if (gapHours >= minimumRequired) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-500/20"
    >
      <AlertTriangle size={9} />
      FATIGUE: {gapHours.toFixed(1)}h rest ({minimumRequired}h req)
    </motion.div>
  );
}

/* ── Broken Shift Connector ───────────────────────────── */

export function BrokenShiftConnector({ allowanceAmount }: { allowanceAmount: number }) {
  return (
    <div className="flex items-center gap-1 px-1">
      <div className="flex-1 border-t border-dashed border-violet-500/40" />
      <span className="text-[8px] font-mono text-violet-400 bg-zinc-900 px-1 rounded">
        +{fmtCurrency(allowanceAmount)}
      </span>
      <div className="flex-1 border-t border-dashed border-violet-500/40" />
    </div>
  );
}
