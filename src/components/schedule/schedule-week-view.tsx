"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { type ScheduleBlock, type Technician } from "@/lib/data";
import { useScheduleStore } from "@/lib/schedule-store";

/* ── Status Color Map (compact version for cards) ──────────── */

const statusDotColor: Record<string, string> = {
  scheduled: "bg-sky-400",
  en_route: "bg-amber-400",
  on_site: "bg-violet-400",
  in_progress: "bg-emerald-400",
  complete: "bg-zinc-500",
  cancelled: "bg-zinc-700",
};

const statusBorderColor: Record<string, string> = {
  scheduled: "border-l-sky-500",
  en_route: "border-l-amber-500",
  on_site: "border-l-violet-500",
  in_progress: "border-l-emerald-500",
  complete: "border-l-zinc-600",
  cancelled: "border-l-zinc-700",
};

/* ── Helpers ───────────────────────────────────────────────── */

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return min === 0 ? `${h12} ${period}` : `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

/** Get Monday of the week containing the given date string (YYYY-MM-DD) */
function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  // Monday = 1; if Sunday (0), go back 6 days
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Generate array of 7 day strings (YYYY-MM-DD) starting from Monday */
function getWeekDays(dateStr: string): string[] {
  const monday = getWeekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function formatWeekHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDayNumber(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDate().toString();
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

/* ── Component ─────────────────────────────────────────────── */

interface ScheduleWeekViewProps {
  blocks: ScheduleBlock[];
  technicians: Technician[];
  selectedDate: string;
  onBlockClick: (blockId: string) => void;
}

export function ScheduleWeekView({
  blocks,
  technicians,
  selectedDate,
  onBlockClick,
}: ScheduleWeekViewProps) {
  const { setSelectedDate, setViewScale } = useScheduleStore();

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  /** Navigate to prev/next week */
  const navigateWeek = (direction: -1 | 1) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + direction * 7);
    const newDate = d.toISOString().split("T")[0];
    setSelectedDate(newDate);
  };

  /** Group blocks by day string */
  const blocksByDay = useMemo(() => {
    const map: Record<string, ScheduleBlock[]> = {};
    for (const day of weekDays) {
      map[day] = [];
    }

    // Blocks have startHour (decimal from midnight) but are loaded for the selected date.
    // In the current data model, all blocks in the store are for the selectedDate.
    // For the week view, we need to show them on the correct day.
    // Since the store loads for a single date, we assign all blocks to selectedDate.
    // This is a simplification — ideally the store would load a date range.
    for (const block of blocks) {
      if (map[selectedDate]) {
        map[selectedDate].push(block);
      }
    }

    return map;
  }, [blocks, weekDays, selectedDate]);

  /** Find technician name by ID */
  const techNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tech of technicians) {
      map[tech.id] = tech.name;
    }
    return map;
  }, [technicians]);

  const weekLabel = `${formatWeekHeader(weekStart)} — ${formatWeekHeader(weekEnd)}`;

  return (
    <div className="flex h-full flex-col">
      {/* Week navigation header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[180px] text-center text-[13px] font-medium text-zinc-300">
            {weekLabel}
          </span>
          <button
            onClick={() => navigateWeek(1)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 overflow-auto scrollbar-none">
        <div className="grid h-full grid-cols-7 divide-x divide-white/[0.04]">
          {weekDays.map((day, colIdx) => {
            const dayBlocks = blocksByDay[day] || [];
            const isTodayCol = isToday(day);
            const isSelected = day === selectedDate;

            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: colIdx * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col ${isTodayCol ? "bg-emerald-500/[0.015]" : ""}`}
              >
                {/* Day column header */}
                <button
                  onClick={() => {
                    setSelectedDate(day);
                    setViewScale("day");
                  }}
                  className="group flex flex-col items-center gap-0.5 border-b border-white/[0.04] py-3 transition-colors hover:bg-white/[0.02]"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    {formatDayLabel(day)}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                      isTodayCol
                        ? "bg-emerald-500 text-white"
                        : isSelected
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-400 group-hover:text-white"
                    }`}
                  >
                    {formatDayNumber(day)}
                  </span>
                </button>

                {/* Block cards */}
                <div className="flex-1 overflow-y-auto scrollbar-none p-1.5 space-y-1">
                  <AnimatePresence>
                    {dayBlocks
                      .sort((a, b) => a.startHour - b.startHour)
                      .map((block, i) => (
                        <motion.button
                          key={block.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: i * 0.02, duration: 0.2 }}
                          onClick={() => onBlockClick(block.id)}
                          className={`w-full cursor-pointer rounded-lg border-l-2 ${statusBorderColor[block.status] || "border-l-sky-500"} bg-white/[0.02] p-2 text-left transition-all duration-150 hover:bg-white/[0.05]`}
                        >
                          {/* Time */}
                          <div className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor[block.status] || "bg-sky-400"}`} />
                            <span className="font-mono text-[9px] text-zinc-500">
                              {formatHour(block.startHour)}
                            </span>
                          </div>

                          {/* Title */}
                          <div className="mt-0.5 truncate text-[11px] font-medium text-zinc-300">
                            {block.title}
                          </div>

                          {/* Technician */}
                          {techNameMap[block.technicianId] && (
                            <div className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-zinc-600">
                              <User size={8} />
                              {techNameMap[block.technicianId]}
                            </div>
                          )}

                          {/* Client */}
                          {block.client && (
                            <div className="mt-0.5 truncate text-[9px] text-zinc-600">
                              {block.client}
                            </div>
                          )}
                        </motion.button>
                      ))}
                  </AnimatePresence>

                  {dayBlocks.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-[10px] text-zinc-700">No jobs</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
