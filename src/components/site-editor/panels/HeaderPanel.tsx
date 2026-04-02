/**
 * @component components/site-editor/panels/HeaderPanel.tsx
 * @status STABLE
 * @description Loom site builder — HeaderPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { SiteHeaderContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function HeaderPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as SiteHeaderContent;
  const set = (patch: Partial<SiteHeaderContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Logo URL</label><input type="url" value={c.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} className="stealth-input w-full" /></div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.sticky} onChange={(e) => set({ sticky: e.target.checked })} className="accent-emerald-500" />Sticky Header
      </label>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.showPhone} onChange={(e) => set({ showPhone: e.target.checked })} className="accent-emerald-500" />Show Phone
      </label>
      {c.showPhone && <div><label className="text-[11px] text-zinc-400 block mb-1">Phone</label><input type="tel" value={c.phone} onChange={(e) => set({ phone: e.target.value })} className="stealth-input w-full" /></div>}
      <div><label className="text-[11px] text-zinc-400 block mb-1">CTA Button</label><input type="text" value={c.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">CTA URL</label><input type="text" value={c.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} className="stealth-input w-full" /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Nav Links</span>
          <button onClick={() => set({ navLinks: [...c.navLinks, { id: makeSiteBlockId(), label: "Link", href: "#" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        {c.navLinks.map((link) => (
          <div key={link.id} className="flex gap-2 mb-1.5">
            <input type="text" value={link.label} onChange={(e) => set({ navLinks: c.navLinks.map((x) => x.id === link.id ? { ...x, label: e.target.value } : x) })} className="stealth-input flex-1" />
            <input type="text" value={link.href} onChange={(e) => set({ navLinks: c.navLinks.map((x) => x.id === link.id ? { ...x, href: e.target.value } : x) })} className="stealth-input flex-1" />
            <button onClick={() => set({ navLinks: c.navLinks.filter((x) => x.id !== link.id) })} className="text-red-400"><Trash2 size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
