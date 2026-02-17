"use client";

import { FileText } from "lucide-react";
import { useDashboardStore } from "@/lib/dashboard-store";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

export function WidgetNotepad({ size = "medium" }: { size?: WidgetSize }) {
  const content = useDashboardStore((s) => s.notepadContent);
  const setContent = useDashboardStore((s) => s.setNotepadContent);

  /* ── SMALL: Read-only preview ───────────────────────── */
  if (size === "small") {
    const preview = content.trim().split("\n")[0] || "No notes";
    return (
      <WidgetShell delay={0}>
        <div className="flex h-full flex-col justify-center p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={10} className="text-zinc-600" />
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">Notes</span>
          </div>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
            {preview}
          </p>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE: Editable textarea ──────────────── */
  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Notepad</span>
          {content.trim() && (
            <span className="text-[10px] text-zinc-700">
              {content.trim().split("\n").length} line{content.trim().split("\n").length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      }
    >
      <div className="flex-1 p-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quick notes..."
          className="h-full min-h-[80px] w-full resize-none rounded-md bg-transparent p-2 text-[12px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700 focus:bg-[rgba(255,255,255,0.02)]"
          style={{ height: "calc(100% - 8px)" }}
        />
      </div>
    </WidgetShell>
  );
}
