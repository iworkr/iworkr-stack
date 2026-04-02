/**
 * @component components/site-editor/panels/FeatureGridPanel.tsx
 * @status STABLE
 * @description Loom site builder — FeatureGridPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { FeatureGridContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function FeatureGridPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as FeatureGridContent;
  const set = (patch: Partial<FeatureGridContent>) => update(blockId, patch);

  function addFeature() {
    set({ features: [...c.features, { id: makeSiteBlockId(), icon: "✦", title: "Feature", description: "Description" }] });
  }
  function removeFeature(id: string) {
    set({ features: c.features.filter((f) => f.id !== id) });
  }
  function updateFeature(id: string, patch: Partial<(typeof c.features)[0]>) {
    set({ features: c.features.map((f) => f.id === id ? { ...f, ...patch } : f) });
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Heading</label>
        <input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Columns</label>
        <select value={c.columns} onChange={(e) => set({ columns: Number(e.target.value) as 2 | 3 | 4 })} className="stealth-input w-full">
          <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Features ({c.features.length})</span>
          <button onClick={addFeature} className="text-emerald-400 hover:text-emerald-300"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {c.features.map((f) => (
            <div key={f.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <input type="text" value={f.icon} onChange={(e) => updateFeature(f.id, { icon: e.target.value })} className="stealth-input w-10 text-center" />
                <input type="text" value={f.title} onChange={(e) => updateFeature(f.id, { title: e.target.value })} className="stealth-input flex-1" />
                <button onClick={() => removeFeature(f.id)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
              </div>
              <input type="text" value={f.description} onChange={(e) => updateFeature(f.id, { description: e.target.value })} className="stealth-input w-full text-[10px]" placeholder="Description" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
