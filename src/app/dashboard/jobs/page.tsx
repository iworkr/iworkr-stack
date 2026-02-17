"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ArrowRight,
  Copy,
  MapPin,
  Briefcase,
} from "lucide-react";
import { PriorityIcon } from "@/components/app/priority-icon";
import { StatusIcon } from "@/components/app/status-icon";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { BulkActionBar } from "@/components/app/bulk-action-bar";
import { useToastStore } from "@/components/app/action-toast";
import { useJobsStore } from "@/lib/jobs-store";
import { useState } from "react";

/* ── Status helpers ──────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
] as const;

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    in_progress: "In Progress",
    todo: "To Do",
    done: "Done",
    backlog: "Backlog",
    cancelled: "Cancelled",
    on_hold: "On Hold",
  };
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open", icon: <Pencil size={13} />, shortcut: "↵" },
  { id: "copy", label: "Copy link", icon: <Copy size={13} />, shortcut: "⌘L" },
  { id: "status", label: "Change status", icon: <ArrowRight size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "delete", label: "Delete", icon: <Trash2 size={13} />, danger: true },
];

export default function JobsPage() {
  const router = useRouter();
  const {
    jobs: jobsList,
    focusedIndex,
    selected,
    loaded,
    loading,
    setFocusedIndex,
    toggleSelect,
    clearSelection,
    deleteJobServer,
    restoreJobs,
    updateJobStatus,
  } = useJobsStore();
  const { addToast } = useToastStore();

  // Status dropdown state
  const [statusDropdown, setStatusDropdown] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    jobId: string;
  }>({ open: false, x: 0, y: 0, jobId: "" });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(Math.min(focusedIndex + 1, jobsList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(Math.max(focusedIndex - 1, 0));
      } else if (e.key === " ") {
        e.preventDefault();
        const job = jobsList[focusedIndex];
        if (job) toggleSelect(job.id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const job = jobsList[focusedIndex];
        if (job) router.push(`/dashboard/jobs/${job.id}`);
      }
    },
    [focusedIndex, jobsList, setFocusedIndex, toggleSelect, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close status dropdown on click outside
  useEffect(() => {
    if (!statusDropdown) return;
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdown(null);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [statusDropdown]);

  async function handleStatusChange(jobId: string, newStatus: string) {
    await updateJobStatus(jobId, newStatus);
    setStatusDropdown(null);
    addToast(`Status updated to ${formatStatus(newStatus)}`);
  }

  function handleContextMenu(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, jobId });
  }

  function handleContextAction(actionId: string) {
    const job = jobsList.find((j) => j.id === ctxMenu.jobId);
    if (!job) return;

    if (actionId === "open") {
      router.push(`/dashboard/jobs/${job.id}`);
    } else if (actionId === "copy") {
      navigator.clipboard?.writeText(job.id);
      addToast(`${job.id} copied to clipboard`);
    } else if (actionId === "delete") {
      deleteJobServer(job.id);
      addToast(`${job.id} deleted`);
    }
  }

  function handleBulkDelete() {
    const deletedIds = new Set(selected);
    const deletedJobs = jobsList.filter((j) => deletedIds.has(j.id));
    deletedJobs.forEach((j) => deleteJobServer(j.id));
    clearSelection();
    addToast(`${deletedIds.size} jobs deleted`);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-medium text-zinc-200">Jobs</h1>
          <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] text-zinc-500">
            {jobsList.length} total
          </span>
          <div className="flex items-center gap-1">
            {(["in_progress", "todo", "backlog"] as const).map((s) => {
              const count = jobsList.filter((j) => j.status === s).length;
              if (count === 0) return null;
              return (
                <span
                  key={s}
                  className="flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-zinc-600"
                >
                  <StatusIcon status={s} size={10} />
                  {count}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] text-zinc-500 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300">
            <SlidersHorizontal size={12} />
            Display
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
          >
            <Plus size={12} />
            New Job
          </motion.button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-2">
        <div className="w-8" />
        <div className="w-16 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Priority
        </div>
        <div className="w-[88px] px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          ID
        </div>
        <div className="min-w-0 flex-1 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Title
        </div>
        <div className="w-40 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Location
        </div>
        <div className="w-28 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Status
        </div>
        <div className="w-36 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Assignee
        </div>
        <div className="w-20 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
          Due
        </div>
        <div className="w-8" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state — show when no jobs and not actively loading */}
        {jobsList.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
              <Briefcase size={22} strokeWidth={1} className="text-zinc-700" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-300">No jobs found</h3>
            <p className="mt-1 text-[12px] text-zinc-600">Create your first job to get started.</p>
            <p className="mt-0.5 text-[11px] text-zinc-700">Jobs will appear here once created.</p>
          </motion.div>
        )}

        <AnimatePresence>
          {jobsList.map((job, i) => {
            const isFocused = i === focusedIndex;
            const isSelected = selected.has(job.id);

            return (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => {
                  setFocusedIndex(i);
                  router.push(`/dashboard/jobs/${job.id}`);
                }}
                onContextMenu={(e) => handleContextMenu(e, job.id)}
                className={`group flex cursor-pointer items-center border-b border-[rgba(255,255,255,0.04)] px-5 transition-colors ${
                  isFocused
                    ? "bg-[rgba(255,255,255,0.04)]"
                    : "hover:bg-[rgba(255,255,255,0.02)]"
                } ${isSelected ? "bg-violet-500/5" : ""}`}
                style={{ height: 48, overflow: "hidden" }}
              >
                {/* Checkbox */}
                <div className="w-8 shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-all ${
                      isSelected
                        ? "border-violet-500 bg-violet-500"
                        : "border-[rgba(255,255,255,0.1)] opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(job.id);
                    }}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-full w-full text-white">
                        <path
                          d="M3 6l2 2 4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </motion.div>
                </div>

                {/* Priority */}
                <div className="w-16 px-2">
                  <PriorityIcon priority={job.priority} size={14} />
                </div>

                {/* ID */}
                <div className="w-[88px] px-2">
                  <span className="font-mono text-[12px] tracking-tight text-zinc-500/60">
                    {job.id}
                  </span>
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1 px-2">
                  <span
                    className={`truncate text-[13px] font-medium ${
                      isFocused ? "text-zinc-100" : "text-zinc-300"
                    }`}
                  >
                    {job.title}
                  </span>
                  {job.labels.slice(0, 2).map((label) => (
                    <span
                      key={label}
                      className="ml-2 inline-block rounded border border-[rgba(255,255,255,0.06)] px-1.5 py-px text-[10px] text-zinc-500"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Location */}
                <div className="w-40 px-2">
                  {job.location && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin size={11} className="shrink-0 text-zinc-600" />
                      <span className="truncate text-[12px] text-zinc-500">
                        {job.location?.split(",")[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status — clickable dropdown */}
                <div className="w-28 px-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setStatusDropdown({ jobId: job.id, x: rect.left, y: rect.bottom + 4 });
                    }}
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/[0.06]"
                  >
                    <StatusIcon status={job.status} size={13} />
                    <span className="text-[12px] text-zinc-500">
                      {formatStatus(job.status)}
                    </span>
                  </button>
                </div>

                {/* Assignee */}
                <div className="w-36 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-400">
                      {job.assigneeInitials}
                    </div>
                    <span className="truncate text-[12px] text-zinc-500">
                      {job.assignee}
                    </span>
                  </div>
                </div>

                {/* Due */}
                <div className="w-20 px-2">
                  <span
                    className={`text-[12px] ${
                      job.due === "Today"
                        ? "font-medium text-amber-400/80"
                        : job.due === "Tomorrow"
                          ? "text-zinc-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {job.due}
                  </span>
                </div>

                {/* Enter arrow */}
                <div className="w-8 text-right">
                  <ArrowRight
                    size={13}
                    className="inline-block text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
              </motion.div>
            );
          })}
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

      {/* Status Dropdown */}
      <AnimatePresence>
        {statusDropdown && (
          <motion.div
            ref={statusDropdownRef}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
            style={{ left: statusDropdown.x, top: statusDropdown.y, width: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => {
              const currentJob = jobsList.find((j) => j.id === statusDropdown.jobId);
              const isActive = currentJob?.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(statusDropdown.jobId, opt.value)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                    isActive
                      ? "bg-white/5 text-zinc-200"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <StatusIcon status={opt.value} size={12} />
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar */}
      <BulkActionBar
        count={selected.size}
        onChangeStatus={() => addToast(`${selected.size} jobs moved to Backlog`)}
        onAssign={() => addToast(`${selected.size} jobs assigned`)}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />
    </div>
  );
}
