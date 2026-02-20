"use client";

import type { JobStatus } from "@/lib/data";

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    in_progress: "In Progress",
    todo: "To Do",
    done: "Done",
    backlog: "Backlog",
    cancelled: "Cancelled",
    urgent: "Urgent",
    on_hold: "On Hold",
  };
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const styles: Record<JobStatus, string> = {
  urgent: "bg-rose-500/15 text-rose-400",
  backlog: "bg-zinc-500/10 text-zinc-500",
  todo: "bg-zinc-400/10 text-zinc-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  done: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-zinc-500/10 text-zinc-600",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${styles[status] || styles.backlog}`}
    >
      {formatStatus(status)}
    </span>
  );
}
