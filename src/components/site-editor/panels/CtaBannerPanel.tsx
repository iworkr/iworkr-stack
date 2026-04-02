/**
 * @component components/site-editor/panels/CtaBannerPanel.tsx
 * @status STABLE
 * @description Loom site builder — CtaBannerPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { CtaBannerContent } from "../types";

export function CtaBannerPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as CtaBannerContent;
  const set = (patch: Partial<CtaBannerContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Headline</label><input type="text" value={c.headline} onChange={(e) => set({ headline: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Subheadline</label><input type="text" value={c.subheadline} onChange={(e) => set({ subheadline: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">CTA Label</label><input type="text" value={c.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">CTA URL</label><input type="text" value={c.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">CTA Style</label>
        <select value={c.ctaStyle} onChange={(e) => set({ ctaStyle: e.target.value as "solid" | "outline" })} className="stealth-input w-full">
          <option value="solid">Solid</option><option value="outline">Outline</option>
        </select>
      </div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Background</label><input type="color" value={c.backgroundColor || "#10B981"} onChange={(e) => set({ backgroundColor: e.target.value })} className="h-8 w-full cursor-pointer rounded" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Text Color</label><input type="color" value={c.textColor || "#ffffff"} onChange={(e) => set({ textColor: e.target.value })} className="h-8 w-full cursor-pointer rounded" /></div>
    </div>
  );
}
