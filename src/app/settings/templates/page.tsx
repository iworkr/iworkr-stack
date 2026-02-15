"use client";

import { Plus, FileText } from "lucide-react";

const templates = [
  { name: "Standard Service Call", jobs: 145, updated: "2 days ago" },
  { name: "Emergency Callout", jobs: 38, updated: "1 week ago" },
  { name: "Installation — General", jobs: 67, updated: "3 days ago" },
  { name: "Compliance Inspection", jobs: 23, updated: "2 weeks ago" },
  { name: "Maintenance — Boiler", jobs: 54, updated: "5 days ago" },
];

export default function TemplatesPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Templates</h1>
          <p className="mt-1 text-[13px] text-zinc-600">Reusable job descriptions and checklists.</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-zinc-200">
          <Plus size={14} /> New template
        </button>
      </div>
      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.name} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 transition-colors hover:border-[rgba(255,255,255,0.12)]">
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-zinc-500" />
              <div>
                <div className="text-[13px] font-medium text-zinc-200">{t.name}</div>
                <div className="text-[11px] text-zinc-600">Used in {t.jobs} jobs · Updated {t.updated}</div>
              </div>
            </div>
            <button className="rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[12px] text-zinc-500 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300">Edit</button>
          </div>
        ))}
      </div>
    </>
  );
}
