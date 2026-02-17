"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wrench,
  Phone,
  MessageSquare,
  Link2,
  ExternalLink,
  X,
  Clock,
  User,
  Trash2,
  ArrowLeftToLine,
  Copy,
  Calendar,
  LayoutGrid,
  Rows3,
  Navigation,
  Grip,
} from "lucide-react";
import { type ScheduleBlock, type Technician } from "@/lib/data";
import { useScheduleStore, type ViewScale } from "@/lib/schedule-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useOrg } from "@/lib/hooks/use-org";
import { assignJobToSchedule, type BacklogJob } from "@/app/actions/schedule";

/* ── Constants ────────────────────────────────────────────── */

const DAY_START = 6;    // 6 AM
const DAY_END = 19;     // 7 PM
const WORK_START = 7;   // 7 AM
const WORK_END = 17;    // 5 PM
const TOTAL_HOURS = DAY_END - DAY_START;
const RESOURCE_COL_W = 200;
const ROW_H = 80;
const HOUR_W = 120; // pixels per hour

const statusColorMap: Record<string, { bg: string; border: string; text: string; accent: string; dot: string }> = {
  scheduled: {
    bg: "bg-blue-500/8",
    border: "border-blue-500/25",
    text: "text-blue-200",
    accent: "bg-blue-500",
    dot: "bg-blue-400",
  },
  en_route: {
    bg: "bg-amber-500/8",
    border: "border-amber-500/25",
    text: "text-amber-200",
    accent: "bg-amber-500",
    dot: "bg-amber-400",
  },
  in_progress: {
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/25",
    text: "text-emerald-200",
    accent: "bg-emerald-500",
    dot: "bg-emerald-400",
  },
  complete: {
    bg: "bg-zinc-500/8",
    border: "border-zinc-600/25",
    text: "text-zinc-400",
    accent: "bg-zinc-500",
    dot: "bg-zinc-400",
  },
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  en_route: "En Route",
  in_progress: "In Progress",
  complete: "Complete",
};

const viewScaleLabels: Record<ViewScale, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Mission Control", icon: <ExternalLink size={13} />, shortcut: "↵" },
  { id: "copy", label: "Copy Job ID", icon: <Copy size={13} />, shortcut: "⌘L" },
  { id: "divider-1", label: "", divider: true },
  { id: "unschedule", label: "Unschedule", icon: <ArrowLeftToLine size={13} /> },
  { id: "delete", label: "Delete", icon: <Trash2 size={13} />, danger: true },
];

/* ── Helpers ──────────────────────────────────────────────── */

function timeToDecimalHours(timeStr: string): number {
  const date = new Date(timeStr);
  return date.getHours() + date.getMinutes() / 60;
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return min === 0 ? `${h12} ${period}` : `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function hourToX(hour: number): number {
  return (hour - DAY_START) * HOUR_W;
}

function xToHour(x: number): number {
  return DAY_START + x / HOUR_W;
}

function snapToGrid(hour: number): number {
  return Math.round(hour * 4) / 4; // snap to 15-min
}

/* ── Page Component ───────────────────────────────────────── */

export default function SchedulePage() {
  const router = useRouter();
  const {
    blocks,
    technicians: storeTechnicians,
    backlogJobs,
    scheduleEvents,
    loading,
    viewScale,
    peekBlockId,
    unscheduledDrawerOpen,
    selectedDate,
    setViewScale,
    setPeekBlockId,
    setUnscheduledDrawerOpen,
    moveBlock,
    resizeBlock,
    deleteBlock,
    restoreBlock,
    refresh,
  } = useScheduleStore();
  const { addToast } = useToastStore();
  const { orgId } = useOrg();

  // Use store technicians (live data) — no mock fallback
  const technicians = storeTechnicians;

  /* ── Drag state ─────────────────────────────────────────── */
  const [dragState, setDragState] = useState<{
    blockId: string;
    startX: number;
    startY: number;
    origHour: number;
    origTechId: string;
    mode: "move" | "resize";
  } | null>(null);
  const [dragDelta, setDragDelta] = useState({ dx: 0, dy: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);

  /* ── Context menu ───────────────────────────────────────── */
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; blockId: string }>({
    open: false, x: 0, y: 0, blockId: "",
  });

  /* ── Now line ───────────────────────────────────────────── */
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowX = hourToX(Math.max(DAY_START, Math.min(DAY_END, nowHour)));

  /* ── Hours array ────────────────────────────────────────── */
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i);

  /* ── Backlog jobs (unscheduled) ─────────────────────────── */
  const scheduledJobIds = new Set(blocks.map((b) => b.jobId));

  /* ── Keyboard shortcuts ─────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "v" || e.key === "V") {
        // Week/Month views disabled for this sprint — keep Day only
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        setUnscheduledDrawerOpen(!unscheduledDrawerOpen);
        return;
      }
      if (e.key === "Escape") {
        if (peekBlockId) setPeekBlockId(null);
        else if (unscheduledDrawerOpen) setUnscheduledDrawerOpen(false);
      }
    },
    [viewScale, setViewScale, peekBlockId, setPeekBlockId, unscheduledDrawerOpen, setUnscheduledDrawerOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Drag handlers ──────────────────────────────────────── */
  const handleDragStart = useCallback(
    (e: React.MouseEvent, blockId: string, mode: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      setPeekBlockId(null);
      setDragState({
        blockId,
        startX: e.clientX,
        startY: e.clientY,
        origHour: block.startHour,
        origTechId: block.technicianId,
        mode,
      });
      setDragDelta({ dx: 0, dy: 0 });
    },
    [blocks, setPeekBlockId]
  );

  useEffect(() => {
    if (!dragState) return;

    function onMove(e: MouseEvent) {
      setDragDelta({
        dx: e.clientX - dragState!.startX,
        dy: e.clientY - dragState!.startY,
      });
    }

    function onUp(e: MouseEvent) {
      const dx = e.clientX - dragState!.startX;
      const dy = e.clientY - dragState!.startY;
      const block = blocks.find((b) => b.id === dragState!.blockId);
      if (!block) { setDragState(null); return; }

      if (dragState!.mode === "move") {
        const hourDelta = dx / HOUR_W;
        const newHour = snapToGrid(dragState!.origHour + hourDelta);
        // Determine new technician by Y offset
        const rowDelta = Math.round(dy / ROW_H);
        const origIdx = technicians.findIndex((t) => t.id === dragState!.origTechId);
        const newIdx = Math.max(0, Math.min(technicians.length - 1, origIdx + rowDelta));
        const newTechId = technicians[newIdx].id;

        if (newHour !== block.startHour || newTechId !== block.technicianId) {
          moveBlock(block.id, newHour, newTechId);
          const techName = technicians[newIdx].name.split(" ")[0];
          addToast(
            `Rescheduled to ${formatHour(newHour)}${newTechId !== block.technicianId ? ` — ${techName}` : ""}`,
            () => moveBlock(block.id, block.startHour, block.technicianId)
          );
        }
      } else {
        // Resize
        const hourDelta = dx / HOUR_W;
        const newDuration = snapToGrid(block.duration + hourDelta);
        if (newDuration !== block.duration && newDuration >= 0.25) {
          resizeBlock(block.id, newDuration);
          addToast(`Duration: ${formatDuration(newDuration)}`);
        }
      }

      setDragState(null);
      setDragDelta({ dx: 0, dy: 0 });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, blocks, moveBlock, resizeBlock, addToast]);

  /* ── Context menu handler ───────────────────────────────── */
  function handleContextAction(actionId: string) {
    const block = blocks.find((b) => b.id === ctxMenu.blockId);
    if (!block) return;

    if (actionId === "open") {
      router.push(`/dashboard/jobs/${block.jobId}`);
    } else if (actionId === "copy") {
      navigator.clipboard?.writeText(block.jobId);
      addToast(`${block.jobId} copied`);
    } else if (actionId === "unschedule" || actionId === "delete") {
      const deleted = block;
      deleteBlock(block.id);
      addToast(
        actionId === "unschedule"
          ? `${block.title} moved to backlog`
          : `${block.title} deleted`,
        () => restoreBlock(deleted)
      );
    }
  }

  /* ── Conflict count ─────────────────────────────────────── */
  const conflictCount = blocks.filter((b) => b.conflict).length;

  /* ── Render ─────────────────────────────────────────────── */
  const totalWidth = TOTAL_HOURS * HOUR_W;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-medium text-zinc-200">Schedule</h1>

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                const newDate = d.toISOString().split("T")[0];
                useScheduleStore.getState().setSelectedDate(newDate);
                if (orgId) useScheduleStore.getState().loadFromServer(orgId, newDate);
              }}
              className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-400"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[100px] text-center text-[13px] font-medium text-zinc-300">
              {(() => {
                const d = new Date(selectedDate + "T12:00:00");
                const today = new Date();
                const isToday = d.toDateString() === today.toDateString();
                const label = d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
                return isToday ? `Today — ${label}` : label;
              })()}
            </span>
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                const newDate = d.toISOString().split("T")[0];
                useScheduleStore.getState().setSelectedDate(newDate);
                if (orgId) useScheduleStore.getState().loadFromServer(orgId, newDate);
              }}
              className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-400"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              useScheduleStore.getState().setSelectedDate(today);
              if (orgId) useScheduleStore.getState().loadFromServer(orgId, today);
            }}
            className="rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[11px] text-zinc-500 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Conflict indicator */}
          {conflictCount > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-red-500"
              />
              {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
            </span>
          )}

          {/* View scale toggle */}
          <div className="flex items-center rounded-md border border-[rgba(255,255,255,0.08)]">
            {(["day", "week", "month"] as ViewScale[]).map((scale) => {
              const isDisabled = scale !== "day";
              return (
                <button
                  key={scale}
                  onClick={() => !isDisabled && setViewScale(scale)}
                  disabled={isDisabled}
                  title={isDisabled ? "Coming soon" : viewScaleLabels[scale]}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed text-zinc-700"
                      : viewScale === scale
                        ? "bg-[rgba(255,255,255,0.06)] text-zinc-200"
                        : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {viewScaleLabels[scale]}
                </button>
              );
            })}
          </div>

          {/* Unscheduled drawer toggle */}
          <button
            onClick={() => setUnscheduledDrawerOpen(!unscheduledDrawerOpen)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              unscheduledDrawerOpen
                ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.04)] text-zinc-300"
                : "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Rows3 size={12} />
            Backlog
            <kbd className="ml-1 rounded bg-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[8px] text-zinc-600">
              U
            </kbd>
          </button>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Timeline area ────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Hour headers */}
          <div className="flex border-b border-[rgba(255,255,255,0.06)]" style={{ paddingLeft: RESOURCE_COL_W }}>
            <div className="overflow-hidden" style={{ width: `calc(100% - 0px)` }}>
              <div className="flex" style={{ width: totalWidth }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex-shrink-0 border-l border-[rgba(255,255,255,0.04)] py-2 text-center"
                    style={{ width: HOUR_W }}
                  >
                    <span className="font-mono text-[10px] text-zinc-600">
                      {formatHour(h)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Technician rows */}
          <div ref={timelineRef} className="flex-1 overflow-auto">
            {/* Empty state */}
            {technicians.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  <Calendar size={22} strokeWidth={1} className="text-zinc-700" />
                </div>
                <h3 className="text-[15px] font-medium text-zinc-300">No schedule data</h3>
                <p className="mt-1 text-[12px] text-zinc-600">Assign technicians and jobs to see the dispatch board.</p>
                <p className="mt-0.5 text-[11px] text-zinc-700">Schedule blocks will appear here once created.</p>
              </motion.div>
            )}

            {technicians.map((tech, techIdx) => {
              const techBlocks = blocks.filter((b) => b.technicianId === tech.id);
              const capacityPct = (tech.hoursBooked / tech.hoursAvailable) * 100;

              return (
                <div key={tech.id} className="flex border-b border-[rgba(255,255,255,0.04)]">
                  {/* ── Resource column (sticky left) ──────── */}
                  <div
                    className="sticky left-0 z-10 box-border flex h-[80px] w-[200px] shrink-0 items-center gap-3 border-r border-[rgba(255,255,255,0.06)] bg-[#050505] px-4"
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400">
                        {tech.initials}
                      </div>
                      {/* Status dot */}
                      <div
                        className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full ring-2 ring-[#050505] ${
                          tech.status === "online"
                            ? "bg-emerald-400"
                            : tech.status === "away"
                              ? "bg-amber-400"
                              : "bg-zinc-600"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-zinc-300">
                        {tech.name}
                      </div>
                      {/* Capacity bar */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, capacityPct)}%` }}
                            transition={{ duration: 0.6, delay: techIdx * 0.1, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              capacityPct > 90
                                ? "bg-red-500/60"
                                : capacityPct > 70
                                  ? "bg-amber-500/50"
                                  : "bg-emerald-500/40"
                            }`}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-600">
                          {tech.hoursBooked}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Timeline track ─────────────────────── */}
                  <div className="relative flex-1 overflow-hidden" style={{ height: ROW_H }}>
                    <div className="relative h-full" style={{ width: totalWidth }}>
                      {/* Grid lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 h-full w-px bg-[rgba(255,255,255,0.03)]"
                          style={{ left: hourToX(h) }}
                        />
                      ))}

                      {/* Non-working hours shading */}
                      {/* Before work */}
                      <div
                        className="absolute top-0 h-full bg-[rgba(255,255,255,0.015)]"
                        style={{
                          left: 0,
                          width: hourToX(WORK_START),
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 5px)",
                        }}
                      />
                      {/* After work */}
                      <div
                        className="absolute top-0 h-full bg-[rgba(255,255,255,0.015)]"
                        style={{
                          left: hourToX(WORK_END),
                          width: totalWidth - hourToX(WORK_END),
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 5px)",
                        }}
                      />

                      {/* Now line */}
                      {techIdx === 0 ? null : null}
                      <div
                        className="absolute top-0 z-20 h-full"
                        style={{ left: nowX }}
                      >
                        <div className="h-full w-px bg-red-500/50" />
                      </div>

                      {/* Schedule Events (breaks/meetings) */}
                      {scheduleEvents
                        .filter((evt) => evt.user_id === tech.id)
                        .map((evt, i) => {
                          const evtStart = timeToDecimalHours(evt.start_time);
                          const evtDuration = calculateDuration(evt.start_time, evt.end_time);
                          const evtLeft = hourToX(evtStart);
                          const evtWidth = evtDuration * HOUR_W;
                          const typeColor = evt.type === "break"
                            ? "bg-zinc-500/10 border-zinc-600/30"
                            : evt.type === "meeting"
                              ? "bg-purple-500/10 border-purple-500/25"
                              : evt.type === "personal"
                                ? "bg-teal-500/10 border-teal-500/25"
                                : "bg-red-500/10 border-red-500/25";

                          return (
                            <motion.div
                              key={evt.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.02 }}
                              className={`absolute top-2 z-[5] rounded-md border border-dashed ${typeColor}`}
                              style={{
                                left: evtLeft,
                                width: Math.max(24, evtWidth),
                                height: ROW_H - 16,
                              }}
                            >
                              <div className="flex h-full items-center justify-center truncate px-2">
                                <span className="truncate text-[9px] text-zinc-500">
                                  {evt.title}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })
                      }

                      {/* Job Blocks */}
                      {techBlocks.map((block, i) => {
                        const colors = statusColorMap[block.status] || statusColorMap.scheduled;
                        const isDragging = dragState?.blockId === block.id;
                        const isPeeking = peekBlockId === block.id;

                        let blockLeft = hourToX(block.startHour);
                        let blockWidth = block.duration * HOUR_W;

                        // Apply drag offset
                        if (isDragging && dragState) {
                          if (dragState.mode === "move") {
                            blockLeft += dragDelta.dx;
                          } else {
                            blockWidth += dragDelta.dx;
                            blockWidth = Math.max(HOUR_W * 0.25, blockWidth);
                          }
                        }

                        // Travel time ghost
                        const travelW = block.travelTime
                          ? (block.travelTime / 60) * HOUR_W
                          : 0;

                        return (
                          <div key={block.id}>
                            {/* Travel time ghost block */}
                            {travelW > 0 && !isDragging && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: techIdx * 0.05 + i * 0.03 + 0.1 }}
                                className="absolute top-3 h-[calc(100%-24px)] rounded-md border border-dashed border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]"
                                style={{
                                  left: hourToX(block.startHour) - travelW,
                                  width: travelW,
                                }}
                              >
                                <div className="flex h-full items-center justify-center">
                                  <Navigation size={8} className="text-zinc-700" />
                                </div>
                              </motion.div>
                            )}

                            {/* Main block */}
                            <motion.div
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{
                                opacity: 1,
                                scaleX: 1,
                                scale: isDragging ? 1.03 : 1,
                                zIndex: isDragging ? 30 : isPeeking ? 25 : 10,
                              }}
                              transition={{
                                delay: isDragging ? 0 : techIdx * 0.05 + i * 0.03,
                                duration: 0.3,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className={`absolute top-2 origin-left cursor-grab rounded-md border-r border-t border-b transition-shadow ${colors.bg} ${
                                block.conflict
                                  ? "border-red-500/60"
                                  : colors.border
                              } ${
                                isDragging ? "shadow-xl shadow-black/40" : ""
                              } ${
                                isPeeking ? "ring-1 ring-white/20" : ""
                              }`}
                              style={{
                                left: blockLeft,
                                width: Math.max(24, blockWidth),
                                height: ROW_H - 16,
                                transform: isDragging && dragState?.mode === "move"
                                  ? `translateY(${dragDelta.dy}px)`
                                  : undefined,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPeekBlockId(isPeeking ? null : block.id);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCtxMenu({ open: true, x: e.clientX, y: e.clientY, blockId: block.id });
                              }}
                              onMouseDown={(e) => {
                                if (e.button === 0) handleDragStart(e, block.id, "move");
                              }}
                            >
                              {/* Left accent border */}
                              <div className={`absolute left-0 top-0 h-full w-[3px] rounded-l-md ${colors.accent}`} />

                              {/* Content */}
                              <div className="flex h-full flex-col justify-center truncate pl-2.5 pr-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[8px] text-zinc-600">
                                    {block.jobId}
                                  </span>
                                  <span className={`truncate text-[10px] font-medium ${colors.text}`}>
                                    {block.client}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 truncate">
                                  <Wrench size={8} className="shrink-0 text-zinc-600" />
                                  <span className="truncate text-[9px] text-zinc-500">
                                    {block.title}
                                  </span>
                                </div>
                                {blockWidth > 80 && (
                                  <div className="flex items-center gap-1 truncate">
                                    <MapPin size={7} className="shrink-0 text-zinc-700" />
                                    <span className="truncate text-[8px] text-zinc-600">
                                      {block.location}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Conflict badge */}
                              {block.conflict && (
                                <motion.div
                                  animate={{ scale: [1, 1.3, 1] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#050505]"
                                />
                              )}

                              {/* Resize handle */}
                              <div
                                className="absolute top-0 right-0 h-full w-2 cursor-ew-resize opacity-0 transition-opacity hover:opacity-100"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, block.id, "resize");
                                }}
                              >
                                <div className="flex h-full items-center justify-center">
                                  <Grip size={8} className="text-zinc-500" />
                                </div>
                              </div>

                              {/* ── Peek Popover ───────────── */}
                              <AnimatePresence>
                                {isPeeking && !isDragging && (
                                  <JobPeekCard
                                    block={block}
                                    onClose={() => setPeekBlockId(null)}
                                    onOpenFull={() => {
                                      setPeekBlockId(null);
                                      router.push(`/dashboard/jobs/${block.jobId}`);
                                    }}
                                  />
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Now line label at top */}
            <div
              className="pointer-events-none fixed z-30"
              style={{ left: RESOURCE_COL_W + nowX - 12 }}
            />
          </div>
        </div>

        {/* ── Unscheduled Drawer ────────────────────────────── */}
        <AnimatePresence>
          {unscheduledDrawerOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="shrink-0 overflow-hidden border-l border-[rgba(255,255,255,0.06)] bg-[#050505]"
            >
              <div className="flex h-full w-[280px] flex-col">
                {/* Drawer header */}
                <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Rows3 size={13} className="text-zinc-500" />
                    <span className="text-[13px] font-medium text-zinc-300">
                      Backlog
                    </span>
                  </div>
                  <button
                    onClick={() => setUnscheduledDrawerOpen(false)}
                    className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-400"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Backlog items */}
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-2">
                    {backlogJobs.length > 0 ? (
                      backlogJobs.map((item: BacklogJob) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="cursor-grab rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 transition-colors hover:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-zinc-600">
                                  {item.display_id}
                                </span>
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    item.priority === "urgent"
                                      ? "bg-red-400"
                                      : item.priority === "high"
                                        ? "bg-orange-400"
                                        : item.priority === "medium"
                                          ? "bg-yellow-500"
                                          : "bg-blue-400"
                                  }`}
                                />
                              </div>
                              <div className="mt-1 truncate text-[12px] font-medium text-zinc-300">
                                {item.title}
                              </div>
                              {item.client_name && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-600">
                                  <User size={8} />
                                  {item.client_name}
                                </div>
                              )}
                              {item.location && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-600">
                                  <MapPin size={8} />
                                  {item.location}
                                </div>
                              )}
                              {item.estimated_duration_minutes && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-600">
                                  <Clock size={8} />
                                  {item.estimated_duration_minutes}m est.
                                </div>
                              )}
                            </div>
                            <Grip size={12} className="shrink-0 text-zinc-700" />
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8 text-center">
                        <Calendar size={20} className="mb-2 text-zinc-700" />
                        <p className="text-[12px] text-zinc-600">No unscheduled jobs</p>
                        <p className="mt-0.5 text-[10px] text-zinc-700">
                          Create a job to see it here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context Menu */}
      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={contextItems}
        onSelect={handleContextAction}
        onClose={() => setCtxMenu((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}

/* ── Job Peek Card Component ──────────────────────────────── */

function JobPeekCard({
  block,
  onClose,
  onOpenFull,
}: {
  block: ScheduleBlock;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const colors = statusColorMap[block.status] || statusColorMap.scheduled;
  const { addToast } = useToastStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-full left-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.1)] bg-zinc-950/90 shadow-2xl backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5">
        <button
          onClick={onOpenFull}
          className="font-mono text-[12px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {block.jobId}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px]">
            <motion.span
              animate={
                block.status === "in_progress" || block.status === "en_route"
                  ? { opacity: [1, 0.3, 1] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
            />
            <span className={colors.text}>{statusLabels[block.status]}</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Mini Map */}
      <div className="relative h-[100px] bg-[#080808]">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Grid effect */}
          <div className="absolute inset-0 opacity-[0.03]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0 border-t border-white"
                style={{ top: `${i * 20}%` }}
              />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0 border-l border-white"
                style={{ left: `${i * 10}%` }}
              />
            ))}
          </div>
          {/* Pin */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
            className="relative z-10"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5E6AD2] shadow-lg shadow-[#5E6AD2]/30">
              <MapPin size={10} className="text-white" />
            </div>
            <motion.div
              animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border border-[#5E6AD2]"
            />
          </motion.div>
        </div>
        {/* Directions button */}
        <button
          onClick={() => {
            if (!block.location) { addToast("No location set for this job"); return; }
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.location)}`, "_blank");
          }}
          className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur-sm transition-colors hover:text-zinc-200"
        >
          <Navigation size={9} />
          Directions
        </button>
        {/* Address */}
        <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-500 backdrop-blur-sm">
          {block.location}
        </div>
      </div>

      {/* Data Grid */}
      <div className="space-y-0 border-t border-[rgba(255,255,255,0.06)] p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[9px] tracking-wider text-zinc-600 uppercase">Time</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-300">
              <Clock size={10} className="text-zinc-500" />
              {formatHour(block.startHour)} — {formatHour(block.startHour + block.duration)}
            </div>
            <div className="text-[10px] text-zinc-600">
              {formatDuration(block.duration)}
            </div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider text-zinc-600 uppercase">Client</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-300">
              <User size={10} className="text-zinc-500" />
              {block.client}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[9px] tracking-wider text-zinc-600 uppercase">Service</div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-300">
            <Wrench size={10} className="text-zinc-500" />
            {block.title}
          </div>
        </div>
        {block.travelTime && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
            <Navigation size={8} />
            {block.travelTime} min travel from previous job
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-4 py-2.5">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onOpenFull}
          className="flex items-center gap-1.5 rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#6E7AE2]"
        >
          <ExternalLink size={11} />
          Open Mission Control
        </motion.button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addToast("No phone number configured")}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
            title="Call"
          >
            <Phone size={12} />
          </button>
          <button
            onClick={() => addToast("No phone number configured")}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
            title="Message"
          >
            <MessageSquare size={12} />
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(block.jobId);
              addToast(`${block.jobId} copied`);
            }}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
            title="Copy link"
          >
            <Link2 size={12} />
          </button>
          <button
            onClick={() => {
              if (!block.location) { addToast("No location set for this job"); return; }
              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.location)}`, "_blank");
            }}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
            title="Directions"
          >
            <Navigation size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
