/**
 * @component components/site-editor/panels/FooterPanel.tsx
 * @status STABLE
 * @description Loom site builder — FooterPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { SiteFooterContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function FooterPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as SiteFooterContent;
  const set = (patch: Partial<SiteFooterContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Company Name</label><input type="text" value={c.companyName} onChange={(e) => set({ companyName: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Description</label><textarea value={c.description} onChange={(e) => set({ description: e.target.value })} rows={2} className="stealth-input w-full resize-none" /></div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.showCopyright} onChange={(e) => set({ showCopyright: e.target.checked })} className="accent-emerald-500" />Show Copyright
      </label>
      <div className="space-y-2">
        <span className="text-[11px] text-zinc-400 block">Social Links</span>
        {(["facebook", "instagram", "linkedin"] as const).map((key) => (
          <div key={key}>
            <label className="text-[10px] text-zinc-500 block mb-0.5 capitalize">{key}</label>
            <input type="url" value={c.socialLinks[key]} onChange={(e) => set({ socialLinks: { ...c.socialLinks, [key]: e.target.value } })} className="stealth-input w-full text-[10px]" placeholder={`https://${key}.com/...`} />
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Footer Columns</span>
          <button onClick={() => set({ columns: [...c.columns, { id: makeSiteBlockId(), heading: "Column", links: [] }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        {c.columns.map((col) => (
          <div key={col.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 mb-2 space-y-1">
            <div className="flex items-center gap-2">
              <input type="text" value={col.heading} onChange={(e) => set({ columns: c.columns.map((x) => x.id === col.id ? { ...x, heading: e.target.value } : x) })} className="stealth-input flex-1" />
              <button onClick={() => set({ columns: c.columns.filter((x) => x.id !== col.id) })} className="text-red-400"><Trash2 size={10} /></button>
            </div>
            {col.links.map((link) => (
              <div key={link.id} className="flex gap-1 items-center">
                <input type="text" value={link.label} onChange={(e) => set({ columns: c.columns.map((x) => x.id === col.id ? { ...x, links: x.links.map((l) => l.id === link.id ? { ...l, label: e.target.value } : l) } : x) })} className="stealth-input flex-1 text-[10px]" />
                <button onClick={() => set({ columns: c.columns.map((x) => x.id === col.id ? { ...x, links: x.links.filter((l) => l.id !== link.id) } : x) })} className="text-red-400"><Trash2 size={8} /></button>
              </div>
            ))}
            <button onClick={() => set({ columns: c.columns.map((x) => x.id === col.id ? { ...x, links: [...x.links, { id: makeSiteBlockId(), label: "Link", href: "#" }] } : x) })} className="text-[10px] text-emerald-400">+ Add link</button>
          </div>
        ))}
      </div>
    </div>
  );
}
