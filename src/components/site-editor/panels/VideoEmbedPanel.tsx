/**
 * @component components/site-editor/panels/VideoEmbedPanel.tsx
 * @status STABLE
 * @description Loom site builder — VideoEmbedPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { VideoEmbedContent } from "../types";

export function VideoEmbedPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as VideoEmbedContent;
  const set = (patch: Partial<VideoEmbedContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Video URL</label><input type="url" value={c.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} className="stealth-input w-full" placeholder="YouTube or Vimeo URL" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Aspect Ratio</label>
        <select value={c.aspectRatio} onChange={(e) => set({ aspectRatio: e.target.value as "16:9" | "4:3" | "1:1" })} className="stealth-input w-full">
          <option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option>
        </select>
      </div>
    </div>
  );
}
