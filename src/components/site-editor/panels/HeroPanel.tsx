/**
 * @component components/site-editor/panels/HeroPanel.tsx
 * @status STABLE
 * @description Loom site builder — HeroPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { HeroContent } from "../types";

export function HeroPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as HeroContent;
  const set = (patch: Partial<HeroContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Headline</label>
        <input type="text" value={c.headline} onChange={(e) => set({ headline: e.target.value })} className="stealth-input w-full" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Subheadline</label>
        <textarea value={c.subheadline} onChange={(e) => set({ subheadline: e.target.value })} rows={2} className="stealth-input w-full resize-none" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Background Type</label>
        <select value={c.backgroundType} onChange={(e) => set({ backgroundType: e.target.value as HeroContent["backgroundType"] })} className="stealth-input w-full">
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>
      {c.backgroundType === "image" && (
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Image URL</label>
          <input type="url" value={c.backgroundUrl} onChange={(e) => set({ backgroundUrl: e.target.value })} className="stealth-input w-full" />
        </div>
      )}
      {c.backgroundType === "gradient" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[11px] text-zinc-400 block mb-1">From</label>
            <input type="color" value={c.gradientFrom} onChange={(e) => set({ gradientFrom: e.target.value })} className="h-8 w-full cursor-pointer rounded" />
          </div>
          <div className="flex-1">
            <label className="text-[11px] text-zinc-400 block mb-1">To</label>
            <input type="color" value={c.gradientTo} onChange={(e) => set({ gradientTo: e.target.value })} className="h-8 w-full cursor-pointer rounded" />
          </div>
        </div>
      )}
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Alignment</label>
        <select value={c.alignment} onChange={(e) => set({ alignment: e.target.value as HeroContent["alignment"] })} className="stealth-input w-full">
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">CTA Label</label>
        <input type="text" value={c.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} className="stealth-input w-full" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">CTA URL</label>
        <input type="text" value={c.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} className="stealth-input w-full" />
      </div>
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Secondary CTA</label>
        <input type="text" value={c.secondaryCtaLabel} onChange={(e) => set({ secondaryCtaLabel: e.target.value })} className="stealth-input w-full" placeholder="Leave empty to hide" />
      </div>
    </div>
  );
}
