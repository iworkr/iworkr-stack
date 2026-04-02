/**
 * @component components/site-editor/panels/AboutPanel.tsx
 * @status STABLE
 * @description Loom site builder — AboutPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { AboutSectionContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function AboutPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as AboutSectionContent;
  const set = (patch: Partial<AboutSectionContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Body</label><textarea value={c.body} onChange={(e) => set({ body: e.target.value })} rows={4} className="stealth-input w-full resize-none" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Image URL</label><input type="url" value={c.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Image Position</label>
        <select value={c.imagePosition} onChange={(e) => set({ imagePosition: e.target.value as "left" | "right" })} className="stealth-input w-full">
          <option value="left">Left</option><option value="right">Right</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.showStats} onChange={(e) => set({ showStats: e.target.checked })} className="accent-emerald-500" />
        Show Stats
      </label>
      {c.showStats && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-zinc-400">Stats</span>
            <button onClick={() => set({ stats: [...c.stats, { id: makeSiteBlockId(), value: "0", label: "Label" }] })} className="text-emerald-400"><Plus size={12} /></button>
          </div>
          {c.stats.map((s) => (
            <div key={s.id} className="flex gap-2 mb-1.5">
              <input type="text" value={s.value} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, value: e.target.value } : x) })} className="stealth-input w-16" placeholder="100+" />
              <input type="text" value={s.label} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, label: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Label" />
              <button onClick={() => set({ stats: c.stats.filter((x) => x.id !== s.id) })} className="text-red-400"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
