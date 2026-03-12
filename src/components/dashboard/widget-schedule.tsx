"use client";

import { motion } from "framer-motion";
import { CalendarDays, ArrowRight, Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useScheduleStore } from "@/lib/schedule-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getMySchedule, type ScheduleItem } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import { LottieIcon } from "./lottie-icon";
import { emptyCalendarAnimation } from "./lottie-data";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import type { WidgetSize } from "@/lib/dashboard-store";

const statusAccent: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled:   { bg: "var(--ghost-emerald)", text: "var(--ghost-emerald-text)", dot: "var(--brand)" },
  en_route:    { bg: "var(--ghost-amber)",   text: "var(--ghost-amber-text)",   dot: "var(--ghost-amber-text)" },
  in_progress: { bg: "var(--ghost-blue)",    text: "var(--ghost-blue-text)",    dot: "var(--ghost-blue-text)" },
  complete:    { bg: "var(--ghost-zinc)",     text: "var(--ghost-zinc-text)",    dot: "var(--ghost-zinc-text)" },
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
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
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

function ScheduleEmptyState() {
  const { t, isCare } = useIndustryLexicon();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <LottieIcon
        animationData={emptyCalendarAnimation}
        size={52}
        loop={false}
        autoplay
      />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-3 text-[13px] font-medium text-[var(--text-muted)]"
      >
        Clear {t("schedule")} today
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-1 text-[10px] text-[var(--text-dim)]"
      >
        {t("Jobs")} will appear here when assigned
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-widest uppercase"
        style={{ background: "var(--ghost-emerald)", color: "var(--ghost-emerald-text)" }}
      >
        <CalendarDays size={9} />
        {t("No blocks scheduled")}
      </motion.div>
    </div>
  );
}

export function WidgetSchedule({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const { t, isCare } = useIndustryLexicon();
  const storeBlocks = useScheduleStore((s) => s.blocks);
  const scheduleLoaded = useScheduleStore((s) => s.loaded);
  const cachedSchedule = useDashboardStore((s) => s.widgetSchedule);
  const setWidgetCache = useDashboardStore((s) => s.setWidgetCache);
  const isWidgetFresh = useDashboardStore((s) => s.isWidgetFresh);
  const [serverBlocks, setServerBlocks] = useState<ScheduleItem[]>(
    (cachedSchedule.data as ScheduleItem[] | null) ?? []
  );
  const [rpcLoaded, setRpcLoaded] = useState(
    cachedSchedule.data !== null && cachedSchedule.data.length > 0
  );

  useEffect(() => {
    // Use cached data immediately, skip fetch if fresh
    if (isWidgetFresh('widgetSchedule') && cachedSchedule.data) {
      setServerBlocks(cachedSchedule.data as ScheduleItem[]);
      setRpcLoaded(true);
      return;
    }
    getMySchedule(size === "large" ? 10 : 5).then(({ data }) => {
      if (data && data.length > 0) {
        setServerBlocks(data);
        setWidgetCache('widgetSchedule', data);
      }
      setRpcLoaded(true);
    });
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!rpcLoaded && !scheduleLoaded && storeBlocks.length === 0) {
    return (
      <WidgetShell delay={0.2}>
        <div className="px-5 py-3 space-y-2">
          {Array.from({ length: size === "small" ? 1 : 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.015] p-3">
              <div className="h-3 w-10 rounded bg-zinc-800/30 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>
              <div className="h-full w-[2px] rounded-full bg-zinc-800/30" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded bg-zinc-800/30 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>
                <div className="h-2 w-16 rounded bg-zinc-800/20 relative overflow-hidden"><span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" /></div>
              </div>
            </div>
          ))}
        </div>
      </WidgetShell>
    );
  }

  if (size === "small") {
    return (
      <WidgetShell delay={0.2}>
        <div
          className="flex h-full cursor-pointer flex-col justify-center p-4"
          onClick={() => nextBlock?.jobId ? router.push(`/dashboard/jobs/${nextBlock.jobId}`) : router.push("/dashboard/schedule")}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarDays size={12} className="text-[var(--text-dim)]" />
            <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-dim)]">Next Up</span>
          </div>
          {nextBlock ? (
            <>
              <div className="truncate text-[12px] font-medium text-[var(--text-body)]">{nextBlock.title}</div>
              <div className="mt-1 flex items-center gap-1">
                <Clock size={8} style={{ color: "var(--ghost-emerald-text)" }} />
                <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--ghost-emerald-text)" }}>{formatHour(nextBlock.startHour)}</span>
              </div>
            </>
          ) : (
            <span className="text-[11px] text-[var(--text-dim)]">No upcoming {t("jobs")}</span>
          )}
        </div>
      </WidgetShell>
    );
  }

  const displayBlocks = size === "large" ? myBlocks : myBlocks.slice(0, 5);

  return (
    <WidgetShell
      delay={0.2}
      header={
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-[var(--text-dim)]" />
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">My {t("Schedule")}</span>
          <span className="font-mono text-[9px] text-[var(--text-dim)]">Today</span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          Full View <ArrowRight size={11} />
        </button>
      }
    >
      <div className="relative px-5 py-3">
        {/* Timeline spine */}
        {displayBlocks.length > 0 && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-[68px] top-3 bottom-3 w-px origin-top"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
            }}
          />
        )}

        {displayBlocks.length === 0 && <ScheduleEmptyState />}

        <div className="space-y-0.5">
          {displayBlocks.map((block, i) => {
            const c = statusAccent[block.status] || statusAccent.scheduled;
            const isNext = block.id === nextBlock?.id;
            const isComplete = block.status === "complete";
            const isPast = block.startHour + block.duration < nowDecimal;

            return (
              <motion.button
                key={block.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => block.jobId && router.push(`/dashboard/jobs/${block.jobId}`)}
                className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                  isComplete || isPast
                    ? "opacity-35"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex w-12 shrink-0 flex-col items-end pt-0.5">
                  <span className="font-mono text-[10px] font-medium tabular-nums" style={{ color: isNext ? c.text : "var(--text-dim)" }}>
                    {formatHour(block.startHour)}
                  </span>
                  <span className="font-mono text-[8px] tabular-nums text-[var(--text-dim)]">{block.duration.toFixed(1)}h</span>
                </div>

                {/* Timeline dot */}
                <div className="relative mt-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: c.dot, opacity: isNext ? 1 : 0.5 }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[12px] font-medium ${isComplete ? "text-[var(--text-dim)] line-through" : "text-[var(--text-body)]"}`}>
                    {block.title}
                  </div>
                  {block.location && (
                    <div className="flex items-center gap-1 text-[9px] text-[var(--text-dim)]">
                      <MapPin size={8} /><span className="truncate">{block.location}</span>
                    </div>
                  )}
                  {isNext && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      transition={{ delay: 0.6 }}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] font-medium tracking-wide uppercase"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
                    >
                      <span className="relative flex h-1 w-1">
                        <span className={`relative inline-flex h-1 w-1 rounded-full ${isCare ? "bg-blue-500" : "bg-emerald-500"}`} />
                      </span>
                      Next Up
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Current time indicator */}
        {nowDecimal >= 7 && nowDecimal <= 18 && displayBlocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="absolute inset-x-5 z-10 flex items-center"
            style={{ top: `${((nowDecimal - 7) / 11) * 100}%` }}
          >
            <div className="h-1 w-1 rounded-full bg-zinc-400" />
            <div className="h-px flex-1 bg-zinc-700" />
            <span className="ml-1 rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[7px] font-medium text-zinc-500">NOW</span>
          </motion.div>
        )}
      </div>
    </WidgetShell>
  );
}
