"use client";

import { FileText } from "lucide-react";
import { useDashboardStore } from "@/lib/dashboard-store";
import { WidgetShell } from "./widget-shell";

export function WidgetNotepad() {
  const content = useDashboardStore((s) => s.notepadContent);
  const setContent = useDashboardStore((s) => s.setNotepadContent);

  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Notepad</span>
        </div>
      }
    >
      <div className="p-2">
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
