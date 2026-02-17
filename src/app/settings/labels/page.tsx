"use client";

import { Plus } from "lucide-react";

const labels = [
  { name: "Plumbing", color: "bg-[#00E676]" },
  { name: "Electrical", color: "bg-amber-500" },
  { name: "HVAC", color: "bg-cyan-500" },
  { name: "Emergency", color: "bg-red-500" },
  { name: "Maintenance", color: "bg-emerald-500" },
  { name: "Install", color: "bg-zinc-500" },
  { name: "Inspection", color: "bg-orange-500" },
  { name: "Compliance", color: "bg-pink-500" },
  { name: "Drainage", color: "bg-teal-500" },
  { name: "Outdoor", color: "bg-lime-500" },
];

export default function LabelsPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Labels</h1>
        <button className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-zinc-200">
          <Plus size={14} /> New label
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)]">
        {labels.map((label, i) => (
          <div key={label.name} className={`flex items-center justify-between px-4 py-3 ${i !== labels.length - 1 ? "border-b border-[rgba(255,255,255,0.04)]" : ""} hover:bg-[rgba(255,255,255,0.02)]`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${label.color}`} />
              <span className="text-[13px] text-zinc-300">{label.name}</span>
            </div>
            <button className="text-[12px] text-zinc-600 hover:text-zinc-400">Edit</button>
          </div>
        ))}
      </div>
    </>
  );
}
