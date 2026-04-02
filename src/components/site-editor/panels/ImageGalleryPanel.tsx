/**
 * @component components/site-editor/panels/ImageGalleryPanel.tsx
 * @status STABLE
 * @description Loom site builder — ImageGalleryPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { ImageGalleryContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function ImageGalleryPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as ImageGalleryContent;
  const set = (patch: Partial<ImageGalleryContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Columns</label>
        <select value={c.columns} onChange={(e) => set({ columns: Number(e.target.value) as 2 | 3 | 4 })} className="stealth-input w-full">
          <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
        </select>
      </div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Aspect Ratio</label>
        <select value={c.aspectRatio} onChange={(e) => set({ aspectRatio: e.target.value as "square" | "landscape" | "portrait" })} className="stealth-input w-full">
          <option value="square">Square</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Images ({c.images.length})</span>
          <button onClick={() => set({ images: [...c.images, { id: makeSiteBlockId(), url: "", alt: "", caption: "" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {c.images.map((img) => (
            <div key={img.id} className="flex gap-2 items-center">
              <input type="url" value={img.url} onChange={(e) => set({ images: c.images.map((x) => x.id === img.id ? { ...x, url: e.target.value } : x) })} className="stealth-input flex-1 text-[10px]" placeholder="Image URL" />
              <button onClick={() => set({ images: c.images.filter((x) => x.id !== img.id) })} className="text-red-400"><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
