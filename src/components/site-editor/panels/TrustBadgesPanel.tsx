/**
 * @component components/site-editor/panels/TrustBadgesPanel.tsx
 * @status STABLE
 * @description Loom site builder — TrustBadgesPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { TrustBadgesContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function TrustBadgesPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as TrustBadgesContent;
  const set = (patch: Partial<TrustBadgesContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
        <input type="checkbox" checked={c.grayscale} onChange={(e) => set({ grayscale: e.target.checked })} className="accent-emerald-500" />
        Grayscale logos
      </label>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Badges ({c.badges.length})</span>
          <button onClick={() => set({ badges: [...c.badges, { id: makeSiteBlockId(), imageUrl: "", label: "Badge", url: "" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        {c.badges.map((b) => (
          <div key={b.id} className="flex gap-2 mb-1.5">
            <input type="text" value={b.label} onChange={(e) => set({ badges: c.badges.map((x) => x.id === b.id ? { ...x, label: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Label" />
            <button onClick={() => set({ badges: c.badges.filter((x) => x.id !== b.id) })} className="text-red-400"><Trash2 size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
