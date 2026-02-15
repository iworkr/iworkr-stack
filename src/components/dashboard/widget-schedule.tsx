"use client";

import { motion } from "framer-motion";
import { CalendarDays, ArrowRight, Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { scheduleBlocks } from "@/lib/data";
import { WidgetShell } from "./widget-shell";

const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  scheduled: { bg: "bg-blue-500/8", border: "border-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  en_route: { bg: "bg-amber-500/8", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-500" },
  in_progress: { bg: "bg-emerald-500/8", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
  complete: { bg: "bg-zinc-500/5", border: "border-zinc-600/20", text: "text-zinc-500", dot: "bg-zinc-500" },
};

function formatHour(h: number) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return min > 0 ? `${h12}:${min.toString().padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

export function WidgetSchedule() {
  const router = useRouter();

  // Mike's schedule (tech-1)
  const myBlocks = useMemo(
    () => scheduleBlocks.filter((b) => b.technicianId === "tech-1").sort((a, b) => a.startHour - b.startHour),
    []
  );

  const now = new Date();
  const nowDecimal = now.getHours() + now.getMinutes() / 60;

  // Find the "next up" block (first block that hasn't started yet or is en_route)
  const nextUpId = useMemo(() => {
    const next = myBlocks.find(
      (b) => b.status === "scheduled" || b.status === "en_route"
    );
    return next?.id;
  }, [myBlocks]);

  return (
    <WidgetShell
      delay={0.15}
      header={
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">My Schedule</span>
          <span className="text-[11px] text-zinc-600">Today</span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Full View
          <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative space-y-0.5 px-4 py-3">
        {myBlocks.map((block, i) => {
          const c = statusColors[block.status] || statusColors.scheduled;
          const isNext = block.id === nextUpId;
          const isComplete = block.status === "complete";
          const isPast = block.startHour + block.duration < nowDecimal;
          const isCurrent =
            block.startHour <= nowDecimal && block.startHour + block.duration > nowDecimal;

          return (
            <motion.button
              key={block.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2 + i * 0.08,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => router.push(`/dashboard/jobs/${block.jobId}`)}
              className={`group relative flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                isNext
                  ? `${c.bg} ${c.border} shadow-[0_0_15px_rgba(94,106,210,0.15)]`
                  : isComplete || isPast
                    ? "border-transparent opacity-50"
                    : `${c.bg} ${c.border}`
              } ${!isComplete ? "hover:brightness-125" : ""}`}
            >
              {/* Time column */}
              <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
                <span className={`text-[10px] font-medium ${c.text}`}>
                  {formatHour(block.startHour)}
                </span>
                <span className="text-[8px] text-zinc-700">
                  {block.duration}h
                </span>
              </div>

              {/* Timeline dot + line */}
              <div className="relative flex flex-col items-center pt-1">
                <div className={`h-2 w-2 rounded-full ${c.dot} ${isCurrent ? "ring-2 ring-white/20" : ""}`} />
                {i < myBlocks.length - 1 && (
                  <div className="mt-0.5 h-6 w-px bg-zinc-800" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[11px] font-medium ${isComplete ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
                  {block.title}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
                  <MapPin size={8} />
                  <span className="truncate">{block.location}</span>
                </div>
                {isNext && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    transition={{ delay: 0.5 }}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[8px] font-medium text-indigo-400"
                  >
                    <Clock size={7} />
                    Next Up
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}

        {/* Current time indicator — red horizontal line */}
        {nowDecimal >= 7 && nowDecimal <= 18 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute inset-x-4 z-10 flex items-center"
            style={{
              top: `${((nowDecimal - 7) / 11) * 100}%`,
            }}
          >
            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <div className="h-px flex-1 bg-red-500/50" />
            <span className="ml-1 rounded bg-red-500/20 px-1 py-0.5 text-[7px] font-medium text-red-400">
              NOW
            </span>
          </motion.div>
        )}
      </div>
    </WidgetShell>
  );
}
