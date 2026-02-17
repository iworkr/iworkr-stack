"use client";

import { motion } from "framer-motion";
import { CalendarDays, ArrowRight, Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useScheduleStore } from "@/lib/schedule-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getMySchedule, type ScheduleItem } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

const statusAccent: Record<string, { bar: string; dot: string; text: string }> = {
  scheduled: { bar: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-500" },
  en_route:  { bar: "bg-amber-500",   dot: "bg-amber-500",   text: "text-amber-400" },
  in_progress: { bar: "bg-blue-500",  dot: "bg-blue-500",    text: "text-blue-400" },
  complete:  { bar: "bg-zinc-600",     dot: "bg-zinc-600",    text: "text-zinc-500" },
};

function formatHour(h: number) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return min > 0 ? `${h12}:${min.toString().padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

function timeToDecimal(timeStr: string): number {
  const d = new Date(timeStr);
  return d.getHours() + d.getMinutes() / 60;
}

function durationHours(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getTime() - s.getTime()) / (1000 * 60 * 60);
}

interface DisplayBlock {
  id: string;
  jobId: string | null;
  title: string;
  location: string;
  startHour: number;
  duration: number;
  status: string;
}

/* ── Empty State with Lottie-style animation ──────────── */
function ScheduleEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-3 flex h-12 w-12 items-center justify-center">
        {/* Orbiting ring */}
        <div className="absolute inset-0 animate-orbit">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-zinc-700" />
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <CalendarDays size={20} strokeWidth={1.5} className="text-zinc-600" />
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[12px] font-medium text-zinc-500"
      >
        Clear schedule today
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-0.5 text-[9px] text-zinc-700"
      >
        Jobs will appear here when assigned
      </motion.p>
    </div>
  );
}

export function WidgetSchedule({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const storeBlocks = useScheduleStore((s) => s.blocks);
  const scheduleLoaded = useScheduleStore((s) => s.loaded);
  const [serverBlocks, setServerBlocks] = useState<ScheduleItem[]>([]);
  const [rpcLoaded, setRpcLoaded] = useState(false);

  useEffect(() => {
    getMySchedule(size === "large" ? 10 : 5).then(({ data }) => {
      if (data && data.length > 0) setServerBlocks(data);
      setRpcLoaded(true);
    });
  }, [size]);

  const myBlocks: DisplayBlock[] = useMemo(() => {
    if (serverBlocks.length > 0) {
      return serverBlocks.map(b => ({
        id: b.id, jobId: b.job_id, title: b.title, location: b.location || "",
        startHour: timeToDecimal(b.start_time), duration: durationHours(b.start_time, b.end_time), status: b.status,
      }));
    }
    if (scheduleLoaded && storeBlocks.length > 0) {
      return storeBlocks.slice(0, size === "large" ? 10 : 5).sort((a, b) => a.startHour - b.startHour).map(b => ({
        id: b.id, jobId: b.jobId, title: b.title, location: b.location || "",
        startHour: b.startHour, duration: b.duration, status: b.status,
      }));
    }
    return [];
  }, [serverBlocks, storeBlocks, scheduleLoaded, size]);

  const now = new Date();
  const nowDecimal = now.getHours() + now.getMinutes() / 60;

  const nextBlock = useMemo(() => {
    return myBlocks.find((b) => b.status === "scheduled" || b.status === "en_route");
  }, [myBlocks]);

  /* ── Loading skeleton ──────────────────────────────── */
  if (!rpcLoaded && !scheduleLoaded && storeBlocks.length === 0) {
    return (
      <WidgetShell delay={0.15}>
        <div className="px-4 py-3 space-y-2">
          {Array.from({ length: size === "small" ? 1 : 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] p-2.5">
              <div className="h-3 w-10 rounded bg-zinc-800/50 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>
              <div className="h-full w-[2px] rounded-full bg-zinc-800/40" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-zinc-800/50 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>
                <div className="h-2 w-16 rounded bg-zinc-800/30 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" /></div>
              </div>
            </div>
          ))}
        </div>
      </WidgetShell>
    );
  }

  /* ── SMALL: "Next Job" card ─────────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.15}>
        <div
          className="flex h-full cursor-pointer flex-col justify-center p-3"
          onClick={() => nextBlock?.jobId ? router.push(`/dashboard/jobs/${nextBlock.jobId}`) : router.push("/dashboard/schedule")}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <CalendarDays size={12} className="text-zinc-600" />
            <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Next Up</span>
          </div>
          {nextBlock ? (
            <>
              <div className="truncate text-[12px] font-medium text-zinc-200">
                {nextBlock.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <Clock size={8} className="text-emerald-500" />
                <span className="text-[10px] text-emerald-500">
                  {formatHour(nextBlock.startHour)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-[11px] text-zinc-600">No upcoming jobs</span>
          )}
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE: Agenda list ────────────────────── */
  const displayBlocks = size === "large" ? myBlocks : myBlocks.slice(0, 5);

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
          className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          Full View <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative space-y-1 px-4 py-3">
        {displayBlocks.length === 0 && <ScheduleEmptyState />}
        {displayBlocks.map((block, i) => {
          const c = statusAccent[block.status] || statusAccent.scheduled;
          const isNext = block.id === nextBlock?.id;
          const isComplete = block.status === "complete";
          const isPast = block.startHour + block.duration < nowDecimal;

          return (
            <motion.button
              key={block.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => block.jobId && router.push(`/dashboard/jobs/${block.jobId}`)}
              className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
                isComplete || isPast
                  ? "opacity-40"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              {/* Thin left status bar */}
              <div className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full ${c.bar} ${isNext ? "opacity-100" : "opacity-40"}`} />

              <div className="flex w-12 shrink-0 flex-col items-end pt-0.5 pl-1">
                <span className={`text-[10px] font-medium ${isNext ? c.text : "text-zinc-500"}`}>{formatHour(block.startHour)}</span>
                <span className="text-[8px] text-zinc-700">{block.duration.toFixed(1)}h</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[11px] font-medium ${isComplete ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
                  {block.title}
                </div>
                {block.location && (
                  <div className="flex items-center gap-1 text-[9px] text-zinc-600">
                    <MapPin size={8} /><span className="truncate">{block.location}</span>
                  </div>
                )}
                {isNext && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    transition={{ delay: 0.5 }}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-500"
                  >
                    <Clock size={7} /> Next Up
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}

        {/* Current time indicator */}
        {nowDecimal >= 7 && nowDecimal <= 18 && displayBlocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute inset-x-4 z-10 flex items-center"
            style={{ top: `${((nowDecimal - 7) / 11) * 100}%` }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
            <div className="h-px flex-1 bg-red-500/30" />
            <span className="ml-1 rounded bg-red-500/10 px-1 py-0.5 text-[7px] font-medium text-red-400/80">NOW</span>
          </motion.div>
        )}
      </div>
    </WidgetShell>
  );
}
