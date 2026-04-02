/**
 * @component components/site-editor/panels/TestimonialsPanel.tsx
 * @status STABLE
 * @description Loom site builder — TestimonialsPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { TestimonialsContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function TestimonialsPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as TestimonialsContent;
  const set = (patch: Partial<TestimonialsContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Layout</label>
        <select value={c.layout} onChange={(e) => set({ layout: e.target.value as "grid" | "carousel" | "masonry" })} className="stealth-input w-full">
          <option value="grid">Grid</option><option value="carousel">Carousel</option><option value="masonry">Masonry</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Testimonials ({c.testimonials.length})</span>
          <button onClick={() => set({ testimonials: [...c.testimonials, { id: makeSiteBlockId(), name: "Client", role: "", company: "", text: "Great service!", rating: 5, photoUrl: "" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {c.testimonials.map((t) => (
            <div key={t.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 space-y-1">
              <div className="flex items-center gap-2">
                <input type="text" value={t.name} onChange={(e) => set({ testimonials: c.testimonials.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Name" />
                <select value={t.rating} onChange={(e) => set({ testimonials: c.testimonials.map((x) => x.id === t.id ? { ...x, rating: Number(e.target.value) } : x) })} className="stealth-input w-14">
                  {[1,2,3,4,5].map((r) => <option key={r} value={r}>{r}★</option>)}
                </select>
                <button onClick={() => set({ testimonials: c.testimonials.filter((x) => x.id !== t.id) })} className="text-red-400"><Trash2 size={10} /></button>
              </div>
              <textarea value={t.text} onChange={(e) => set({ testimonials: c.testimonials.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x) })} className="stealth-input w-full text-[10px] resize-none" rows={2} placeholder="Testimonial text" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
