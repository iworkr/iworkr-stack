/**
 * @component components/site-editor/panels/TextSectionPanel.tsx
 * @status STABLE
 * @description Loom site builder — TextSectionPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { TextSectionContent } from "../types";

export function TextSectionPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as TextSectionContent;
  const set = (patch: Partial<TextSectionContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Body</label><textarea value={c.body} onChange={(e) => set({ body: e.target.value })} rows={6} className="stealth-input w-full resize-none" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Alignment</label>
        <select value={c.alignment} onChange={(e) => set({ alignment: e.target.value as "left" | "center" | "right" })} className="stealth-input w-full">
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </select>
      </div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Max Width</label>
        <select value={c.maxWidth} onChange={(e) => set({ maxWidth: e.target.value as "narrow" | "medium" | "full" })} className="stealth-input w-full">
          <option value="narrow">Narrow</option><option value="medium">Medium</option><option value="full">Full</option>
        </select>
      </div>
    </div>
  );
}
