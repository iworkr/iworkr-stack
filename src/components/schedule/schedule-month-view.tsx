"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ScheduleBlock } from "@/lib/data";
import { useScheduleStore } from "@/lib/schedule-store";

/* ── Status Dot Colors ───────────────────────────────────── */

const statusDotColor: Record<string, string> = {
  scheduled: "bg-sky-400",
  en_route: "bg-amber-400",
  on_site: "bg-violet-400",
  in_progress: "bg-emerald-400",
  complete: "bg-zinc-500",
  cancelled: "bg-zinc-700",
};

/* ── Helpers ──────────────────────────────────────────────── */

function getMonthGrid(dateStr: string): { year: number; month: number; days: Array<{ date: string; inMonth: boolean }> } {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed

  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Day of week for the first (0=Sun, adjust so Mon=0)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0, Sun=6

  const days: Array<{ date: string; inMonth: boolean }> = [];

  // Fill leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i);
    days.push({
      date: prevDate.toISOString().split("T")[0],
      inMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      date: date.toISOString().split("T")[0],
      inMonth: true,
    });
  }

  // Fill trailing days to complete the grid (always 6 rows x 7 cols = 42)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({
      date: nextDate.toISOString().split("T")[0],
      inMonth: false,
    });
  }

  return { year, month, days };
}

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/* ── Component ────────────────────────────────────────────── */

interface ScheduleMonthViewProps {
  blocks: ScheduleBlock[];
  selectedDate: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_DOTS = 3;

export function ScheduleMonthView({
  blocks,
  selectedDate,
}: ScheduleMonthViewProps) {
  const { setSelectedDate, setViewScale } = useScheduleStore();

  const { year, month, days } = useMemo(() => getMonthGrid(selectedDate), [selectedDate]);
  const todayStr = useMemo(() => getTodayStr(), []);

  /** Navigate to prev/next month */
  const navigateMonth = (direction: -1 | 1) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setMonth(d.getMonth() + direction);
    d.setDate(1); // Always go to the 1st of the target month
    const newDate = d.toISOString().split("T")[0];
    setSelectedDate(newDate);
  };

  /**
   * Group blocks by date. Since the store currently loads blocks for the selectedDate only,
   * all blocks are assigned to the selectedDate. In the future, when the store supports
   * loading a date range, this will work across the full month.
   */
  const blocksByDate = useMemo(() => {
    const map: Record<string, ScheduleBlock[]> = {};
    for (const block of blocks) {
      if (!map[selectedDate]) {
        map[selectedDate] = [];
      }
      map[selectedDate].push(block);
    }
    return map;
  }, [blocks, selectedDate]);

  const monthLabel = formatMonthLabel(year, month);

  return (
    <div className="flex h-full flex-col">
      {/* Month navigation header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth(-1)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[180px] text-center text-[13px] font-medium text-zinc-300">
            {monthLabel}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b border-white/[0.04]">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-600"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid (6 rows x 7 cols) */}
      <div className="flex-1 overflow-auto scrollbar-none">
        <div className="grid h-full grid-cols-7 grid-rows-6">
          {days.map((dayInfo, idx) => {
            const dayBlocks = blocksByDate[dayInfo.date] || [];
            const blockCount = dayBlocks.length;
            const isToday = dayInfo.date === todayStr;
            const isSelected = dayInfo.date === selectedDate;
            const dayNum = new Date(dayInfo.date + "T12:00:00").getDate();

            // Only show up to MAX_VISIBLE_DOTS dots + overflow indicator
            const visibleBlocks = dayBlocks.slice(0, MAX_VISIBLE_DOTS);
            const overflowCount = Math.max(0, blockCount - MAX_VISIBLE_DOTS);

            return (
              <motion.button
                key={dayInfo.date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.005, duration: 0.2 }}
                onClick={() => {
                  setSelectedDate(dayInfo.date);
                  setViewScale("day");
                }}
                className={`group relative flex flex-col items-start border-b border-r border-white/[0.03] p-2 text-left transition-colors duration-150 hover:bg-white/[0.02] ${
                  !dayInfo.inMonth ? "opacity-30" : ""
                } ${isToday ? "bg-emerald-500/[0.02]" : ""}`}
              >
                {/* Day number */}
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium transition-colors ${
                    isToday
                      ? "bg-emerald-500 text-white"
                      : isSelected
                        ? "bg-white/[0.08] text-white"
                        : dayInfo.inMonth
                          ? "text-zinc-400 group-hover:text-white"
                          : "text-zinc-700"
                  }`}
                >
                  {dayNum}
                </span>

                {/* Today border */}
                {isToday && (
                  <div className="pointer-events-none absolute inset-0 rounded-sm border border-emerald-500/20" />
                )}

                {/* Block count badge */}
                {blockCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/[0.06] px-1 text-[9px] font-medium text-zinc-400">
                    {blockCount}
                  </span>
                )}

                {/* Block dot indicators */}
                <div className="mt-1.5 flex w-full flex-col gap-0.5">
                  {visibleBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center gap-1 truncate"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotColor[block.status] || "bg-sky-400"}`}
                      />
                      <span className="truncate text-[9px] text-zinc-500 group-hover:text-zinc-400">
                        {block.title}
                      </span>
                    </div>
                  ))}

                  {overflowCount > 0 && (
                    <span className="text-[8px] text-zinc-600 group-hover:text-zinc-500">
                      +{overflowCount} more
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
