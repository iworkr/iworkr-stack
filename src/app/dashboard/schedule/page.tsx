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
  Rows3,
  Navigation,
  Grip,
  GripVertical,
  Inbox,
} from "lucide-react";
import { type ScheduleBlock, type Technician } from "@/lib/data";
import { useScheduleStore, type ViewScale } from "@/lib/schedule-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useOrg } from "@/lib/hooks/use-org";
import { type BacklogJob } from "@/app/actions/schedule";

/* ── Constants ────────────────────────────────────────────── */

const DAY_START = 6;
const DAY_END = 19;
const WORK_START = 7;
const WORK_END = 17;
const TOTAL_HOURS = DAY_END - DAY_START;
const RESOURCE_COL_W = 200;
const ROW_H = 80;
const HOUR_W = 120;

/* ── Glass & Spine Status Palette ──────────────────────────── */

const statusColorMap: Record<string, { spine: string; dot: string; label: string; text: string }> = {
  scheduled: {
    spine: "bg-sky-500",
    dot: "bg-sky-400",
    label: "text-sky-400",
    text: "text-sky-300",
  },
  en_route: {
    spine: "bg-amber-500",
    dot: "bg-amber-400",
    label: "text-amber-400",
    text: "text-amber-300",
  },
  in_progress: {
    spine: "bg-emerald-500",
    dot: "bg-emerald-400",
    label: "text-emerald-400",
    text: "text-emerald-300",
  },
  complete: {
    spine: "bg-zinc-600",
    dot: "bg-zinc-500",
    label: "text-zinc-500",
    text: "text-zinc-400",
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

function snapToGrid(hour: number): number {
  return Math.round(hour * 4) / 4;
}

/* ── Drag Types ──────────────────────────────────────────── */

type DragSource = "block" | "backlog";

interface DragState {
  source: DragSource;
  blockId?: string;
  backlogJob?: BacklogJob;
  startX: number;
  startY: number;
  origHour: number;
  origTechId: string;
  mode: "move" | "resize";
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
    unscheduleBlock,
    assignBacklogJob,
    refresh,
  } = useScheduleStore();
  const { addToast } = useToastStore();
  const { orgId } = useOrg();

  const technicians = storeTechnicians;

  /* ── Drag state ─────────────────────────────────────────── */
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragDelta, setDragDelta] = useState({ dx: 0, dy: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);

  /* ── Drop target highlight ──────────────────────────────── */
  const [dropTarget, setDropTarget] = useState<{ techIdx: number; hour: number } | null>(null);

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

  /* ── Keyboard shortcuts ─────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

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
    [peekBlockId, setPeekBlockId, unscheduledDrawerOpen, setUnscheduledDrawerOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Block Drag handlers ────────────────────────────────── */
  const handleBlockDragStart = useCallback(
    (e: React.MouseEvent, blockId: string, mode: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      setPeekBlockId(null);
      setDragState({
        source: "block",
        blockId,
        startX: e.clientX,
        startY: e.clientY,
        origHour: block.startHour,
        origTechId: block.technicianId,
        mode,
      });
      setMousePos({ x: e.clientX, y: e.clientY });
      setDragDelta({ dx: 0, dy: 0 });
    },
    [blocks, setPeekBlockId]
  );

  /* ── Backlog Drag handlers ──────────────────────────────── */
  const handleBacklogDragStart = useCallback(
    (e: React.MouseEvent, job: BacklogJob) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        source: "backlog",
        backlogJob: job,
        startX: e.clientX,
        startY: e.clientY,
        origHour: WORK_START,
        origTechId: "",
        mode: "move",
      });
      setMousePos({ x: e.clientX, y: e.clientY });
      setDragDelta({ dx: 0, dy: 0 });
    },
    []
  );

  /* ── Compute drop target from mouse position ────────────── */
  const computeDropTarget = useCallback(
    (clientX: number, clientY: number) => {
      if (!timelineRef.current || technicians.length === 0) return null;

      const rect = timelineRef.current.getBoundingClientRect();
      const scrollTop = timelineRef.current.scrollTop;
      const scrollLeft = timelineRef.current.scrollLeft;

      const relX = clientX - rect.left + scrollLeft - RESOURCE_COL_W;
      const relY = clientY - rect.top + scrollTop;

      if (relX < 0) return null;

      const techIdx = Math.max(0, Math.min(technicians.length - 1, Math.floor(relY / ROW_H)));
      const rawHour = DAY_START + relX / HOUR_W;
      const hour = snapToGrid(Math.max(DAY_START, Math.min(DAY_END - 0.25, rawHour)));

      return { techIdx, hour };
    },
    [technicians]
  );

  /* ── Global mouse move/up for drag ──────────────────────── */
  useEffect(() => {
    if (!dragState) return;

    function onMove(e: MouseEvent) {
      setMousePos({ x: e.clientX, y: e.clientY });
      setDragDelta({
        dx: e.clientX - dragState!.startX,
        dy: e.clientY - dragState!.startY,
      });

      const target = computeDropTarget(e.clientX, e.clientY);
      setDropTarget(target);
    }

    function onUp(e: MouseEvent) {
      if (dragState!.source === "block") {
        const block = blocks.find((b) => b.id === dragState!.blockId);
        if (!block) { resetDrag(); return; }

        if (dragState!.mode === "move") {
          const target = computeDropTarget(e.clientX, e.clientY);
          if (target) {
            const newHour = target.hour;
            const newTechId = technicians[target.techIdx].id;

            if (newHour !== block.startHour || newTechId !== block.technicianId) {
              moveBlock(block.id, newHour, newTechId);
              const techName = technicians[target.techIdx].name.split(" ")[0];
              addToast(
                `Rescheduled to ${formatHour(newHour)}${newTechId !== block.technicianId ? ` — ${techName}` : ""}`,
                () => moveBlock(block.id, block.startHour, block.technicianId)
              );
            }
          }
        } else {
          const dx = e.clientX - dragState!.startX;
          const hourDelta = dx / HOUR_W;
          const newDuration = snapToGrid(block.duration + hourDelta);
          if (newDuration !== block.duration && newDuration >= 0.25) {
            resizeBlock(block.id, newDuration);
            addToast(`Duration: ${formatDuration(newDuration)}`);
          }
        }
      } else if (dragState!.source === "backlog") {
        const target = computeDropTarget(e.clientX, e.clientY);
        if (target && dragState!.backlogJob) {
          const techId = technicians[target.techIdx].id;
          const techName = technicians[target.techIdx].name.split(" ")[0];
          assignBacklogJob(dragState!.backlogJob, techId, target.hour);
          addToast(`${dragState!.backlogJob.title} → ${techName} at ${formatHour(target.hour)}`);
        }
      }

      resetDrag();
    }

    function resetDrag() {
      setDragState(null);
      setDragDelta({ dx: 0, dy: 0 });
      setDropTarget(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, blocks, technicians, moveBlock, resizeBlock, addToast, assignBacklogJob, computeDropTarget]);

  /* ── Context menu handler ───────────────────────────────── */
  function handleContextAction(actionId: string) {
    const block = blocks.find((b) => b.id === ctxMenu.blockId);
    if (!block) return;

    if (actionId === "open") {
      router.push(`/dashboard/jobs/${block.jobId}`);
    } else if (actionId === "copy") {
      navigator.clipboard?.writeText(block.jobId);
      addToast(`${block.jobId} copied`);
    } else if (actionId === "unschedule") {
      unscheduleBlock(block.id);
      addToast(`${block.title} moved to backlog`);
    } else if (actionId === "delete") {
      const deleted = block;
      deleteBlock(block.id);
      addToast(`${block.title} deleted`, () => restoreBlock(deleted));
    }
  }

  /* ── Conflict count ─────────────────────────────────────── */
  const conflictCount = blocks.filter((b) => b.conflict).length;

  /* ── Ghost dimensions for backlog drag ──────────────────── */
  const ghostDuration = dragState?.source === "backlog"
    ? ((dragState.backlogJob?.estimated_duration_minutes || 60) / 60)
    : dragState?.source === "block"
      ? (blocks.find((b) => b.id === dragState.blockId)?.duration || 1)
      : 1;

  /* ── Render ─────────────────────────────────────────────── */
  const totalWidth = TOTAL_HOURS * HOUR_W;

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Control Deck Header ──────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-medium text-white">Schedule</h1>

          {/* Date Navigator: < [ Today, Feb 17 ] > */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                const newDate = d.toISOString().split("T")[0];
                useScheduleStore.getState().setSelectedDate(newDate);
                if (orgId) useScheduleStore.getState().loadFromServer(orgId, newDate);
              }}
              className="rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[110px] text-center text-[13px] font-medium text-white">
              {(() => {
                const d = new Date(selectedDate + "T12:00:00");
                const today = new Date();
                const isToday = d.toDateString() === today.toDateString();
                const label = d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
                return isToday ? `Today, ${label}` : label;
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
              className="rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white"
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
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors duration-150 hover:border-white/[0.1] hover:text-white"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
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

          {/* View Switcher — Segmented pill */}
          <div className="flex items-center rounded-lg bg-zinc-900 p-1">
            {(["day", "week", "month"] as ViewScale[]).map((scale) => {
              const isDisabled = scale !== "day";
              const isActive = viewScale === scale;
              return (
                <button
                  key={scale}
                  onClick={() => !isDisabled && setViewScale(scale)}
                  disabled={isDisabled}
                  title={isDisabled ? "Coming soon" : viewScaleLabels[scale]}
                  className={`rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150 ${
                    isDisabled
                      ? "cursor-not-allowed text-zinc-700"
                      : isActive
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {viewScaleLabels[scale]}
                </button>
              );
            })}
          </div>

          {/* Backlog toggle */}
          <button
            onClick={() => setUnscheduledDrawerOpen(!unscheduledDrawerOpen)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-all duration-150 ${
              unscheduledDrawerOpen
                ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400"
                : "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300"
            }`}
          >
            <Rows3 size={12} />
            Backlog
            {backlogJobs.length > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500">
                {backlogJobs.length}
              </span>
            )}
            <kbd className="ml-1 rounded bg-white/[0.04] px-1 py-0.5 font-mono text-[8px] text-zinc-600">
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
          <div className="flex border-b border-white/[0.04]" style={{ paddingLeft: RESOURCE_COL_W }}>
            <div className="overflow-hidden" style={{ width: `calc(100% - 0px)` }}>
              <div className="flex" style={{ width: totalWidth }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex-shrink-0 border-l border-white/[0.06] py-2 text-center"
                    style={{ width: HOUR_W }}
                  >
                    <span className="font-mono text-[10px] text-zinc-500">
                      {formatHour(h)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Technician rows */}
          <div ref={timelineRef} className="flex-1 overflow-auto">
            {technicians.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                {/* Lottie-style empty state */}
                <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-white/[0.04] animate-signal-pulse" />
                  <div className="absolute inset-2 rounded-full border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.6s" }} />
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <Calendar size={18} strokeWidth={1.5} className="text-zinc-600" />
                  </div>
                </div>
                <h3 className="text-[14px] font-medium text-zinc-300">No schedule data</h3>
                <p className="mt-1 text-[12px] text-zinc-600">Assign technicians and jobs to see the dispatch board.</p>
              </motion.div>
            )}

            {technicians.map((tech, techIdx) => {
              const techBlocks = blocks.filter((b) => b.technicianId === tech.id);
              const capacityPct = (tech.hoursBooked / tech.hoursAvailable) * 100;
              const isDropRow = dropTarget?.techIdx === techIdx && dragState !== null;

              return (
                <motion.div
                  key={tech.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: techIdx * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className={`group flex border-b transition-colors duration-150 ${
                    isDropRow
                      ? "border-emerald-500/15 bg-emerald-500/[0.02]"
                      : "border-white/[0.03]"
                  }`}
                >
                  {/* ── Resource column (sticky left) ──────── */}
                  <div className="sticky left-0 z-10 box-border flex h-[80px] w-[200px] shrink-0 items-center gap-3 border-r border-white/[0.05] bg-[#050505] px-4">
                    <div className="relative">
                      <div className="tech-avatar-grayscale flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-[9px] font-medium text-zinc-400">
                        {tech.initials}
                      </div>
                      <div
                        className={`absolute -right-0.5 -bottom-0.5 h-[6px] w-[6px] rounded-full ring-[1.5px] ring-[#050505] ${
                          tech.status === "online"
                            ? "bg-emerald-500"
                            : tech.status === "away"
                              ? "bg-amber-500"
                              : "bg-zinc-600"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-zinc-300 transition-colors duration-150 group-hover:text-white">
                        {tech.name}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, capacityPct)}%` }}
                            transition={{ duration: 0.6, delay: techIdx * 0.08, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              capacityPct > 90
                                ? "bg-red-500/50"
                                : capacityPct > 70
                                  ? "bg-amber-500/40"
                                  : "bg-emerald-500/30"
                            }`}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-600">{tech.hoursBooked}h</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Timeline track ─────────────────────── */}
                  <div className="relative flex-1 overflow-hidden" style={{ height: ROW_H }}>
                    <div className="relative h-full" style={{ width: totalWidth }}>
                      {/* Hour grid lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 h-full w-px bg-white/[0.06]"
                          style={{ left: hourToX(h) }}
                        />
                      ))}
                      {/* 15-min sub-lines */}
                      {hours.map((h) =>
                        [0.25, 0.5, 0.75].map((q) => (
                          <div
                            key={`${h}-${q}`}
                            className="absolute top-0 h-full w-px bg-white/[0.02]"
                            style={{ left: hourToX(h + q) }}
                          />
                        ))
                      )}

                      {/* Non-working hours shading */}
                      <div
                        className="absolute top-0 h-full bg-white/[0.01]"
                        style={{
                          left: 0,
                          width: hourToX(WORK_START),
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.015) 4px, rgba(255,255,255,0.015) 5px)",
                        }}
                      />
                      <div
                        className="absolute top-0 h-full bg-white/[0.01]"
                        style={{
                          left: hourToX(WORK_END),
                          width: totalWidth - hourToX(WORK_END),
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.015) 4px, rgba(255,255,255,0.015) 5px)",
                        }}
                      />

                      {/* ── "Laser" Now Line ─────────────────── */}
                      <div className="absolute top-0 z-20 h-full" style={{ left: nowX }}>
                        <div className="h-full w-px bg-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        {/* Glowing head */}
                        {techIdx === 0 && (
                          <div
                            className="absolute -top-1.5 -left-[4px] h-[9px] w-[9px] rounded-full bg-emerald-500 animate-laser-pulse"
                          />
                        )}
                      </div>

                      {/* Drop target highlight (snap guide) */}
                      {isDropRow && dropTarget && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute top-1 z-[15] rounded-md border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.04]"
                          style={{
                            left: hourToX(dropTarget.hour),
                            width: ghostDuration * HOUR_W,
                            height: ROW_H - 8,
                          }}
                        >
                          <div className="flex h-full items-center justify-center">
                            <span className="text-[10px] font-medium text-emerald-500/50">
                              {formatHour(dropTarget.hour)}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Schedule Events (breaks/meetings) */}
                      {scheduleEvents
                        .filter((evt) => evt.user_id === tech.id)
                        .map((evt, i) => {
                          const evtStart = timeToDecimalHours(evt.start_time);
                          const evtDuration = calculateDuration(evt.start_time, evt.end_time);
                          const evtLeft = hourToX(evtStart);
                          const evtWidth = evtDuration * HOUR_W;
                          const typeColor = evt.type === "break"
                            ? "bg-zinc-500/8 border-zinc-700/30"
                            : evt.type === "meeting"
                              ? "bg-emerald-500/6 border-emerald-500/15"
                              : evt.type === "personal"
                                ? "bg-teal-500/6 border-teal-500/15"
                                : "bg-red-500/6 border-red-500/15";

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
                                <span className="truncate text-[9px] text-zinc-600">{evt.title}</span>
                              </div>
                            </motion.div>
                          );
                        })
                      }

                      {/* ── Job Blocks (Glass & Spine) ────────── */}
                      {techBlocks.map((block, i) => {
                        const colors = statusColorMap[block.status] || statusColorMap.scheduled;
                        const isDragging = dragState?.source === "block" && dragState?.blockId === block.id;
                        const isPeeking = peekBlockId === block.id;

                        let blockLeft = hourToX(block.startHour);
                        let blockWidth = block.duration * HOUR_W;

                        if (isDragging && dragState) {
                          if (dragState.mode === "resize") {
                            blockWidth += dragDelta.dx;
                            blockWidth = Math.max(HOUR_W * 0.25, blockWidth);
                          }
                        }

                        const travelW = block.travelTime ? (block.travelTime / 60) * HOUR_W : 0;

                        return (
                          <div key={block.id}>
                            {/* Travel time block */}
                            {travelW > 0 && !isDragging && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: techIdx * 0.04 + i * 0.03 + 0.1 }}
                                className="absolute top-3 h-[calc(100%-24px)] rounded-md border border-dashed border-white/[0.04] bg-white/[0.01]"
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

                            {/* The Block — Glass & Spine */}
                            <motion.div
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{
                                opacity: isDragging ? 0.3 : 1,
                                scaleX: 1,
                                zIndex: isPeeking ? 25 : 10,
                              }}
                              transition={{
                                delay: isDragging ? 0 : techIdx * 0.04 + i * 0.03,
                                duration: 0.3,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className={`schedule-block-hover absolute top-2 origin-left cursor-grab overflow-hidden rounded-md border border-white/[0.06] bg-[#1A1A1A] ${
                                block.conflict ? "border-red-500/40" : ""
                              } ${isPeeking ? "ring-1 ring-white/15" : ""}`}
                              style={{
                                left: blockLeft,
                                width: Math.max(24, blockWidth),
                                height: ROW_H - 16,
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
                                if (e.button === 0) handleBlockDragStart(e, block.id, "move");
                              }}
                            >
                              {/* Status Spine — 3px left bar */}
                              <div className={`absolute left-0 top-0 h-full w-[3px] ${colors.spine}`} />
                              <div className="flex h-full flex-col justify-center truncate pl-3 pr-2">
                                {blockWidth > 60 && (
                                  <span className="font-mono text-[9px] text-zinc-500">
                                    {formatHour(block.startHour)} — {formatHour(block.startHour + block.duration)}
                                  </span>
                                )}
                                <span className="truncate text-[11px] font-medium text-white">{block.title}</span>
                                {blockWidth > 80 && (
                                  <span className="truncate text-[10px] text-zinc-400">{block.client}</span>
                                )}
                                {blockWidth > 120 && block.location && (
                                  <span className="truncate text-[9px] text-zinc-600">{block.location}</span>
                                )}
                              </div>

                              {/* Conflict indicator */}
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
                                  handleBlockDragStart(e, block.id, "resize");
                                }}
                              >
                                <div className="flex h-full items-center justify-center">
                                  <Grip size={8} className="text-zinc-500" />
                                </div>
                              </div>

                              {/* Peek Card */}
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
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Backlog Drawer (from right) ────────────────────── */}
        <AnimatePresence>
          {unscheduledDrawerOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="shrink-0 overflow-hidden border-l border-white/[0.05] bg-[#080808]"
            >
              <div className="flex h-full w-[280px] flex-col">
                <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Rows3 size={13} strokeWidth={1.5} className="text-zinc-500" />
                    <span className="text-[13px] font-medium text-zinc-300">Unassigned Jobs</span>
                    <span className="text-[10px] text-zinc-600">{backlogJobs.length}</span>
                  </div>
                  <button
                    onClick={() => setUnscheduledDrawerOpen(false)}
                    className="rounded-md p-1 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <p className="mb-2 text-[10px] text-zinc-700">
                    Drag a job onto the timeline to assign it
                  </p>
                  <div className="space-y-2">
                    {backlogJobs.length > 0 ? (
                      backlogJobs.map((item: BacklogJob, idx) => {
                        const isBeingDragged = dragState?.source === "backlog" && dragState?.backlogJob?.id === item.id;
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: isBeingDragged ? 0.3 : 1, x: 0 }}
                            transition={{ delay: idx * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="cursor-grab select-none rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-150 hover:border-white/[0.08] hover:bg-white/[0.03] active:cursor-grabbing"
                            onMouseDown={(e) => handleBacklogDragStart(e, item)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[9px] text-zinc-600">{item.display_id}</span>
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      item.priority === "urgent"
                                        ? "bg-red-400"
                                        : item.priority === "high"
                                          ? "bg-orange-400"
                                          : item.priority === "medium"
                                            ? "bg-yellow-500"
                                            : "bg-emerald-500"
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
                              <GripVertical size={14} className="shrink-0 text-zinc-700" />
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      /* Lottie-style empty backlog */
                      <div className="flex flex-col items-center py-10 text-center">
                        <div className="relative mb-4 flex h-12 w-12 items-center justify-center">
                          {/* Floating idle animation */}
                          <div className="animate-backlog-idle">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                              <Inbox size={16} strokeWidth={1.5} className="text-zinc-600" />
                            </div>
                          </div>
                          {/* Subtle rings */}
                          <div className="absolute inset-0 rounded-full border border-white/[0.03] animate-signal-pulse" />
                        </div>
                        <p className="text-[12px] font-medium text-zinc-400">All jobs assigned</p>
                        <p className="mt-0.5 text-[10px] text-zinc-600">
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

      {/* ── Drag Ghost Overlay ────────────────────────────────── */}
      {dragState && dragState.mode === "move" && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999]"
          style={{ cursor: "grabbing" }}
        >
          <div
            className="absolute rounded-md border border-emerald-500/40 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.4)]"
            style={{
              left: mousePos.x - 80,
              top: mousePos.y - 24,
              width: Math.max(120, ghostDuration * HOUR_W),
              height: ROW_H - 16,
              background: "rgba(16, 185, 129, 0.08)",
              backdropFilter: "blur(4px)",
            }}
          >
            {/* Spine */}
            <div className="absolute left-0 top-0 h-full w-[3px] rounded-l-md bg-emerald-500" />
            <div className="flex h-full flex-col justify-center truncate pl-3 pr-2">
              {dragState.source === "backlog" && dragState.backlogJob ? (
                <>
                  <span className="font-mono text-[8px] text-emerald-500/50">
                    {dragState.backlogJob.display_id}
                  </span>
                  <span className="truncate text-[11px] font-medium text-white">
                    {dragState.backlogJob.title}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    {formatDuration((dragState.backlogJob.estimated_duration_minutes || 60) / 60)}
                  </span>
                </>
              ) : dragState.source === "block" ? (
                (() => {
                  const block = blocks.find((b) => b.id === dragState.blockId);
                  if (!block) return null;
                  return (
                    <>
                      <span className="truncate text-[11px] font-medium text-white">{block.title}</span>
                      <span className="truncate text-[9px] text-zinc-500">{block.client}</span>
                    </>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}

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

/* ── Job Peek Card Component (Linear-style Popover) ────────── */

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
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute top-full left-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0A0A0A] shadow-2xl backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
        <button
          onClick={onOpenFull}
          className="font-mono text-[12px] text-zinc-400 transition-colors hover:text-white"
        >
          {block.jobId}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px]">
            <motion.span
              animate={
                block.status === "in_progress" || block.status === "en_route"
                  ? { opacity: [1, 0.3, 1] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
            />
            <span className={colors.label}>{statusLabels[block.status]}</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Mini map */}
      <div className="relative h-[100px] bg-[#080808]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 opacity-[0.02]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-white" style={{ top: `${i * 20}%` }} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l border-white" style={{ left: `${i * 10}%` }} />
            ))}
          </div>
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
            className="relative z-10"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
              <MapPin size={10} className="text-white" />
            </div>
            <motion.div
              animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border border-emerald-500"
            />
          </motion.div>
        </div>
        <button
          onClick={() => {
            if (!block.location) { addToast("No location set for this job"); return; }
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.location)}`, "_blank");
          }}
          className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur-sm transition-colors hover:text-white"
        >
          <Navigation size={9} />
          Directions
        </button>
        <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-500 backdrop-blur-sm">
          {block.location}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-0 border-t border-white/[0.04] p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[9px] tracking-wider text-zinc-600 uppercase">Time</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-zinc-300">
              <Clock size={10} className="text-zinc-500" />
              {formatHour(block.startHour)} — {formatHour(block.startHour + block.duration)}
            </div>
            <div className="text-[10px] text-zinc-600">{formatDuration(block.duration)}</div>
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

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2.5">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onOpenFull}
          className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <ExternalLink size={11} />
          Open Mission Control
        </motion.button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addToast("No phone number configured")}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            title="Call"
          >
            <Phone size={12} />
          </button>
          <button
            onClick={() => addToast("No phone number configured")}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            title="Message"
          >
            <MessageSquare size={12} />
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(block.jobId);
              addToast(`${block.jobId} copied`);
            }}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            title="Copy link"
          >
            <Link2 size={12} />
          </button>
          <button
            onClick={() => {
              if (!block.location) { addToast("No location set for this job"); return; }
              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.location)}`, "_blank");
            }}
            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            title="Directions"
          >
            <Navigation size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
