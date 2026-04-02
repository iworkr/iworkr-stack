/**
 * @component components/site-editor/panels/SiteSpacerPanel.tsx
 * @status STABLE
 * @description Loom site builder — SiteSpacerPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { SiteSpacerContent } from "../types";

export function SiteSpacerPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as SiteSpacerContent;
  const set = (patch: Partial<SiteSpacerContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Height: {c.height}px</label>
        <input type="range" min={8} max={200} value={c.height} onChange={(e) => set({ height: Number(e.target.value) })} className="w-full accent-emerald-500" />
      </div>
      <div className="flex gap-2">
        {[24, 48, 80, 120].map((h) => (
          <button key={h} onClick={() => set({ height: h })} className={`rounded px-2 py-1 text-[10px] ${c.height === h ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--surface-2)] text-zinc-500"}`}>{h}px</button>
        ))}
      </div>
    </div>
  );
}
