/**
 * @component components/site-editor/panels/EmbedDaedalusFormPanel.tsx
 * @status STABLE
 * @description Loom site builder — EmbedDaedalusFormPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { EmbedDaedalusFormContent } from "../types";

export function EmbedDaedalusFormPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as EmbedDaedalusFormContent;
  const set = (patch: Partial<EmbedDaedalusFormContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="text-[11px] text-zinc-400 block mb-1">Form Template ID</label>
        <input type="text" value={c.templateId || ""} onChange={(e) => set({ templateId: e.target.value || null })} className="stealth-input w-full font-mono text-[10px]" placeholder="Paste template UUID" />
        <p className="text-[9px] text-zinc-600 mt-1">From Daedalus-Form builder. Find the ID in Settings → Forms.</p>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.showTitle} onChange={(e) => set({ showTitle: e.target.checked })} className="accent-emerald-500" />
        Show Title
      </label>
      {c.showTitle && (
        <div><label className="text-[11px] text-zinc-400 block mb-1">Custom Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" placeholder="Override form title" /></div>
      )}
    </div>
  );
}
