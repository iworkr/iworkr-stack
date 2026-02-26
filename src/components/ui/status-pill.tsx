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

/* Ghost Tint system: translucent bg + colored text + colored border */
const styles: Record<string, string> = {
  urgent:      "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  backlog:     "bg-zinc-500/8 text-zinc-500 border border-zinc-500/15",
  todo:        "bg-zinc-400/8 text-zinc-400 border border-zinc-400/15",
  scheduled:   "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  en_route:    "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  on_site:     "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  in_progress: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  done:        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  completed:   "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  invoiced:    "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  archived:    "bg-zinc-500/8 text-zinc-600 border border-zinc-500/10",
  cancelled:   "bg-zinc-500/8 text-zinc-600 border border-zinc-500/10",
  on_hold:     "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap overflow-hidden text-ellipsis rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${styles[status] || styles.backlog}`}
    >
      {formatStatus(status)}
    </span>
  );
}
