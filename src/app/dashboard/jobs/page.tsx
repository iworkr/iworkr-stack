"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Copy,
  Briefcase,
  AlertTriangle,
  Search,
  Filter,
  User,
  X,
  Check,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { PriorityIcon } from "@/components/app/priority-icon";
import { StatusIcon } from "@/components/app/status-icon";
import { StatusPill, formatStatus } from "@/components/ui/status-pill";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useToastStore } from "@/components/app/action-toast";
import { useJobsStore } from "@/lib/jobs-store";
import { useShellStore } from "@/lib/shell-store";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { emptyCalendarAnimation } from "@/components/dashboard/lottie-data";
import type { Job, Priority, JobStatus } from "@/lib/data";

/* ── Status helpers ──────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "backlog", label: "Draft" },
  { value: "todo", label: "To Do" },
  { value: "scheduled", label: "Scheduled" },
  { value: "en_route", label: "En Route" },
  { value: "on_site", label: "On Site" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "archived", label: "Archived" },
] as const;

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

type ViewFilter = "all" | "active" | "backlog" | "done";

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

/* ── Confetti Burst ────────────────────────────────── */

function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = useMemo(() => {
    const colors = ["#34d399", "#6ee7b7", "#a7f3d0", "#10b981", "#059669"];
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * 360;
      const distance = 20 + Math.random() * 30;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        color: colors[i % colors.length],
        tx: Math.cos(rad) * distance,
        ty: Math.sin(rad) * distance,
        size: 3 + Math.random() * 3,
        delay: Math.random() * 0.1,
      };
    });
  }, []);

  return (
    <div className="pointer-events-none fixed z-[200]" style={{ left: x, top: y }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.tx, y: p.ty, scale: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, backgroundColor: p.color, marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
        />
      ))}
      <motion.div
        initial={{ scale: 0, opacity: 0.6 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400"
      />
    </div>
  );
}

/* ── Filter Popover ──────────────────────────────────── */

interface FilterState {
  priority: Priority | null;
  status: JobStatus | null;
}

function FilterPopover({
  open,
  onClose,
  filters,
  onApply,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [local, setLocal] = useState<FilterState>(filters);
  const [section, setSection] = useState<"main" | "priority" | "status">("main");

  useEffect(() => {
    if (open) { setLocal(filters); setSection("main"); }
  }, [open, filters]);

  const hasActiveFilters = local.priority !== null || local.status !== null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 w-[220px] overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/90 shadow-2xl shadow-black/50 backdrop-blur-xl"
            style={{
              top: anchorRef.current ? anchorRef.current.getBoundingClientRect().bottom + 6 : 0,
              right: anchorRef.current ? window.innerWidth - anchorRef.current.getBoundingClientRect().right : 0,
            }}
          >
            <AnimatePresence mode="wait">
              {section === "main" && (
                <motion.div key="main" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.1 }} className="p-1.5">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Filter by</div>
                  <button onClick={() => setSection("priority")} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200">
                    <span className="flex items-center gap-2.5"><PriorityIcon priority="high" size={12} />Priority</span>
                    {local.priority && <span className="text-[10px] text-emerald-400">{PRIORITY_OPTIONS.find((p) => p.value === local.priority)?.label}</span>}
                  </button>
                  <button onClick={() => setSection("status")} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200">
                    <span className="flex items-center gap-2.5"><StatusIcon status="in_progress" size={12} />Status</span>
                    {local.status && <span className="text-[10px] text-emerald-400">{formatStatus(local.status)}</span>}
                  </button>
                  {hasActiveFilters && (
                    <button onClick={() => { const cleared = { priority: null, status: null }; setLocal(cleared); onApply(cleared); onClose(); }}
                      className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-white/[0.04] px-2.5 py-2 text-[11px] text-zinc-500 transition-colors hover:text-red-400">
                      <X size={10} />Clear all filters
                    </button>
                  )}
                </motion.div>
              )}

              {section === "priority" && (
                <motion.div key="priority" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.1 }} className="p-1.5">
                  <button onClick={() => setSection("main")} className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300">
                    <ArrowRight size={10} className="rotate-180" />Back
                  </button>
                  {PRIORITY_OPTIONS.map((p) => (
                    <button key={p.value} onClick={() => { const next: FilterState = { ...local, priority: local.priority === p.value ? null : p.value }; setLocal(next); onApply(next); onClose(); }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] transition-colors ${local.priority === p.value ? "bg-white/[0.04] text-zinc-200" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}>
                      <PriorityIcon priority={p.value} size={12} />{p.label}
                      {local.priority === p.value && <Check size={10} className="ml-auto text-emerald-400" />}
                    </button>
                  ))}
                </motion.div>
              )}

              {section === "status" && (
                <motion.div key="status" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.1 }} className="p-1.5">
                  <button onClick={() => setSection("main")} className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300">
                    <ArrowRight size={10} className="rotate-180" />Back
                  </button>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s.value} onClick={() => { const next: FilterState = { ...local, status: local.status === s.value ? null : s.value }; setLocal(next); onApply(next); onClose(); }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] transition-colors ${local.status === s.value ? "bg-white/[0.04] text-zinc-200" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}>
                      <StatusIcon status={s.value} size={12} />{s.label}
                      {local.status === s.value && <Check size={10} className="ml-auto text-emerald-400" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Lottie Empty State ──────────────────────────────── */

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-28 text-center"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.02] blur-[60px]" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6"
      >
        <LottieIcon
          animationData={emptyCalendarAnimation}
          size={80}
          loop={false}
          autoplay
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-[16px] font-semibold tracking-tight text-zinc-200"
      >
        {hasFilter ? "No jobs match your filters" : "No jobs yet"}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-zinc-600"
      >
        {hasFilter
          ? "Try adjusting your filters or search query."
          : "Create your first job to start tracking work."}
      </motion.p>
      {!hasFilter && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <button className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-black transition-all duration-200 hover:bg-zinc-200">
            <Plus size={14} />
            Create Job
          </button>
        </motion.div>
      )}
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
    selectAll,
    deleteJobServer,
    restoreJobs,
    updateJobStatus,
  } = useJobsStore();
  const { addToast } = useToastStore();
  const { setCreateJobModalOpen } = useShellStore();

  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({ priority: null, status: null });
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number } | null>(null);

  const filteredJobs = useMemo(() => {
    return jobsList.filter((job) => {
      const terminalStatuses = ["done", "completed", "invoiced", "archived", "cancelled"];
      if (viewFilter === "active" && (job.status === "backlog" || terminalStatuses.includes(job.status))) return false;
      if (viewFilter === "backlog" && job.status !== "backlog") return false;
      if (viewFilter === "done" && !["done", "completed", "invoiced", "archived"].includes(job.status)) return false;
      if (advancedFilters.priority && job.priority !== advancedFilters.priority) return false;
      if (advancedFilters.status && job.status !== advancedFilters.status) return false;
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
  }, [jobsList, viewFilter, searchQuery, advancedFilters]);

  const hasActiveFilters = viewFilter !== "all" || searchQuery.length > 0 || advancedFilters.priority !== null || advancedFilters.status !== null;
  const activeFilterCount = (advancedFilters.priority ? 1 : 0) + (advancedFilters.status ? 1 : 0);

  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; jobId: string }>({ open: false, x: 0, y: 0, jobId: "" });
  const [ctxStatusMenu, setCtxStatusMenu] = useState<{ open: boolean; x: number; y: number; jobId: string }>({ open: false, x: 0, y: 0, jobId: "" });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "ArrowDown") {
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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, filteredJobs, setFocusedIndex, toggleSelect, router]);

  useEffect(() => {
    if (!statusDropdown) return;
    function handleClick(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdown(null);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [statusDropdown]);

  async function handleStatusChange(jobId: string, newStatus: string, triggerEl?: HTMLElement) {
    const prevJob = jobsList.find((j) => j.id === jobId);
    setStatusDropdown(null);
    setCtxStatusMenu((p) => ({ ...p, open: false }));
    try {
      await updateJobStatus(jobId, newStatus);
      addToast(`Status updated to ${formatStatus(newStatus)}`);
      if (newStatus === "done" && prevJob?.status !== "done") {
        const rect = triggerEl?.getBoundingClientRect();
        if (rect) {
          setConfetti({ id: Date.now(), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
          setTimeout(() => setConfetti(null), 700);
        }
      }
    } catch {
      addToast("Failed to update status");
    }
  }

  function handleContextMenu(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, jobId });
  }

  function handleDeleteClick(job: Job) { setJobToDelete(job); setIsDeleteModalOpen(true); }

  async function confirmDelete() {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await deleteJobServer(jobToDelete.id);
      addToast(`Deleted ${jobToDelete.id}`);
    } catch { addToast("Failed to delete job"); }
    finally { setIsDeleteModalOpen(false); setJobToDelete(null); setIsDeleting(false); }
  }

  function handleContextAction(actionId: string) {
    const job = jobsList.find((j) => j.id === ctxMenu.jobId);
    if (!job) return;
    if (actionId === "open") router.push(`/dashboard/jobs/${job.id}`);
    else if (actionId === "copy") { navigator.clipboard?.writeText(job.id); addToast(`${job.id} copied`); }
    else if (actionId === "status") setCtxStatusMenu({ open: true, x: ctxMenu.x + 160, y: ctxMenu.y, jobId: ctxMenu.jobId });
    else if (actionId === "delete") handleDeleteClick(job);
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

  const activeCount = jobsList.filter((j) => ["todo", "scheduled", "en_route", "on_site", "in_progress"].includes(j.status)).length;
  const backlogCount = jobsList.filter((j) => j.status === "backlog").length;
  const doneCount = jobsList.filter((j) => ["done", "completed", "invoiced", "archived"].includes(j.status)).length;

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.012]" />

      {/* ── Command Bar Header ─────────────────────────────── */}
      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-zinc-500 transition-colors hover:text-white cursor-pointer">Dashboard</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="font-semibold text-white">Jobs</span>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center">
            {([
              { key: "all" as ViewFilter, label: "All Jobs", count: jobsList.length },
              { key: "active" as ViewFilter, label: "Active", count: activeCount },
              { key: "backlog" as ViewFilter, label: "Backlog", count: backlogCount },
              { key: "done" as ViewFilter, label: "Done", count: doneCount },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewFilter(tab.key)}
                className={`relative px-3 py-2 text-[12px] transition-all duration-150 ${
                  viewFilter === tab.key
                    ? "font-semibold text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
                {tab.count > 0 && viewFilter !== tab.key && (
                  <span className="ml-1 font-mono text-[10px] text-zinc-700">{tab.count}</span>
                )}
                {viewFilter === tab.key && (
                  <motion.div layoutId="jobs-tab-indicator" className="absolute bottom-0 left-3 right-3 flex justify-center" transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                    <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stealth Search — always visible */}
          <div className={`relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-200 ${searchFocused ? "" : ""}`}>
            <motion.div
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
              initial={false}
              animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            />
            <Search size={13} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); (e.target as HTMLElement).blur(); } }}
              placeholder="Search…"
              className="w-32 bg-transparent text-[12px] text-zinc-300 outline-none transition-all duration-200 placeholder:text-zinc-600 focus:w-48"
            />
            {!searchFocused && !searchQuery && (
              <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                <span className="text-[10px]">⌘</span>F
              </kbd>
            )}
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-zinc-600 hover:text-zinc-400"><X size={10} /></button>
            )}
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all duration-150 ${
                activeFilterCount > 0
                  ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400"
                  : "border-white/[0.06] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300"
              }`}
            >
              <Filter size={12} />Filter
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-semibold text-emerald-400">{activeFilterCount}</span>
              )}
            </button>
            <FilterPopover open={showFilterPopover} onClose={() => setShowFilterPopover(false)} filters={advancedFilters} onApply={setAdvancedFilters} anchorRef={filterBtnRef} />
          </div>

          {/* New Job — Obsidian primary CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCreateJobModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition-all duration-200 hover:bg-zinc-200"
          >
            <Plus size={13} strokeWidth={2} />
            New Job
          </motion.button>
        </div>
      </div>

      {/* ── Sticky Column Headers ──────────────────────────── */}
      <div className="jobs-grid relative z-10 grid items-center border-b border-white/5 bg-[#080808] px-5 py-2" style={{ gridTemplateColumns: "32px 32px 80px 100px minmax(200px,1fr) 112px 112px 40px 80px 96px" }}>
        <div />
        <div />
        <div className="px-2 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">ID</div>
        <div className="px-1 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">Status</div>
        <div className="px-2 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">Title</div>
        <div className="px-2 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">Client</div>
        <div className="px-2 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">Location</div>
        <div />
        <div className="px-2 font-display text-[10px] font-semibold tracking-tight text-zinc-500 uppercase">Due</div>
        <div />
      </div>

      {/* ── Rows ──────────────────────────────────────────── */}
      <div
        className={`relative z-10 flex-1 overflow-y-auto scrollbar-none ${isHovering ? "jobs-list-focus" : ""}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); setHoveredRowId(null); }}
      >
        {filteredJobs.length === 0 && !loading && <EmptyState hasFilter={hasActiveFilters} />}

        <AnimatePresence>
          {filteredJobs.map((job, i) => {
            const isFocused = i === focusedIndex;
            const isSelected = selected.has(job.id);
            const isHovered = hoveredRowId === job.id;
            const due = formatDue(job.due);

            return (
              <motion.div
                key={job.id}
                layout
                data-job-row
                data-selected={isSelected}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => { setFocusedIndex(i); router.push(`/dashboard/jobs/${job.id}`); }}
                onContextMenu={(e) => handleContextMenu(e, job.id)}
                onMouseEnter={() => setHoveredRowId(job.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                className={`group relative grid cursor-pointer items-center border-b border-white/5 px-5 transition-all duration-100 ${
                  isSelected
                    ? "bg-white/[0.06]"
                    : isFocused
                      ? "bg-white/[0.03]"
                      : "hover:bg-white/[0.02]"
                }`}
                style={{ height: 56, gridTemplateColumns: "32px 32px 80px 100px minmax(200px,1fr) 112px 112px 40px 80px 96px" }}
              >
                {/* Selected spine — monochrome */}
                {isSelected && (
                  <motion.div layoutId={`sel-${job.id}`} className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-white" />
                )}

                {/* Checkbox */}
                <div className="shrink-0">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-all duration-150 ${
                      isSelected
                        ? "border-white bg-white"
                        : "border-white/[0.08] opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(job.id); }}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-full w-full text-black">
                        <path d="M3 6l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </motion.div>
                </div>

                {/* Priority icon */}
                <div className="px-1">
                  <PriorityIcon priority={job.priority} size={14} />
                </div>

                {/* ID — monospace */}
                <div className="truncate px-2">
                  <span className="font-mono text-[11px] text-zinc-600 transition-colors duration-150 group-hover:text-zinc-400">{job.id}</span>
                </div>

                {/* Status Pill */}
                <div className="overflow-hidden px-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setStatusDropdown({ jobId: job.id, x: rect.left, y: rect.bottom + 4 });
                    }}
                    className="transition-transform duration-100 hover:scale-105"
                  >
                    <StatusPill status={job.status} />
                  </button>
                </div>

                {/* Title */}
                <div className="min-w-0 overflow-hidden px-2">
                  <span className={`truncate text-[13px] font-medium transition-colors duration-150 ${isFocused ? "text-white" : "text-zinc-200 group-hover:text-white"}`}>
                    {job.title}
                  </span>
                  {job.labels.slice(0, 2).map((label) => (
                    <span key={label} className="ml-2 inline-block rounded-md border border-white/[0.04] bg-white/[0.02] px-1.5 py-px text-[9px] font-medium text-zinc-600">{label}</span>
                  ))}
                </div>

                {/* Client */}
                <div className="overflow-hidden px-2">
                  {job.client && <span className="block truncate text-[12px] text-zinc-500">{job.client}</span>}
                </div>

                {/* Location */}
                <div className="overflow-hidden px-2">
                  {job.location && <span className="block truncate text-[11px] text-zinc-600">{job.location?.split(",")[0]}</span>}
                </div>

                {/* Assignee avatar */}
                <div className="px-1">
                  {job.assigneeInitials && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-zinc-800/80 text-[7px] font-semibold text-zinc-400 transition-colors duration-150 group-hover:bg-zinc-700 group-hover:text-zinc-300">
                      {job.assigneeInitials}
                    </div>
                  )}
                </div>

                {/* Due */}
                <div className="px-2">
                  <span className={`font-mono text-[11px] ${
                    due.isOverdue ? "font-semibold text-rose-400" : due.label === "Today" ? "text-amber-400/80" : "text-zinc-600"
                  }`}>
                    {due.label}
                  </span>
                </div>

                {/* Quick Actions — fade in from right on hover */}
                <div>
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-0.5"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/jobs/${job.id}`); }}
                          className="rounded-md p-1.5 text-zinc-600 transition-colors duration-100 hover:bg-white/[0.06] hover:text-zinc-200"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToast(`Assign ${job.id}`); }}
                          className="rounded-md p-1.5 text-zinc-600 transition-colors duration-100 hover:bg-white/[0.06] hover:text-zinc-200"
                          title="Assign"
                        >
                          <User size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setStatusDropdown({ jobId: job.id, x: rect.left, y: rect.bottom + 4 });
                          }}
                          className="rounded-md p-1.5 text-zinc-500 transition-colors duration-100 hover:bg-white/5 hover:text-white"
                          title="Status"
                        >
                          <Check size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confetti */}
      <AnimatePresence>{confetti && <ConfettiBurst key={confetti.id} x={confetti.x} y={confetti.y} />}</AnimatePresence>

      {/* Context Menu */}
      <ContextMenu open={ctxMenu.open} x={ctxMenu.x} y={ctxMenu.y} items={contextItems} onSelect={handleContextAction} onClose={() => setCtxMenu((p) => ({ ...p, open: false }))} />

      {/* Context Status Sub-Menu */}
      <AnimatePresence>
        {ctxStatusMenu.open && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setCtxStatusMenu((p) => ({ ...p, open: false }))} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)]" style={{ left: ctxStatusMenu.x, top: ctxStatusMenu.y, width: 160 }}>
              {STATUS_OPTIONS.map((opt) => {
                const currentJob = jobsList.find((j) => j.id === ctxStatusMenu.jobId);
                const isActive = currentJob?.status === opt.value;
                return (
                  <button key={opt.value} onClick={(e) => handleStatusChange(ctxStatusMenu.jobId, opt.value, e.currentTarget)}
                    className={`flex h-7 w-full items-center gap-2.5 rounded px-2 text-left text-[13px] transition-colors duration-100 ${isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                    <StatusIcon status={opt.value} size={12} />{opt.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Status Dropdown */}
      <AnimatePresence>
        {statusDropdown && (
          <motion.div ref={statusDropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)]" style={{ left: statusDropdown.x, top: statusDropdown.y, width: 160 }}>
            {STATUS_OPTIONS.map((opt) => {
              const currentJob = jobsList.find((j) => j.id === statusDropdown.jobId);
              const isActive = currentJob?.status === opt.value;
              return (
                <button key={opt.value} onClick={(e) => handleStatusChange(statusDropdown.jobId, opt.value, e.currentTarget)}
                  className={`flex h-7 w-full items-center gap-2.5 rounded px-2 text-left text-[13px] transition-colors duration-100 ${isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                  <StatusIcon status={opt.value} size={12} />{opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bulk Action Bar — PRD: bottom center, slides up from y: 50 */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-[8px] border border-zinc-700 bg-zinc-900 px-4 py-2.5 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]">
              <span className="text-[13px] font-medium text-white">{selected.size} selected</span>
              <div className="h-4 w-px bg-zinc-700" />
              <button
                onClick={() => addToast(`${selected.size} jobs status updated`)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-zinc-400 transition-colors duration-100 hover:bg-zinc-800 hover:text-white"
              >
                <ArrowRight size={12} />Change Status
              </button>
              <button
                onClick={() => addToast(`${selected.size} jobs assigned`)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-zinc-400 transition-colors duration-100 hover:bg-zinc-800 hover:text-white"
              >
                <User size={12} />Assign
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-zinc-400 transition-colors duration-100 hover:bg-rose-500/10 hover:text-rose-400"
              >
                <Trash2 size={12} />Delete
              </button>
              <div className="h-4 w-px bg-zinc-700" />
              <button onClick={clearSelection} className="rounded p-1.5 text-zinc-500 transition-colors hover:text-zinc-300" aria-label="Clear selection">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Modal — PRD 55.0 Glass & Shadow */}
      <AnimatePresence>
        {isBulkDeleteModalOpen && bulkDeleteJobs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => !isDeleting && setIsBulkDeleteModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[420px] rounded-2xl border border-white/5 bg-zinc-950 p-6 shadow-2xl">
              <div className="flex items-center gap-3 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">Delete {bulkDeleteJobs.length} Jobs</h3>
                  <p className="text-[12px] text-zinc-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="py-2">
                <div className="scrollbar-none max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  {bulkDeleteJobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-zinc-600">{j.id}</span>
                      <span className="truncate text-zinc-400">{j.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4">
                <button onClick={() => setIsBulkDeleteModalOpen(false)} disabled={isDeleting} className="rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">Cancel</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={confirmBulkDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-transparent px-4 py-2 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50">
                  <Trash2 size={13} />{isDeleting ? "Deleting…" : `Delete ${bulkDeleteJobs.length} Jobs`}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Delete Modal — PRD 55.0 */}
      <AnimatePresence>
        {isDeleteModalOpen && jobToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { if (!isDeleting) { setIsDeleteModalOpen(false); setJobToDelete(null); } }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[420px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-100">Delete Job</h3>
                  <p className="text-[12px] text-zinc-500">This action cannot be undone.</p>
                </div>
              </div>
              <div className="py-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-500">{jobToDelete.id}</span>
                    <StatusPill status={jobToDelete.status} />
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold text-zinc-200">{jobToDelete.title}</p>
                  {jobToDelete.client && <p className="mt-0.5 text-[12px] text-zinc-500">{jobToDelete.client}</p>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4">
                <button onClick={() => { setIsDeleteModalOpen(false); setJobToDelete(null); }} disabled={isDeleting} className="rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">Cancel</button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={confirmDelete} disabled={isDeleting} className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-transparent px-4 py-2 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50">
                  <Trash2 size={13} />{isDeleting ? "Deleting…" : "Delete"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
