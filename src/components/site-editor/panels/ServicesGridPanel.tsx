/**
 * @component components/site-editor/panels/ServicesGridPanel.tsx
 * @status STABLE
 * @description Loom site builder — ServicesGridPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { ServicesGridContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function ServicesGridPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as ServicesGridContent;
  const set = (patch: Partial<ServicesGridContent>) => update(blockId, patch);

  function addService() {
    set({ services: [...c.services, { id: makeSiteBlockId(), title: "Service", description: "", icon: "🔧", imageUrl: "" }] });
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Heading</label>
        <input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Columns</label>
        <select value={c.columns} onChange={(e) => set({ columns: Number(e.target.value) as 2 | 3 })} className="stealth-input w-full">
          <option value={2}>2</option><option value={3}>3</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.showImages} onChange={(e) => set({ showImages: e.target.checked })} className="accent-emerald-500" />
        Show Images
      </label>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Services ({c.services.length})</span>
          <button onClick={addService} className="text-emerald-400 hover:text-emerald-300"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {c.services.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <input type="text" value={s.icon} onChange={(e) => set({ services: c.services.map((x) => x.id === s.id ? { ...x, icon: e.target.value } : x) })} className="stealth-input w-10 text-center" />
                <input type="text" value={s.title} onChange={(e) => set({ services: c.services.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x) })} className="stealth-input flex-1" />
                <button onClick={() => set({ services: c.services.filter((x) => x.id !== s.id) })} className="text-red-400"><Trash2 size={10} /></button>
              </div>
              <input type="text" value={s.description} onChange={(e) => set({ services: c.services.map((x) => x.id === s.id ? { ...x, description: e.target.value } : x) })} className="stealth-input w-full text-[10px]" placeholder="Description" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
