/**
 * @component components/site-editor/panels/LeadCapturePanel.tsx
 * @status STABLE
 * @description Loom site builder — LeadCapturePanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import type { LeadCaptureContent } from "../types";

export function LeadCapturePanel({ blockId }: { blockId: string }) {
  const block = useSiteEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useSiteEditorStore((s) => s.updateBlockContent);
  if (!block) return null;
  const c = block.content as LeadCaptureContent;
  const set = (patch: Partial<LeadCaptureContent>) => update(blockId, patch);

  return (
    <div className="p-4 space-y-4">
      <div><label className="text-[11px] text-zinc-400 block mb-1">Heading</label><input type="text" value={c.heading} onChange={(e) => set({ heading: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Description</label><textarea value={c.description} onChange={(e) => set({ description: e.target.value })} rows={2} className="stealth-input w-full resize-none" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Submit Button</label><input type="text" value={c.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} className="stealth-input w-full" /></div>
      <div><label className="text-[11px] text-zinc-400 block mb-1">Success Message</label><input type="text" value={c.successMessage} onChange={(e) => set({ successMessage: e.target.value })} className="stealth-input w-full" /></div>
      <div className="space-y-2">
        <span className="text-[11px] text-zinc-400 block">Fields</span>
        {(["name", "email", "phone", "message", "serviceType"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-[11px] text-zinc-400">
            <input type="checkbox" checked={c.fields[key]} onChange={(e) => set({ fields: { ...c.fields, [key]: e.target.checked } })} className="accent-emerald-500" />
            {key === "serviceType" ? "Service Type" : key.charAt(0).toUpperCase() + key.slice(1)}
          </label>
        ))}
      </div>
      {c.fields.serviceType && (
        <div>
          <label className="text-[11px] text-zinc-400 block mb-1">Service Options (one per line)</label>
          <textarea
            value={c.serviceOptions.join("\n")}
            onChange={(e) => set({ serviceOptions: e.target.value.split("\n").filter(Boolean) })}
            rows={3}
            className="stealth-input w-full resize-none font-mono text-[10px]"
            placeholder="Plumbing\nElectrical\nHVAC"
          />
        </div>
      )}
    </div>
  );
}
