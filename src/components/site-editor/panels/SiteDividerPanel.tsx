/**
 * @component components/site-editor/panels/SiteDividerPanel.tsx
 * @status STABLE
 * @description Loom site builder — SiteDividerPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { SiteDividerContent } from "../types";

export function SiteDividerPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as SiteDividerContent;
  const set = (patch: Partial<SiteDividerContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Thickness: {c.thickness}px</label>
        <input type="range" min={1} max={8} value={c.thickness} onChange={(e) => set({ thickness: Number(e.target.value) })} className="w-full accent-emerald-500" />
      </div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Color</label><input type="color" value={c.color || "#e5e7eb"} onChange={(e) => set({ color: e.target.value })} className="h-8 w-full cursor-pointer rounded" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Max Width</label>
        <select value={c.maxWidth} onChange={(e) => set({ maxWidth: e.target.value as "full" | "medium" | "narrow" })} className="stealth-input w-full">
          <option value="full">Full</option><option value="medium">Medium</option><option value="narrow">Narrow</option>
        </select>
      </div>
    </div>
  );
}
