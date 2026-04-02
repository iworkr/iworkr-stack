/**
 * @component components/site-editor/panels/TeamPanel.tsx
 * @status STABLE
 * @description Loom site builder — TeamPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { makeSiteBlockId } from "../types";
import type { TeamSectionContent } from "../types";
import { Plus, Trash2 } from "lucide-react";

export function TeamPanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as TeamSectionContent;
  const set = (patch: Partial<TeamSectionContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-zinc-400">Members ({c.members.length})</span>
          <button onClick={() => set({ members: [...c.members, { id: makeSiteBlockId(), name: "Name", role: "Role", photoUrl: "", bio: "" }] })} className="text-emerald-400"><Plus size={12} /></button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {c.members.map((m) => (
            <div key={m.id} className="rounded-lg border border-[var(--border-base)] bg-[var(--surface-2)] p-2 space-y-1">
              <div className="flex items-center gap-2">
                <input type="text" value={m.name} onChange={(e) => set({ members: c.members.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x) })} className="stealth-input flex-1" placeholder="Name" />
                <button onClick={() => set({ members: c.members.filter((x) => x.id !== m.id) })} className="text-red-400"><Trash2 size={10} /></button>
              </div>
              <input type="text" value={m.role} onChange={(e) => set({ members: c.members.map((x) => x.id === m.id ? { ...x, role: e.target.value } : x) })} className="stealth-input w-full text-[10px]" placeholder="Role" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
