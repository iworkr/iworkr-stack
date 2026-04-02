/**
 * @component components/site-editor/panels/StatsCounterPanel.tsx
 * @status STABLE
 * @description Loom site builder — StatsCounterPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { StatsCounterContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function StatsCounterPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as StatsCounterContent;
  const set = (patch: Partial<StatsCounterContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Background Color</label><input type="color" value={c.backgroundColor || "#10B981"} onChange={(e) => set({ backgroundColor: e.target.value })} className="h-8 w-full cursor-pointer rounded" /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Stats ({c.stats.length})</span>
          <button onClick={() => set({ stats: [...c.stats, { id: makeSiteBlockId(), value: "100", label: "Label", prefix: "", suffix: "+" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        {c.stats.map((s) => (
          <div key={s.id} className="flex gap-2 mb-1.5 items-center">
            <input type="text" value={s.prefix} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, prefix: e.target.value } : x) })} className="stealth-input w-8" placeholder="$" />
            <input type="text" value={s.value} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, value: e.target.value } : x) })} className="stealth-input w-16" />
            <input type="text" value={s.suffix} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, suffix: e.target.value } : x) })} className="stealth-input w-8" placeholder="+" />
            <input type="text" value={s.label} onChange={(e) => set({ stats: c.stats.map((x) => x.id === s.id ? { ...x, label: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Label" />
            <button onClick={() => set({ stats: c.stats.filter((x) => x.id !== s.id) })} className="text-red-400"><Trash2 size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
