"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback, useRef, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import { PriorityIcon } from "@/components/app/priority-icon";
import { StatusIcon } from "@/components/app/status-icon";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { BulkActionBar } from "@/components/app/bulk-action-bar";
import { useToastStore } from "@/components/app/action-toast";
import { useJobsStore } from "@/lib/jobs-store";
import { useShellStore } from "@/lib/shell-store";
import type { Job } from "@/lib/data";

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
  const { setCreateJobModalOpen } = useShellStore();

  // Delete confirmation modal state
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    const prevJob = jobsList.find((j) => j.id === jobId);
    setStatusDropdown(null);
    try {
      await updateJobStatus(jobId, newStatus);
      addToast(`Status updated to ${formatStatus(newStatus)}`);
    } catch {
      if (prevJob) {
        updateJobStatus(jobId, prevJob.status);
      }
      addToast("Failed to update status");
    }
  }

  function handleContextMenu(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, jobId });
  }

  function handleDeleteClick(job: Job) {
    setJobToDelete(job);
    setIsDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await deleteJobServer(jobToDelete.id);
      addToast(`Deleted ${jobToDelete.id}`);
    } catch {
      addToast("Failed to delete job");
    } finally {
      setIsDeleteModalOpen(false);
      setJobToDelete(null);
      setIsDeleting(false);
    }
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
      handleDeleteClick(job);
    }
  }

  // State for bulk delete confirmation
  const [bulkDeleteJobs, setBulkDeleteJobs] = useState<Job[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  function handleBulkDelete() {
    const deletedIds = new Set(selected);
    const deletedJobs = jobsList.filter((j) => deletedIds.has(j.id));
    if (deletedJobs.length === 1) {
      handleDeleteClick(deletedJobs[0]);
    } else if (deletedJobs.length > 1) {
      setBulkDeleteJobs(deletedJobs);
      setIsBulkDeleteModalOpen(true);
    }
  }

  async function confirmBulkDelete() {
    setIsDeleting(true);
    try {
      await Promise.all(bulkDeleteJobs.map((j) => deleteJobServer(j.id)));
      clearSelection();
      addToast(`${bulkDeleteJobs.length} jobs deleted`);
    } catch {
      addToast("Failed to delete some jobs");
    } finally {
      setIsBulkDeleteModalOpen(false);
      setBulkDeleteJobs([]);
      setIsDeleting(false);
    }
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
            onClick={() => setCreateJobModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#00E676] to-[#00C853] px-2.5 py-1 text-[12px] font-semibold text-black transition-all hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)]"
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
                className={`group relative flex cursor-pointer items-center border-b border-[rgba(255,255,255,0.04)] px-5 transition-colors ${
                  isFocused
                    ? "bg-[rgba(255,255,255,0.04)]"
                    : "hover:bg-[rgba(255,255,255,0.02)]"
                } ${isSelected ? "bg-[rgba(0,230,118,0.05)] border-l-2 border-l-[#00E676]" : ""}`}
                style={{ height: 48, overflow: "hidden" }}
              >
                {/* Checkbox */}
                <div className="w-8 shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-all ${
                      isSelected
                        ? "border-[#00E676] bg-[#00E676]"
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

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {isBulkDeleteModalOpen && bulkDeleteJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !isDeleting && setIsBulkDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-zinc-900 p-0 shadow-2xl"
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">
                    Delete {bulkDeleteJobs.length} Jobs
                  </h3>
                  <p className="text-[12px] text-zinc-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                  {bulkDeleteJobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-zinc-600">{j.id}</span>
                      <span className="truncate text-zinc-400">{j.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
                <button onClick={() => setIsBulkDeleteModalOpen(false)} disabled={isDeleting} className="rounded-md px-3 py-1.5 text-[13px] text-zinc-400 hover:bg-[rgba(255,255,255,0.05)]">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={confirmBulkDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50">
                  <Trash2 size={13} />
                  {isDeleting ? "Deleting…" : `Delete ${bulkDeleteJobs.length} Jobs`}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && jobToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!isDeleting) {
                setIsDeleteModalOpen(false);
                setJobToDelete(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-zinc-900 p-0 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">
                    Delete Job
                  </h3>
                  <p className="text-[12px] text-zinc-500">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-3">
                <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-500">
                      {jobToDelete.id}
                    </span>
                    <span className="text-[11px] text-zinc-700">&middot;</span>
                    <StatusIcon status={jobToDelete.status} size={11} />
                    <span className="text-[11px] text-zinc-500">
                      {formatStatus(jobToDelete.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-zinc-200">
                    {jobToDelete.title}
                  </p>
                  {jobToDelete.client && (
                    <p className="mt-0.5 text-[12px] text-zinc-500">
                      {jobToDelete.client}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setJobToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="rounded-md px-3 py-1.5 text-[13px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {isDeleting ? "Deleting…" : "Delete"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
