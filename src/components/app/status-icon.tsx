"use client";

import type { JobStatus } from "@/lib/data";

const config: Record<JobStatus, { label: string; color: string; fill: number }> = {
  backlog: { label: "Backlog", color: "text-zinc-600", fill: 0 },
  todo: { label: "Todo", color: "text-zinc-400", fill: 0 },
  in_progress: { label: "In Progress", color: "text-amber-400", fill: 0.5 },
  done: { label: "Done", color: "text-emerald-400", fill: 1 },
  cancelled: { label: "Cancelled", color: "text-zinc-600", fill: 0 },
  urgent: { label: "Urgent", color: "text-rose-400", fill: 0.25 },
};

export function StatusIcon({ status, size = 14 }: { status: JobStatus; size?: number }) {
  const { color, fill } = config[status];
  const r = 5;
  const cx = 8;
  const cy = 8;

  if (status === "done") {
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

export function StatusLabel({ status }: { status: JobStatus }) {
  const { label, color } = config[status];
  return <span className={`text-xs ${color}`}>{label}</span>;
}
