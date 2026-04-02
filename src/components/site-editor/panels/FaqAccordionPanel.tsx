/**
 * @component components/site-editor/panels/FaqAccordionPanel.tsx
 * @status STABLE
 * @description Loom site builder — FaqAccordionPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { FaqAccordionContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function FaqAccordionPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as FaqAccordionContent;
  const set = (patch: Partial<FaqAccordionContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">FAQ Items ({c.faqs.length})</span>
          <button onClick={() => set({ faqs: [...c.faqs, { id: makeSiteBlockId(), question: "Question?", answer: "Answer." }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {c.faqs.map((faq) => (
            <div key={faq.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 space-y-1">
              <div className="flex items-center gap-2">
                <input type="text" value={faq.question} onChange={(e) => set({ faqs: c.faqs.map((x) => x.id === faq.id ? { ...x, question: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Question" />
                <button onClick={() => set({ faqs: c.faqs.filter((x) => x.id !== faq.id) })} className="text-red-400"><Trash2 size={10} /></button>
              </div>
              <textarea value={faq.answer} onChange={(e) => set({ faqs: c.faqs.map((x) => x.id === faq.id ? { ...x, answer: e.target.value } : x) })} className="stealth-input w-full text-[10px] resize-none" rows={2} placeholder="Answer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
