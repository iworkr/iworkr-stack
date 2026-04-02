/**
 * @component components/finance/editor/panels/HeaderPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — HeaderPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { HeaderContent } from "../types";

export function HeaderPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "header") return null;
  const c = block.content as HeaderContent;

  function toggle(field: keyof HeaderContent) {
    update(blockId, { [field]: !c[field] } as Partial<HeaderContent>);
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Header Settings
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Title Text</label>
        <input
          value={c.title}
          onChange={(e) => update(blockId, { title: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">Show Logo</span>
        <button
          onClick={() => toggle("showLogo")}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.showLogo ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${c.showLogo ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">Show Org Details</span>
        <button
          onClick={() => toggle("showOrgDetails")}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.showOrgDetails ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${c.showOrgDetails ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
