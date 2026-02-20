"use client";

import React from "react";
import {
  Calendar,
  ChevronDown,
  PenTool,
  MapPin,
  Camera,
} from "lucide-react";
import type { FormBlock } from "@/lib/forms-data";

/* ── Stealth input: borderless until focus ───────────────── */

const stealthInputClass =
  "w-full bg-transparent text-[13px] text-zinc-300 placeholder-zinc-600 outline-none transition-[border-color] duration-150 border-b border-transparent focus:border-white";

/* ── Block previews (builder view) ──────────────────────── */

export function BlockPreview({
  block,
  isBuilder,
}: {
  block: FormBlock;
  isBuilder?: boolean;
}) {
  const builder = isBuilder !== false;

  switch (block.type) {
    case "heading":
      return (
        <div className="border-b border-white/5 pb-1 font-display text-base font-bold text-white">
          {block.label}
        </div>
      );

    case "short_text":
      return (
        <div className="group">
          <input
            type="text"
            readOnly={builder}
            placeholder={block.placeholder || "Enter text…"}
            className={`${stealthInputClass} py-1.5`}
          />
        </div>
      );

    case "long_text":
      return (
        <textarea
          readOnly={builder}
          placeholder={block.placeholder || "Enter longer text…"}
          rows={3}
          className={`${stealthInputClass} min-h-[72px] resize-none pt-1.5`}
        />
      );

    case "date":
      return (
        <div className="flex h-9 items-center gap-2 border-b border-transparent px-0 text-[13px] text-zinc-500 focus-within:border-white">
          <Calendar size={14} className="shrink-0 text-zinc-600" />
          <span>Select date…</span>
        </div>
      );

    case "dropdown":
      return (
        <div className="flex h-9 items-center justify-between border-b border-white/5 px-0 text-[13px] text-zinc-500">
          <span>Select…</span>
          <ChevronDown size={14} className="text-zinc-600" />
        </div>
      );

    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-2.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/20 bg-white/[0.02] transition-colors group-hover:border-white/30">
            {/* Checked state could use Lottie here */}
          </div>
          <span className="text-[13px] text-zinc-400">{block.label}</span>
        </label>
      );

    case "signature":
      return (
        <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/[0.02]">
          <PenTool size={18} className="mr-2 text-zinc-600" />
          <span className="text-[12px] text-zinc-500">Sign here</span>
        </div>
      );

    case "gps_stamp":
      return (
        <div className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 font-mono text-[11px] text-zinc-400">
          <MapPin size={12} className="shrink-0 text-zinc-500" />
          <span>Captured on submit</span>
        </div>
      );

    case "photo_evidence":
      return (
        <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] transition-colors hover:border-white/25">
          <Camera size={20} className="mr-2 text-zinc-600" />
          <span className="text-[12px] text-zinc-500">Dropzone — add photo</span>
        </div>
      );

    case "risk_matrix":
      return <RiskMatrixPreview />;

    default:
      return (
        <div className="h-9 border-b border-transparent text-[13px] text-zinc-600">
          {block.label}
        </div>
      );
  }
}

/* ── 5×5 Risk Matrix (builder preview) ───────────────────── */

function RiskMatrixPreview() {
  const rows = 5;
  const cols = 5;
  const likelihood = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"];
  const consequence = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols + 1}, 1fr)` }}>
        <div className="rounded-tl bg-transparent p-1" />
        {consequence.map((c) => (
          <div
            key={c}
            className="truncate bg-white/5 px-1 py-0.5 text-center text-[8px] font-medium text-zinc-500"
          >
            {c}
          </div>
        ))}
        {Array.from({ length: rows }).map((_, i) => (
          <React.Fragment key={i}>
            <div className="truncate bg-white/5 px-1 py-0.5 text-[8px] text-zinc-500">
              {likelihood[i]}
            </div>
            {Array.from({ length: cols }).map((_, j) => {
              const score = (i + 1) * (j + 1);
              const level =
                score <= 4 ? "low" : score <= 9 ? "med" : score <= 16 ? "high" : "extreme";
              const bg =
                level === "low"
                  ? "bg-emerald-500/15"
                  : level === "med"
                  ? "bg-amber-500/15"
                  : level === "high"
                  ? "bg-orange-500/15"
                  : "bg-rose-500/15";
              const text =
                level === "low"
                  ? "text-emerald-400"
                  : level === "med"
                  ? "text-amber-400"
                  : level === "high"
                  ? "text-orange-400"
                  : "text-rose-400";
              return (
                <div
                  key={j}
                  className={`flex items-center justify-center rounded p-0.5 text-[9px] font-mono font-medium ${bg} ${text}`}
                >
                  {score}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
