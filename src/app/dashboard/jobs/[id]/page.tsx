"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Printer,
  Share2,
  Check,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Camera,
  FileText,
  Users,
  Sparkles,
  Clock,
  Calendar,
  User,
  Tag,
  MoreHorizontal,
  Trash2,
  Copy,
  DollarSign,
  Plus,
  Receipt,
  Briefcase,
} from "lucide-react";
import { useJobsStore } from "@/lib/jobs-store";
import { InlineMap } from "@/components/maps/inline-map";
import { useToastStore } from "@/components/app/action-toast";
import { StatusIcon, StatusLabel } from "@/components/app/status-icon";
import { PriorityIcon } from "@/components/app/priority-icon";
import { PopoverMenu } from "@/components/app/popover-menu";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import type { JobStatus, Priority } from "@/lib/data";
import { useTeamStore } from "@/lib/team-store";
import {
  getJobLineItems,
  addJobLineItem,
  deleteJobLineItem,
  updateJobLineItem,
  type JobLineItem,
} from "@/app/actions/jobs";
import { JobChat } from "@/components/messenger/job-chat";

/* ── Constants ────────────────────────────────────────────── */

const statusOptions: { value: JobStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

// Assignee options are populated from the team store at runtime (see component body)

const activityIcons: Record<string, typeof MessageSquare> = {
  status_change: CheckCircle2,
  comment: MessageSquare,
  photo: Camera,
  invoice: FileText,
  creation: Sparkles,
  assignment: Users,
};

const headerContextItems: ContextMenuItem[] = [
  { id: "copy", label: "Copy Job ID", icon: <Copy size={13} />, shortcut: "⌘L" },
  { id: "print", label: "Print", icon: <Printer size={13} /> },
  { id: "share", label: "Share link", icon: <Share2 size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "delete", label: "Delete Job", icon: <Trash2 size={13} />, danger: true },
];

/* ── Page Component ───────────────────────────────────────── */

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const { jobs, updateJobServer, deleteJobServer, restoreJobs, toggleSubtaskServer } = useJobsStore();
  const { addToast } = useToastStore();
  const teamMembers = useTeamStore((s) => s.members);
  const assigneeOptions = teamMembers.length > 0
    ? [...teamMembers.map((m) => m.name || "Team Member"), "Unassigned"]
    : ["Unassigned"];

  const job = jobs.find((j) => j.id === jobId);

  /* Local editable state */
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState("");
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0,
  });
  const [savedField, setSavedField] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<JobLineItem[]>([]);
  const [lineItemsLoaded, setLineItemsLoaded] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const newItemRef = useRef<HTMLInputElement>(null);

  // Sync local state when job changes
  useEffect(() => {
    if (job) {
      setLocalTitle(job.title);
      setLocalDesc(job.description || "");
    }
  }, [job]);

  // Load line items from server
  useEffect(() => {
    if (!jobId || lineItemsLoaded) return;
    getJobLineItems(jobId).then(({ data }) => {
      if (data) setLineItems(data);
      setLineItemsLoaded(true);
    });
  }, [jobId, lineItemsLoaded]);

  // Auto-focus title input
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingDesc) descRef.current?.focus();
  }, [editingDesc]);

  // Flash "saved" indicator
  function flashSaved(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }

  // Handle title save
  function saveTitle() {
    if (!job) return;
    setEditingTitle(false);
    if (localTitle.trim() && localTitle !== job.title) {
      updateJobServer(job.id, { title: localTitle.trim() });
      flashSaved("title");
      addToast("Title updated");
    } else {
      setLocalTitle(job.title);
    }
  }

  // Handle description save
  function saveDesc() {
    if (!job) return;
    setEditingDesc(false);
    if (localDesc !== (job.description || "")) {
      updateJobServer(job.id, { description: localDesc });
      flashSaved("description");
      addToast("Saved");
    }
  }

  // Keyboard handler
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePopover) setActivePopover(null);
        else if (editingTitle) saveTitle();
        else if (editingDesc) saveDesc();
        else router.push("/dashboard/jobs");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePopover, editingTitle, editingDesc, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  function handleHeaderContextAction(actionId: string) {
    if (!job) return;
    if (actionId === "copy") {
      navigator.clipboard?.writeText(job.id);
      addToast(`${job.id} copied to clipboard`);
    } else if (actionId === "delete") {
      deleteJobServer(job.id);
      addToast(`${job.id} deleted`);
      router.push("/dashboard/jobs");
    } else if (actionId === "share") {
      navigator.clipboard?.writeText(`${window.location.origin}/dashboard/jobs/${job.id}`);
      addToast("Link copied to clipboard");
    }
  }

  /* ── Not found ──────────────────────────────────────────── */

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.012]" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.02] blur-[60px]" />
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/[0.04] animate-signal-pulse" />
            <div className="absolute inset-2 rounded-full border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <Briefcase size={18} strokeWidth={1.5} className="text-zinc-600" />
            </div>
          </div>
          <h2 className="mb-1.5 text-[16px] font-semibold tracking-tight text-zinc-200">Job not found</h2>
          <p className="mb-5 text-[13px] text-zinc-600">
            This job may have been deleted or doesn&apos;t exist.
          </p>
          <button
            onClick={() => router.push("/dashboard/jobs")}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[12px] font-medium text-zinc-400 transition-all duration-200 hover:border-white/[0.1] hover:text-zinc-200"
          >
            Back to Jobs
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Computed ────────────────────────────────────────────── */

  const subtasks = job.subtasks || [];
  const completedSubtasks = subtasks.filter((st) => st.completed).length;
  const subtaskProgress = subtasks.length > 0 ? completedSubtasks / subtasks.length : 0;

  const margin = (job.revenue || 0) - (job.cost || 0);
  const marginPercent =
    job.revenue && job.revenue > 0 ? Math.round((margin / job.revenue) * 100) : 0;

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="flex h-full flex-col bg-[#050505]"
    >
      {/* ── Sticky Header — Glassmorphism ─────────────────── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-2.5">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push("/dashboard/jobs")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-zinc-500 transition-all duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <ArrowLeft size={12} />
              Jobs
            </button>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-[12px] text-zinc-500">
              {job.status
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span
              className="cursor-pointer font-mono text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ open: true, x: e.clientX, y: e.clientY });
              }}
            >
              {job.id}
            </span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/dashboard/jobs/${job.id}`
                );
                addToast("Link copied");
              }}
              className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
              title="Share"
            >
              <Share2 size={14} />
            </button>
            <button
              className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
              title="Print"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={(e) =>
                setCtxMenu({ open: true, x: e.clientX, y: e.clientY })
              }
              className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Complete Job CTA — Solid Emerald */}
            {job.status !== "done" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  updateJobServer(job.id, { status: "done" });
                  addToast("Job marked as complete");
                }}
                className="ml-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-900/40"
              >
                <Check size={13} />
                Complete Job
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-Column Body ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas (Left 70%) ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 pr-0">
          <div className="max-w-3xl">
            {/* ── Title ──────────────────────────────────────── */}
            <div className="relative mb-1">
              {editingTitle ? (
                <input
                  ref={titleRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                  }}
                  className="w-full bg-transparent text-[28px] font-semibold tracking-tight text-zinc-100 outline-none"
                />
              ) : (
                <h1
                  onClick={() => setEditingTitle(true)}
                  className="cursor-text text-[28px] font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white"
                >
                  {localTitle}
                </h1>
              )}
              <AnimatePresence>
                {savedField === "title" && (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -right-6 top-1/2 -translate-y-1/2"
                  >
                    <Check size={14} className="text-emerald-400" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Label pills */}
            <div className="mb-6 flex items-center gap-2">
              {job.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-0.5 text-[11px] font-medium text-zinc-500"
                >
                  {label}
                </span>
              ))}
              <span className="font-mono text-[11px] text-zinc-700">{job.created}</span>
            </div>

            {/* ── Description ────────────────────────────────── */}
            <div className="relative mb-8">
              <h3 className="mb-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Description
              </h3>
              {editingDesc ? (
                <textarea
                  ref={descRef}
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  onBlur={saveDesc}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-[13px] leading-relaxed text-zinc-300 outline-none focus:border-white/[0.12]"
                  rows={5}
                />
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="cursor-text rounded-lg p-0 text-[13px] leading-relaxed text-zinc-400 transition-colors hover:text-zinc-300"
                >
                  {localDesc || (
                    <span className="text-zinc-700">Scope of works...</span>
                  )}
                </div>
              )}
              <AnimatePresence>
                {savedField === "description" && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute -right-6 top-8"
                  >
                    <Check size={14} className="text-emerald-400" />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* ── Estimate / Line Items ──────────────────────── */}
            {(lineItems.length > 0 || lineItemsLoaded) && (
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    <Receipt size={12} />
                    Estimate
                  </h3>
                  {lineItems.length > 0 && (
                    <span className="text-[14px] font-semibold tracking-tight text-zinc-200">
                      $
                      {(
                        lineItems.reduce(
                          (sum, li) => sum + li.unit_price_cents * li.quantity,
                          0
                        ) / 100
                      ).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                  {lineItems.length > 0 && (
                    <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {lineItems.map((li) => (
                        <motion.div
                          key={li.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-center gap-3 px-4 py-2.5"
                        >
                          <span className="min-w-0 flex-1 text-[12px] text-zinc-400">
                            {li.description}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            ×{li.quantity}
                          </span>
                          <span className="w-20 text-right text-[12px] font-medium text-zinc-300">
                            ${(li.unit_price_cents / 100).toLocaleString()}
                          </span>
                          <button
                            onClick={async () => {
                              await deleteJobLineItem(li.id);
                              setLineItems((prev) =>
                                prev.filter((x) => x.id !== li.id)
                              );
                              addToast("Line item removed");
                            }}
                            className="rounded-md p-0.5 text-zinc-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          >
                            <Trash2 size={10} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Add new line item */}
                  <div className="flex items-center gap-2 border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
                    <Plus size={12} className="shrink-0 text-zinc-600" />
                    <input
                      ref={newItemRef}
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      placeholder="Add line item..."
                      className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-400 outline-none placeholder:text-zinc-700"
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newItemDesc.trim()) {
                          const priceCents = Math.round(
                            (parseFloat(newItemPrice) || 0) * 100
                          );
                          const { data } = await addJobLineItem(jobId, {
                            description: newItemDesc.trim(),
                            quantity: 1,
                            unit_price_cents: priceCents,
                          });
                          if (data) {
                            setLineItems((prev) => [...prev, data]);
                            setNewItemDesc("");
                            setNewItemPrice("");
                            addToast("Line item added");
                          }
                        }
                      }}
                    />
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] text-zinc-600">$</span>
                      <input
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder="0"
                        type="number"
                        className="w-16 bg-transparent text-right text-[12px] font-medium text-zinc-300 outline-none placeholder:text-zinc-700"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newItemDesc.trim()) {
                            const priceCents = Math.round(
                              (parseFloat(newItemPrice) || 0) * 100
                            );
                            const { data } = await addJobLineItem(jobId, {
                              description: newItemDesc.trim(),
                              quantity: 1,
                              unit_price_cents: priceCents,
                            });
                            if (data) {
                              setLineItems((prev) => [...prev, data]);
                              setNewItemDesc("");
                              setNewItemPrice("");
                              addToast("Line item added");
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Total row */}
                  {lineItems.length > 0 && (
                    <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] px-4 py-3">
                      <span className="text-[11px] font-medium text-zinc-500">
                        Total
                      </span>
                      <span className="text-[16px] font-semibold tracking-tight text-zinc-100">
                        $
                        {(
                          lineItems.reduce(
                            (sum, li) => sum + li.unit_price_cents * li.quantity,
                            0
                          ) / 100
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Sub-Tasks ──────────────────────────────────── */}
            {subtasks.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    Sub-tasks
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-600">
                      {completedSubtasks}/{subtasks.length}
                    </span>
                    {/* Progress ring */}
                    <svg width={20} height={20} viewBox="0 0 20 20">
                      <circle
                        cx={10}
                        cy={10}
                        r={8}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={2}
                      />
                      <motion.circle
                        cx={10}
                        cy={10}
                        r={8}
                        fill="none"
                        stroke={subtaskProgress === 1 ? "#34d399" : "#00E676"}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 8}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 8 }}
                        animate={{
                          strokeDashoffset:
                            2 * Math.PI * 8 * (1 - subtaskProgress),
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        style={{
                          transform: "rotate(-90deg)",
                          transformOrigin: "center",
                        }}
                      />
                    </svg>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {subtasks.map((st, i) => (
                    <motion.div
                      key={st.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      onClick={() => toggleSubtaskServer(job.id, st.id)}
                      className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150 ${
                          st.completed
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-white/[0.1] group-hover:border-white/[0.2]"
                        }`}
                      >
                        {st.completed && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            viewBox="0 0 12 12"
                            className="h-3 w-3 text-white"
                          >
                            <path
                              d="M3 6l2 2 4-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </motion.svg>
                        )}
                      </div>
                      <span
                        className={`text-[13px] transition-all ${
                          st.completed
                            ? "text-zinc-600 line-through"
                            : "text-zinc-300"
                        }`}
                      >
                        {st.title}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Map Widget ─────────────────────────────────── */}
            {job.location && (
              <div className="mb-8">
                <h3 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  Location
                </h3>
                <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]">
                  <div className="relative h-[200px] bg-[#0a0a0a]">
                    {job.locationCoords ? (
                      <InlineMap lat={job.locationCoords.lat} lng={job.locationCoords.lng} zoom={15} className="h-full w-full" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <MapPin size={20} strokeWidth={1} className="text-zinc-700" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                    <div className="absolute right-3 bottom-3 z-10 rounded-md bg-black/60 px-2.5 py-1 text-[11px] text-zinc-400 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={10} className="text-zinc-500" />
                        {job.location}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Activity Stream ────────────────────────────── */}
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                <MessageSquare size={12} />
                Activity
              </h3>
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute top-2 bottom-2 left-[7px] w-px bg-[rgba(255,255,255,0.06)]" />

                <div className="space-y-4">
                  {(job.activity || []).map((entry, i) => {
                    const Icon = activityIcons[entry.type] || MessageSquare;
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.25 }}
                        className="relative flex gap-3"
                      >
                        {/* Dot */}
                        <div className="absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]">
                          <Icon size={8} className="text-zinc-500" />
                        </div>

                        <div className="flex-1">
                          <div className="text-[12px] text-zinc-500">
                            <span className="font-medium text-zinc-400">
                              {entry.user}
                            </span>{" "}
                            {entry.text}
                          </div>
                          <div className="mt-0.5 text-[10px] text-zinc-700">
                            {entry.time}
                          </div>

                          {/* Photo thumbnails */}
                          {entry.photos && entry.photos.length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {entry.photos.map((photo, pi) => (
                                <motion.div
                                  key={pi}
                                  whileHover={{ scale: 1.05 }}
                                  className="h-16 w-20 rounded-md border border-[rgba(255,255,255,0.06)] bg-zinc-900"
                                >
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Camera
                                      size={14}
                                      className="text-zinc-700"
                                    />
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Job Chat ──────────────────────────────────── */}
            <div className="mt-6">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                <MessageSquare size={12} />
                Chat
              </h3>
              <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] p-3">
                <JobChat jobId={job.id} jobTitle={job.title} />
              </div>
            </div>
          </div>
        </div>

        {/* ── HUD (Right 30%) ───────────────────────────────── */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-white/[0.05] bg-[#080808]">
          <div className="p-5">
            {/* ── Status Pill ────────────────────────────────── */}
            <div className="relative mb-6">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() =>
                  setActivePopover(activePopover === "status" ? null : "status")
                }
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 transition-colors duration-150 ${
                  job.status === "done"
                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                    : job.status === "in_progress"
                      ? "border-amber-500/15 bg-amber-500/[0.03]"
                      : job.priority === "urgent"
                        ? "border-red-500/15 bg-red-500/[0.03]"
                        : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={job.status} size={16} />
                  <span className="text-[13px] font-medium text-zinc-200">
                    {statusOptions.find((s) => s.value === job.status)?.label}
                  </span>
                </div>
                <ChevronRight
                  size={12}
                  className="text-zinc-600 transition-transform"
                  style={{
                    transform:
                      activePopover === "status" ? "rotate(90deg)" : "rotate(0)",
                  }}
                />
              </motion.button>
              <div className="absolute top-full left-0 z-20 mt-1 w-full">
                <PopoverMenu
                  open={activePopover === "status"}
                  onClose={() => setActivePopover(null)}
                  items={statusOptions.map((s) => ({
                    value: s.value,
                    label: s.label,
                    icon: <StatusIcon status={s.value} size={13} />,
                  }))}
                  selected={job.status}
                    onSelect={(v) => {
                    updateJobServer(job.id, { status: v });
                    addToast(
                      `Status changed to ${statusOptions.find((s) => s.value === v)?.label}`
                    );
                  }}
                  width={280}
                  searchable={false}
                />
              </div>
            </div>

            {/* ── Financial Pulse ────────────────────────────── */}
            <div className="mb-6 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Financial Pulse
              </h4>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="text-[22px] font-semibold tracking-tight text-zinc-100">
                    ${(job.revenue || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-600">Revenue</div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-[15px] font-medium ${margin >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {margin >= 0 ? "+" : ""}${margin.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    {marginPercent}% margin
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="h-10 w-full">
                <svg viewBox="0 0 280 40" className="w-full">
                  <defs>
                    <linearGradient
                      id={`margin-grad-${job.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={margin >= 0 ? "#34d399" : "#ef4444"}
                        stopOpacity="0.3"
                      />
                      <stop
                        offset="100%"
                        stopColor={margin >= 0 ? "#34d399" : "#ef4444"}
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <motion.path
                    d="M0 35 L40 28 L80 32 L120 20 L160 22 L200 15 L240 10 L280 8 L280 40 L0 40 Z"
                    fill={`url(#margin-grad-${job.id})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                  />
                  {/* Line */}
                  <motion.path
                    d="M0 35 L40 28 L80 32 L120 20 L160 22 L200 15 L240 10 L280 8"
                    fill="none"
                    stroke={margin >= 0 ? "#34d399" : "#ef4444"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  />
                </svg>
              </div>

              {/* Cost breakdown */}
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                <div className="text-[11px] text-zinc-600">
                  Cost:{" "}
                  <span className="text-zinc-400">
                    ${(job.cost || 0).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600">
                  Hours:{" "}
                  <span className="text-zinc-400">
                    {job.actualHours || 0}/{job.estimatedHours || 0}h
                  </span>
                </div>
              </div>
            </div>

            {/* ── Properties ─────────────────────────────────── */}
            <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
              Properties
            </h4>
            <div className="space-y-1">
              {/* Priority */}
              <div className="relative">
                <PropertyRow
                  label="Priority"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "priority" ? null : "priority"
                    )
                  }
                >
                  <PriorityIcon priority={job.priority} size={13} />
                  <span
                    className={`text-[12px] ${
                      job.priority === "urgent"
                        ? "text-red-400"
                        : job.priority === "high"
                          ? "text-orange-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {priorityOptions.find((p) => p.value === job.priority)?.label}
                    {job.priority === "urgent" && (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500"
                      />
                    )}
                  </span>
                </PropertyRow>
                <div className="absolute top-full right-0 z-20 mt-1">
                  <PopoverMenu
                    open={activePopover === "priority"}
                    onClose={() => setActivePopover(null)}
                    items={priorityOptions.map((p) => ({
                      value: p.value,
                      label: p.label,
                      icon: <PriorityIcon priority={p.value} size={13} />,
                    }))}
                    selected={job.priority}
                    onSelect={(v) => {
                      updateJobServer(job.id, { priority: v });
                      addToast(
                        `Priority changed to ${priorityOptions.find((p) => p.value === v)?.label}`
                      );
                    }}
                    width={180}
                    align="right"
                    searchable={false}
                  />
                </div>
              </div>

              {/* Assignee */}
              <div className="relative">
                <PropertyRow
                  label="Assignee"
                  onClick={() =>
                    setActivePopover(
                      activePopover === "assignee" ? null : "assignee"
                    )
                  }
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-400">
                    {job.assigneeInitials}
                  </div>
                  <span className="text-[12px] text-zinc-400">{job.assignee}</span>
                </PropertyRow>
                <div className="absolute top-full right-0 z-20 mt-1">
                  <PopoverMenu
                    open={activePopover === "assignee"}
                    onClose={() => setActivePopover(null)}
                    items={assigneeOptions.map((a) => ({
                      value: a,
                      label: a,
                    }))}
                    selected={job.assignee}
                    onSelect={(v) => {
                      const initials = v === "Unassigned" ? "??" : v.split(" ").map((n) => n[0]).join("");
                      updateJobServer(job.id, {
                        assignee: v,
                        assigneeInitials: initials,
                      });
                      addToast(`Assigned to ${v}`);
                    }}
                    width={200}
                    align="right"
                  />
                </div>
              </div>

              {/* Due Date */}
              <PropertyRow label="Due Date">
                <Calendar size={12} className="text-zinc-600" />
                <span
                  className={`text-[12px] ${
                    job.due === "Today"
                      ? "font-medium text-amber-400"
                      : job.due === "Tomorrow"
                        ? "text-zinc-300"
                        : "text-zinc-400"
                  }`}
                >
                  {job.due}
                </span>
              </PropertyRow>

              {/* Client */}
              <PropertyRow label="Customer">
                <User size={12} className="text-zinc-600" />
                <span className="text-[12px] text-zinc-400">{job.client}</span>
              </PropertyRow>

              {/* Labels */}
              <div className="flex items-start justify-between rounded-md px-3 py-2">
                <span className="text-[11px] text-zinc-600">Labels</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {job.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <PropertyRow label="Hours">
                <Clock size={12} className="text-zinc-600" />
                <span className="text-[12px] text-zinc-400">
                  {job.actualHours || 0}h / {job.estimatedHours || 0}h est.
                </span>
              </PropertyRow>

              {/* Created */}
              <PropertyRow label="Created">
                <Sparkles size={12} className="text-zinc-600" />
                <span className="text-[12px] text-zinc-500">{job.created}</span>
              </PropertyRow>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={headerContextItems}
        onSelect={handleHeaderContextAction}
        onClose={() => setCtxMenu((p) => ({ ...p, open: false }))}
      />
    </motion.div>
  );
}

/* ── Property Row Component ───────────────────────────────── */

function PropertyRow({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors duration-150 ${
        onClick
          ? "cursor-pointer hover:bg-white/[0.03]"
          : ""
      }`}
    >
      <span className="text-[11px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
