"use client";

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    backlog: "Draft",
    todo: "To Do",
    scheduled: "Scheduled",
    en_route: "En Route",
    on_site: "On Site",
    in_progress: "In Progress",
    done: "Done",
    completed: "Completed",
    invoiced: "Invoiced",
    archived: "Archived",
    cancelled: "Cancelled",
    urgent: "Urgent",
    on_hold: "On Hold",
  };
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const styles: Record<string, string> = {
  urgent: "bg-rose-500/15 text-rose-400",
  backlog: "bg-zinc-500/10 text-zinc-500",
  todo: "bg-zinc-400/10 text-zinc-400",
  scheduled: "bg-sky-500/15 text-sky-400",
  en_route: "bg-amber-500/15 text-amber-400",
  on_site: "bg-violet-500/15 text-violet-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  done: "bg-emerald-500/15 text-emerald-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  invoiced: "bg-blue-500/15 text-blue-400",
  archived: "bg-zinc-500/10 text-zinc-600",
  cancelled: "bg-zinc-500/10 text-zinc-600",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${styles[status] || styles.backlog}`}
    >
      {formatStatus(status)}
    </span>
  );
}
