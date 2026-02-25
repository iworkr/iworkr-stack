"use client";

const config: Record<string, { label: string; color: string; fill: number }> = {
  backlog: { label: "Draft", color: "text-zinc-600", fill: 0 },
  todo: { label: "To Do", color: "text-zinc-400", fill: 0 },
  scheduled: { label: "Scheduled", color: "text-sky-400", fill: 0.15 },
  en_route: { label: "En Route", color: "text-amber-400", fill: 0.3 },
  on_site: { label: "On Site", color: "text-violet-400", fill: 0.45 },
  in_progress: { label: "In Progress", color: "text-amber-400", fill: 0.5 },
  done: { label: "Done", color: "text-emerald-400", fill: 1 },
  completed: { label: "Completed", color: "text-emerald-400", fill: 1 },
  invoiced: { label: "Invoiced", color: "text-blue-400", fill: 1 },
  archived: { label: "Archived", color: "text-zinc-600", fill: 1 },
  cancelled: { label: "Cancelled", color: "text-zinc-600", fill: 0 },
  urgent: { label: "Urgent", color: "text-rose-400", fill: 0.25 },
};

export function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const { color } = config[status] ?? config.backlog;
  const r = 5;
  const cx = 8;
  const cy = 8;

  if (status === "done" || status === "completed") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "cancelled") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === "invoiced") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "archived") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "en_route" || status === "on_site") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth="1.2" />
        <path d={`M${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`} fill="currentColor" fillOpacity="0.3" />
        <circle cx={cx} cy={cy} r="1.5" fill="currentColor" fillOpacity="0.6" />
      </svg>
    );
  }

  if (status === "in_progress") {
    // Half-filled circle
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth="1.2" />
        <path d={`M${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r}`} fill="currentColor" fillOpacity="0.4" />
      </svg>
    );
  }

  // backlog (dotted) or todo (empty)
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray={status === "backlog" ? "2 2" : "none"}
      />
    </svg>
  );
}

export function StatusLabel({ status }: { status: string }) {
  const { label, color } = config[status] ?? config.backlog;
  return <span className={`text-xs ${color}`}>{label}</span>;
}
