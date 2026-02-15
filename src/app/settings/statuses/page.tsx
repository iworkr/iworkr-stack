"use client";

import { StatusIcon } from "@/components/app/status-icon";
import type { JobStatus } from "@/lib/data";

const statuses: { status: JobStatus; description: string }[] = [
  { status: "backlog", description: "Jobs not yet scheduled or prioritized" },
  { status: "todo", description: "Ready to be worked on" },
  { status: "in_progress", description: "Currently being worked on" },
  { status: "done", description: "Job completed" },
  { status: "cancelled", description: "Job cancelled or no longer needed" },
];

export default function StatusesPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">Statuses</h1>
      <p className="mb-6 text-[13px] text-zinc-600">Configure the workflow statuses for jobs in your workspace.</p>
      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)]">
        {statuses.map((s, i) => (
          <div key={s.status} className={`flex items-center justify-between px-4 py-3 ${i !== statuses.length - 1 ? "border-b border-[rgba(255,255,255,0.04)]" : ""} hover:bg-[rgba(255,255,255,0.02)]`}>
            <div className="flex items-center gap-3">
              <StatusIcon status={s.status} size={16} />
              <div>
                <div className="text-[13px] font-medium text-zinc-200">{s.status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div className="text-[11px] text-zinc-600">{s.description}</div>
              </div>
            </div>
            <button className="text-[12px] text-zinc-600 hover:text-zinc-400">Edit</button>
          </div>
        ))}
      </div>
    </>
  );
}
