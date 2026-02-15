"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";
import { jobs } from "@/lib/data";
import { StatusIcon } from "@/components/app/status-icon";
import { PriorityIcon } from "@/components/app/priority-icon";
import { PopoverMenu } from "@/components/app/popover-menu";
import { useToastStore } from "@/components/app/action-toast";
import type { Priority, JobStatus } from "@/lib/data";

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

const assigneeOptions = ["Mike Thompson", "Sarah Chen", "James O'Brien", "Tom Liu"];

export function SlideOver() {
  const { slideOverOpen, slideOverContent, closeSlideOver } = useShellStore();
  const { addToast } = useToastStore();
  const router = useRouter();

  const job = slideOverContent ? jobs.find((j) => j.id === slideOverContent.id) : null;

  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [localStatus, setLocalStatus] = useState<JobStatus>("todo");
  const [localPriority, setLocalPriority] = useState<Priority>("medium");
  const [localAssignee, setLocalAssignee] = useState("Mike Thompson");
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  // Sync from job data
  useEffect(() => {
    if (job) {
      setLocalTitle(job.title);
      setLocalStatus(job.status);
      setLocalPriority(job.priority);
      setLocalAssignee(job.assignee);
      setDescription("Customer reported intermittent issue. Last serviced 6 months ago. Requires pressure valve inspection and potential replacement of faulty components.");
      setEditingTitle(false);
      setActivePopover(null);
    }
  }, [job]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && slideOverOpen) {
        if (activePopover) setActivePopover(null);
        else closeSlideOver();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slideOverOpen, closeSlideOver, activePopover]);

  return (
    <AnimatePresence>
      {slideOverOpen && slideOverContent && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeSlideOver}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed top-0 right-0 z-40 flex h-full w-full max-w-2xl flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#050505]/98 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] tracking-tight text-zinc-500/60">
                  {slideOverContent.id}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (slideOverContent?.type === "Job") {
                      closeSlideOver();
                      router.push(`/dashboard/jobs/${slideOverContent.id}`);
                    }
                  }}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
                  title="Open full view"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={closeSlideOver}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 2-column body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Main stage (left 65%) */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Editable title */}
                {editingTitle ? (
                  <input
                    autoFocus
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      addToast("Title updated");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setEditingTitle(false); addToast("Title updated"); }
                    }}
                    className="mb-4 w-full bg-transparent text-[20px] font-medium tracking-tight text-zinc-100 outline-none"
                  />
                ) : (
                  <h2
                    onClick={() => setEditingTitle(true)}
                    className="mb-4 cursor-text text-[20px] font-medium tracking-tight text-zinc-100 transition-colors hover:text-white"
                  >
                    {localTitle}
                  </h2>
                )}

                {/* Description */}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => addToast("Saved")}
                  placeholder="Add description..."
                  className="mb-6 w-full resize-none rounded-lg border border-transparent bg-transparent p-0 text-[13px] leading-relaxed text-zinc-400 outline-none transition-colors focus:border-[rgba(255,255,255,0.08)] focus:bg-[rgba(255,255,255,0.02)] focus:p-3"
                  rows={4}
                />

                {/* Activity */}
                <div className="border-t border-[rgba(255,255,255,0.06)] pt-4">
                  <h4 className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    <MessageSquare size={12} /> Activity
                  </h4>
                  <div className="space-y-3">
                    {[
                      { text: "Mike Thompson changed status to In Progress", time: "2h ago" },
                      { text: "Sarah Chen added label Emergency", time: "3h ago" },
                      { text: "Job created by system", time: "1d ago" },
                    ].map((entry, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700" />
                        <div>
                          <span className="text-[12px] text-zinc-500">{entry.text}</span>
                          <span className="ml-2 text-[10px] text-zinc-700">{entry.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Meta sidebar (right 35%) */}
              <div className="w-56 shrink-0 overflow-y-auto border-l border-[rgba(255,255,255,0.06)] p-4">
                <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  Properties
                </h4>
                <div className="space-y-3">
                  {/* Status */}
                  <div className="relative">
                    <div className="mb-1 text-[11px] text-zinc-600">Status</div>
                    <button
                      onClick={() => setActivePopover(activePopover === "status" ? null : "status")}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <StatusIcon status={localStatus} size={12} />
                      {statusOptions.find((s) => s.value === localStatus)?.label}
                    </button>
                    <div className="absolute top-full left-0 mt-1">
                      <PopoverMenu
                        open={activePopover === "status"}
                        onClose={() => setActivePopover(null)}
                        items={statusOptions.map((s) => ({ value: s.value, label: s.label, icon: <StatusIcon status={s.value} size={12} /> }))}
                        selected={localStatus}
                        onSelect={(v) => { setLocalStatus(v); addToast(`Status changed to ${statusOptions.find(s => s.value === v)?.label}`); }}
                        width={180}
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="relative">
                    <div className="mb-1 text-[11px] text-zinc-600">Priority</div>
                    <button
                      onClick={() => setActivePopover(activePopover === "priority" ? null : "priority")}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <PriorityIcon priority={localPriority} size={12} />
                      {priorityOptions.find((p) => p.value === localPriority)?.label}
                    </button>
                    <div className="absolute top-full left-0 mt-1">
                      <PopoverMenu
                        open={activePopover === "priority"}
                        onClose={() => setActivePopover(null)}
                        items={priorityOptions.map((p) => ({ value: p.value, label: p.label, icon: <PriorityIcon priority={p.value} size={12} /> }))}
                        selected={localPriority}
                        onSelect={(v) => { setLocalPriority(v); addToast(`Priority changed to ${priorityOptions.find(p => p.value === v)?.label}`); }}
                        width={170}
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="relative">
                    <div className="mb-1 text-[11px] text-zinc-600">Assignee</div>
                    <button
                      onClick={() => setActivePopover(activePopover === "assignee" ? null : "assignee")}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      {localAssignee}
                    </button>
                    <div className="absolute top-full left-0 mt-1">
                      <PopoverMenu
                        open={activePopover === "assignee"}
                        onClose={() => setActivePopover(null)}
                        items={assigneeOptions.map((a) => ({ value: a, label: a }))}
                        selected={localAssignee}
                        onSelect={(v) => { setLocalAssignee(v); addToast(`Assigned to ${v}`); }}
                        width={190}
                      />
                    </div>
                  </div>

                  {/* Client */}
                  <div>
                    <div className="mb-1 text-[11px] text-zinc-600">Client</div>
                    <div className="px-2 py-1 text-[12px] text-zinc-400">
                      {job?.client || "—"}
                    </div>
                  </div>

                  {/* Due */}
                  <div>
                    <div className="mb-1 text-[11px] text-zinc-600">Due</div>
                    <div className={`px-2 py-1 text-[12px] ${job?.due === "Today" ? "text-amber-400" : "text-zinc-400"}`}>
                      {job?.due || "—"}
                    </div>
                  </div>

                  {/* Labels */}
                  <div>
                    <div className="mb-1 text-[11px] text-zinc-600">Labels</div>
                    <div className="flex flex-wrap gap-1 px-2 py-1">
                      {(job?.labels || []).map((label) => (
                        <span
                          key={label}
                          className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
