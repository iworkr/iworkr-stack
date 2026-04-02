/**
 * @component components/finance/editor/panels/SpacerPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — SpacerPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { SpacerContent } from "../types";

const PRESETS = [8, 16, 24, 32, 48, 64];

export function SpacerPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "spacer") return null;
  const c = block.content as SpacerContent;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Spacer Settings
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Height (px)</label>
        <input
          type="number"
          value={c.height}
          min={4}
          max={200}
          onChange={(e) => update(blockId, { height: Math.max(4, Math.min(200, Number(e.target.value))) })}
          className="w-24 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((h) => (
            <button
              key={h}
              onClick={() => update(blockId, { height: h })}
              className={`rounded-md border px-3 py-1 text-[10px] font-mono transition-colors ${
                c.height === h
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-[var(--border-base)] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {h}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <input
          type="range"
          min={4}
          max={200}
          value={c.height}
          onChange={(e) => update(blockId, { height: Number(e.target.value) })}
          className="w-full accent-emerald-500"
        />
      </div>
    </div>
  );
}
