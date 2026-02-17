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
  Search,
  Filter,
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

type ViewFilter = "all" | "active" | "backlog" | "done";

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

function formatDue(due: string | undefined): { label: string; isOverdue: boolean } {
  if (!due) return { label: "", isOverdue: false };
  if (due === "Today") return { label: "Today", isOverdue: false };
  if (due === "Tomorrow") return { label: "Tomorrow", isOverdue: false };
  if (due === "Overdue" || due === "Yesterday") return { label: due, isOverdue: true };
  return { label: due, isOverdue: false };
}

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open", icon: <Pencil size={13} />, shortcut: "↵" },
  { id: "copy", label: "Copy link", icon: <Copy size={13} />, shortcut: "⌘L" },
  { id: "status", label: "Change status", icon: <ArrowRight size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "delete", label: "Delete", icon: <Trash2 size={13} />, danger: true },
];

/* ── Lottie-style Empty State ──────────────────────────── */

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        {/* Scanner sweep animation */}
        <div className="absolute inset-0 rounded-full border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-full border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
        {/* Orbiting dot */}
        <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-500/40" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {hasFilter ? (
            <Search size={16} strokeWidth={1.5} className="text-zinc-600" />
          ) : (
            <Briefcase size={16} strokeWidth={1.5} className="text-zinc-600" />
          )}
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">
        {hasFilter ? "No jobs found" : "No jobs yet"}
      </h3>
      <p className="mt-1 text-[12px] text-zinc-600">
        {hasFilter ? "Enjoy the silence." : "Create your first job to get started."}
      </p>
    </motion.div>
  );
}

/* ── Page Component ────────────────────────────────────── */

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

  /* ── View filter ────────────────────────────────────── */
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredJobs = jobsList.filter((job) => {
    // View filter
    if (viewFilter === "active" && (job.status === "backlog" || job.status === "done" || job.status === "cancelled")) return false;
    if (viewFilter === "backlog" && job.status !== "backlog") return false;
    if (viewFilter === "done" && job.status !== "done") return false;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q) ||
        (job.client || "").toLowerCase().includes(q) ||
        (job.location || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── Delete confirmation ────────────────────────────── */
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* ── Status dropdown ────────────────────────────────── */
  const [statusDropdown, setStatusDropdown] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  /* ── Context menu ───────────────────────────────────── */
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
        setFocusedIndex(Math.min(focusedIndex + 1, filteredJobs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(Math.max(focusedIndex - 1, 0));
      } else if (e.key === " ") {
        e.preventDefault();
        const job = filteredJobs[focusedIndex];
        if (job) toggleSelect(job.id);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const job = filteredJobs[focusedIndex];
        if (job) router.push(`/dashboard/jobs/${job.id}`);
      } else if (e.key === "/" && !showSearch) {
        e.preventDefault();
        setShowSearch(true);
      }
    },
    [focusedIndex, filteredJobs, setFocusedIndex, toggleSelect, router, showSearch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
      if (prevJob) updateJobStatus(jobId, prevJob.status);
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
    if (actionId === "open") router.push(`/dashboard/jobs/${job.id}`);
    else if (actionId === "copy") {
      navigator.clipboard?.writeText(job.id);
      addToast(`${job.id} copied to clipboard`);
    } else if (actionId === "delete") handleDeleteClick(job);
  }

  const [bulkDeleteJobs, setBulkDeleteJobs] = useState<Job[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  function handleBulkDelete() {
    const deletedIds = new Set(selected);
    const deletedJobs = jobsList.filter((j) => deletedIds.has(j.id));
    if (deletedJobs.length === 1) handleDeleteClick(deletedJobs[0]);
    else if (deletedJobs.length > 1) { setBulkDeleteJobs(deletedJobs); setIsBulkDeleteModalOpen(true); }
  }

  async function confirmBulkDelete() {
    setIsDeleting(true);
    try {
      await Promise.all(bulkDeleteJobs.map((j) => deleteJobServer(j.id)));
      clearSelection();
      addToast(`${bulkDeleteJobs.length} jobs deleted`);
    } catch { addToast("Failed to delete some jobs"); }
    finally { setIsBulkDeleteModalOpen(false); setBulkDeleteJobs([]); setIsDeleting(false); }
  }

  /* ── View filter counts ────────────────────────────── */
  const activeCount = jobsList.filter((j) => j.status === "todo" || j.status === "in_progress").length;
  const backlogCount = jobsList.filter((j) => j.status === "backlog").length;
  const doneCount = jobsList.filter((j) => j.status === "done").length;

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Control Bar Header ────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-medium text-white">Jobs</h1>

          {/* View Switcher — minimal text buttons */}
          <div className="flex items-center gap-0.5">
            {([
              { key: "all" as ViewFilter, label: "All Jobs", count: jobsList.length },
              { key: "active" as ViewFilter, label: "Active", count: activeCount },
              { key: "backlog" as ViewFilter, label: "Backlog", count: backlogCount },
              { key: "done" as ViewFilter, label: "Done", count: doneCount },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewFilter(tab.key)}
                className={`relative rounded-md px-2.5 py-1 text-[12px] transition-all duration-150 ${
                  viewFilter === tab.key
                    ? "font-medium text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
                {tab.count > 0 && viewFilter !== tab.key && (
                  <span className="ml-1 text-[10px] text-zinc-600">{tab.count}</span>
                )}
                {viewFilter === tab.key && (
                  <motion.div
                    layoutId="jobs-view-indicator"
                    className="absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 200, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2 py-1">
                  <Search size={12} className="shrink-0 text-zinc-600" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                    onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setShowSearch(false); } }}
                    placeholder="Search jobs…"
                    className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showSearch && (
            <button
              onClick={() => setShowSearch(true)}
              className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400"
            >
              <Search size={14} />
            </button>
          )}

          <button className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2.5 py-1 text-[12px] text-zinc-500 transition-colors duration-150 hover:border-white/[0.1] hover:text-zinc-300">
            <Filter size={12} />
            Filter
          </button>

          {/* New Job — Compact, high contrast, NOT neon green */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setCreateJobModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-medium text-white transition-all duration-150 hover:border-white/[0.15] hover:bg-[#222]"
          >
            <Plus size={12} />
            New Job
          </motion.button>
        </div>
      </div>

      {/* ── Column Headers ────────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-1.5">
        <div className="w-8" />
        <div className="w-8 px-1 text-[10px] font-medium tracking-wider text-zinc-600 uppercase" />
        <div className="w-[80px] px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          ID
        </div>
        <div className="w-8 px-1 text-[10px] font-medium tracking-wider text-zinc-600 uppercase" />
        <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          Title
        </div>
        <div className="w-32 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          Client
        </div>
        <div className="w-32 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          Location
        </div>
        <div className="w-8 px-1" />
        <div className="w-20 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
          Due
        </div>
        <div className="w-8" />
      </div>

      {/* ── Rows ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 && !loading && (
          <EmptyState hasFilter={viewFilter !== "all" || searchQuery.length > 0} />
        )}

        <AnimatePresence>
          {filteredJobs.map((job, i) => {
            const isFocused = i === focusedIndex;
            const isSelected = selected.has(job.id);
            const due = formatDue(job.due);

            return (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => {
                  setFocusedIndex(i);
                  router.push(`/dashboard/jobs/${job.id}`);
                }}
                onContextMenu={(e) => handleContextMenu(e, job.id)}
                className={`group relative flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 ${
                  isSelected
                    ? "bg-white/[0.04]"
                    : isFocused
                      ? "bg-white/[0.03]"
                      : "hover:bg-white/[0.02]"
                }`}
                style={{ height: 40 }}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500" />
                )}

                {/* Checkbox */}
                <div className="w-8 shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-all duration-150 ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-white/[0.08] opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(job.id);
                    }}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-full w-full text-white">
                        <path d="M3 6l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </motion.div>
                </div>

                {/* Priority — icon only */}
                <div className="w-8 px-1">
                  <PriorityIcon priority={job.priority} size={14} />
                </div>

                {/* ID — monospace */}
                <div className="w-[80px] px-2">
                  <span className="font-mono text-[11px] text-zinc-600 transition-colors duration-150 group-hover:text-zinc-400">
                    {job.id}
                  </span>
                </div>

                {/* Status — icon only, clickable */}
                <div className="w-8 px-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setStatusDropdown({ jobId: job.id, x: rect.left, y: rect.bottom + 4 });
                    }}
                    className="rounded p-0.5 transition-colors duration-150 hover:bg-white/[0.06]"
                  >
                    <StatusIcon status={job.status} size={14} />
                  </button>
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1 px-2">
                  <span className={`truncate text-[13px] font-medium transition-colors duration-150 ${
                    isFocused ? "text-white" : "text-zinc-300 group-hover:text-white"
                  }`}>
                    {job.title}
                  </span>
                  {job.labels.slice(0, 2).map((label) => (
                    <span
                      key={label}
                      className="ml-2 inline-block rounded border border-white/[0.05] px-1.5 py-px text-[9px] text-zinc-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Client */}
                <div className="w-32 px-2">
                  {job.client && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[7px] font-medium text-zinc-500">
                        {job.assigneeInitials || job.client?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate text-[12px] text-zinc-500">{job.client}</span>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="w-32 px-2">
                  {job.location && (
                    <span className="truncate text-[11px] text-zinc-600">
                      {job.location?.split(",")[0]}
                    </span>
                  )}
                </div>

                {/* Assignee avatar */}
                <div className="w-8 px-1">
                  {job.assigneeInitials && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-[7px] font-medium text-zinc-500">
                      {job.assigneeInitials}
                    </div>
                  )}
                </div>

                {/* Due */}
                <div className="w-20 px-2">
                  <span className={`text-[11px] ${
                    due.isOverdue
                      ? "font-medium text-red-400"
                      : due.label === "Today"
                        ? "text-amber-400/80"
                        : "text-zinc-500"
                  }`}>
                    {due.label}
                  </span>
                </div>

                {/* Arrow */}
                <div className="w-8 text-right">
                  <ArrowRight
                    size={12}
                    className="inline-block text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100"
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
            className="fixed z-50 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0A0A0A] p-1 shadow-xl"
            style={{ left: statusDropdown.x, top: statusDropdown.y, width: 160 }}
          >
            {STATUS_OPTIONS.map((opt) => {
              const currentJob = jobsList.find((j) => j.id === statusDropdown.jobId);
              const isActive = currentJob?.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(statusDropdown.jobId, opt.value)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors duration-150 ${
                    isActive
                      ? "bg-white/[0.04] text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
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

      {/* Bulk Delete Modal */}
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
              className="w-full max-w-[400px] rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-0 shadow-2xl"
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">Delete {bulkDeleteJobs.length} Jobs</h3>
                  <p className="text-[12px] text-zinc-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  {bulkDeleteJobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-zinc-600">{j.id}</span>
                      <span className="truncate text-zinc-400">{j.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] px-5 py-3">
                <button onClick={() => setIsBulkDeleteModalOpen(false)} disabled={isDeleting} className="rounded-md px-3 py-1.5 text-[13px] text-zinc-400 hover:bg-white/[0.04]">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={confirmBulkDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50">
                  <Trash2 size={13} />
                  {isDeleting ? "Deleting…" : `Delete ${bulkDeleteJobs.length} Jobs`}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Delete Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && jobToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { if (!isDeleting) { setIsDeleteModalOpen(false); setJobToDelete(null); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-0 shadow-2xl"
            >
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">Delete Job</h3>
                  <p className="text-[12px] text-zinc-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-500">{jobToDelete.id}</span>
                    <span className="text-[11px] text-zinc-700">&middot;</span>
                    <StatusIcon status={jobToDelete.status} size={11} />
                    <span className="text-[11px] text-zinc-500">{formatStatus(jobToDelete.status)}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-zinc-200">{jobToDelete.title}</p>
                  {jobToDelete.client && <p className="mt-0.5 text-[12px] text-zinc-500">{jobToDelete.client}</p>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] px-5 py-3">
                <button onClick={() => { setIsDeleteModalOpen(false); setJobToDelete(null); }} disabled={isDeleting} className="rounded-md px-3 py-1.5 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-50">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={confirmDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50">
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
