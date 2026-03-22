/**
 * @component PayrollEngineBreakdown
 * @status COMPLETE
 * @description SCHADS payroll calculation breakdown with line-by-line audit matrix
 * @lastAudit 2026-03-22
 */
"use client";

/**
 * SCHADS Payroll Engine Breakdown
 * Rendered inside the Timesheet Review Slide-Over.
 * Shows the deterministic math the engine performed in a high-density
 * JetBrains Mono matrix that Finance Managers can audit line-by-line.
 */

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  getTimesheetPayLines,
  runSchadsEngine,
  forceRecalculateTimesheet,
  PAY_CATEGORY_LABELS,
  ALLOWANCE_LABELS,
  type TimesheetPayLine,
  type PayCategory,
  type AllowanceType,
} from "@/app/actions/schads-payroll";
import { useToastStore } from "@/components/app/action-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number | null | undefined): string {
  return `$${Number(val ?? 0).toFixed(2)}`;
}

function formatUnits(val: number | null | undefined): string {
  return Number(val ?? 0).toFixed(4);
}

function formatMultiplier(val: number | null | undefined): string {
  return `${Number(val ?? 1).toFixed(4)}x`;
}

function formatRate(val: number | null | undefined): string {
  return `$${Number(val ?? 0).toFixed(4)}`;
}

// ─── Pay category badge colours ───────────────────────────────────────────────

const CATEGORY_BADGE: Record<PayCategory, string> = {
  ORDINARY_HOURS: "text-zinc-400",
  EVENING_SHIFT: "text-amber-400",
  NIGHT_SHIFT: "text-indigo-400",
  SATURDAY: "text-purple-400",
  SUNDAY: "text-rose-400",
  PUBLIC_HOLIDAY: "text-rose-500",
  OVERTIME_1_5X: "text-orange-400",
  OVERTIME_2_0X: "text-orange-500",
  MINIMUM_ENGAGEMENT_PADDING: "text-zinc-500",
  CLIENT_CANCELLATION: "text-yellow-400",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface PayrollBreakdownProps {
  timesheetId: string;
  orgId: string;
  /** Worker name + shift dates for the header label */
  workerName?: string;
  periodLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PayrollEngineBreakdown({
  timesheetId,
  orgId,
  workerName,
  periodLabel,
}: PayrollBreakdownProps) {
  const { addToast } = useToastStore();
  const [lines, setLines] = useState<TimesheetPayLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadLines() {
    setLoading(true);
    const { lines: data, total: t, error } = await getTimesheetPayLines(timesheetId, orgId);
    setLoading(false);
    if (error) {
      addToast(error, undefined, "error");
      return;
    }
    setLines(data);
    setTotal(t);
  }

  useEffect(() => {
    loadLines();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheetId, orgId]);

  async function handleRunEngine() {
    startTransition(async () => {
      const { ok, payLinesCount, totalGross, error } = await runSchadsEngine(timesheetId, orgId);
      if (!ok || error) {
        addToast(error || "Engine failed", undefined, "error");
        return;
      }
      addToast(`Engine generated ${payLinesCount} pay line(s) — ${formatAUD(totalGross)} gross`);
      loadLines();
    });
  }

  async function handleForceRecalculate() {
    startTransition(async () => {
      const { ok, error } = await forceRecalculateTimesheet(timesheetId, orgId);
      if (!ok || error) {
        addToast(error || "Recalculation failed", undefined, "error");
        return;
      }
      addToast("Payroll lines recalculated");
      loadLines();
    });
  }

  // Group lines by shift date
  const linesByDate = new Map<string, TimesheetPayLine[]>();
  for (const line of lines) {
    if (!linesByDate.has(line.shift_date)) linesByDate.set(line.shift_date, []);
    linesByDate.get(line.shift_date)!.push(line);
  }

  const hasLines = lines.length > 0;

  return (
    <div className="mt-6 border-t border-white/5 pt-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 group"
        >
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            Payroll Engine Breakdown
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          ) : (
            <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          )}
        </button>

        <div className="flex items-center gap-2">
          {!hasLines && !loading && (
            <button
              onClick={handleRunEngine}
              disabled={isPending}
              className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
              Run Engine
            </button>
          )}
          {hasLines && (
            <button
              onClick={handleForceRecalculate}
              disabled={isPending}
              className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-medium text-zinc-500 border border-white/5 rounded hover:text-zinc-300 hover:border-white/10 transition-colors disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <RefreshCw className="w-2.5 h-2.5" />
              )}
              Force Recalculate
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
                <span className="text-xs text-zinc-600">Loading pay lines…</span>
              </div>
            ) : !hasLines ? (
              <div className="rounded-lg bg-zinc-900/40 border border-white/5 p-4 text-center">
                <p className="text-[11px] text-zinc-500">
                  No pay lines calculated yet.
                  <br />
                  Click <span className="text-emerald-400">Run Engine</span> to process this timesheet through the SCHADS interpreter.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-950 border border-white/5 overflow-hidden">
                {/* Worker + period header */}
                {(workerName || periodLabel) && (
                  <div className="px-4 py-2 border-b border-white/5 bg-zinc-900/30">
                    <p className="text-[10px] text-zinc-500">
                      {workerName && <span className="text-zinc-300 font-medium">{workerName}</span>}
                      {workerName && periodLabel && <span className="mx-2 text-zinc-700">·</span>}
                      {periodLabel && <span>{periodLabel}</span>}
                    </p>
                  </div>
                )}

                {/* Column headers */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-2 border-b border-white/5 bg-zinc-900/20">
                  {["LINE ITEM", "UNITS", "RATE", "MULTIPLIER", "TOTAL"].map((h) => (
                    <span
                      key={h}
                      className={`text-[9px] uppercase tracking-widest font-semibold text-zinc-600 ${
                        h !== "LINE ITEM" ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Lines grouped by date */}
                {Array.from(linesByDate.entries()).map(([date, dateLines]) => {
                  const dateTotal = dateLines.reduce((s, l) => s + Number(l.total_line_amount), 0);
                  return (
                    <div key={date}>
                      {/* Date row */}
                      <div className="px-4 py-1.5 bg-zinc-900/30 border-b border-white/[0.03]">
                        <span className="text-[9px] text-zinc-600 font-mono">
                          {new Date(date + "T00:00:00").toLocaleDateString("en-AU", {
                            weekday: "short", day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>

                      {dateLines.map((line) => {
                        const label = line.allowance_type !== "NONE"
                          ? ALLOWANCE_LABELS[line.allowance_type as AllowanceType]
                          : PAY_CATEGORY_LABELS[line.pay_category as PayCategory];
                        const catColor = CATEGORY_BADGE[line.pay_category as PayCategory] || "text-zinc-400";

                        return (
                          <div
                            key={line.id}
                            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors group"
                          >
                            {/* Line item label */}
                            <div className="flex flex-col min-w-0">
                              <span className={`text-[11px] font-medium ${catColor}`}>
                                {label}
                                {line.is_synthetic && (
                                  <span className="ml-1 text-[9px] text-zinc-600 font-normal">[synthetic]</span>
                                )}
                              </span>
                              {line.notes && (
                                <span className="text-[9px] text-zinc-700 truncate mt-0.5" title={line.notes}>
                                  {line.notes}
                                </span>
                              )}
                            </div>

                            {/* Units */}
                            <div className="text-right">
                              <span
                                className="text-[11px] text-zinc-300"
                                style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                              >
                                {line.allowance_type !== "NONE" && line.units === 1
                                  ? "1 unit"
                                  : `${formatUnits(line.units)}h`}
                              </span>
                            </div>

                            {/* Rate */}
                            <div className="text-right">
                              <span
                                className="text-[11px] text-zinc-300"
                                style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                              >
                                {line.allowance_type !== "NONE" && line.units === 1
                                  ? "Fixed"
                                  : formatRate(line.calculated_rate)}
                              </span>
                            </div>

                            {/* Multiplier */}
                            <div className="text-right">
                              <span
                                className="text-[11px] text-zinc-500"
                                style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                              >
                                {line.allowance_type !== "NONE" ? "—" : formatMultiplier(line.rate_multiplier)}
                              </span>
                            </div>

                            {/* Total */}
                            <div className="text-right">
                              <span
                                className="text-[11px] text-white font-medium"
                                style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                              >
                                {formatAUD(line.total_line_amount)}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Date subtotal */}
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-1.5 bg-zinc-900/10 border-b border-white/5">
                        <span className="text-[9px] text-zinc-600 col-span-4 text-right pr-4">
                          Subtotal {new Date(date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "2-digit", month: "short" })}
                        </span>
                        <span
                          className="text-[11px] text-zinc-400 text-right"
                          style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                        >
                          {formatAUD(dateTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Grand total footer */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3 bg-zinc-900/60">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest col-span-4 text-right pr-4">
                    Gross Pay
                  </span>
                  <span
                    className="text-[14px] text-white font-bold text-right"
                    style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                  >
                    {formatAUD(total)}
                  </span>
                </div>

                {/* Line count badge */}
                <div className="px-4 py-1.5 border-t border-white/5 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] text-zinc-600">
                    {lines.length} pay line(s) generated by SCHADS Engine v{lines[0]?.engine_version || "1.0"}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
