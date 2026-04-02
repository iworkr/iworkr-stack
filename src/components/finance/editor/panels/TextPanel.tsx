/**
 * @component components/finance/editor/panels/TextPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — TextPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { AVAILABLE_VARIABLES } from "../variables";
import type { TextContent } from "../types";

export function TextPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || (block.type !== "text" && block.type !== "notes")) return null;
  const c = block.content as TextContent;

  function insertVariable(token: string) {
    update(blockId, { text: (c.text || "") + token });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Text Settings
      </h3>

      {"fontSize" in c && (
        <div>
          <label className="mb-1.5 block text-[11px] text-zinc-400">Font Size (px)</label>
          <input
            type="number"
            value={c.fontSize}
            onChange={(e) => update(blockId, { fontSize: Math.max(6, Number(e.target.value)) })}
            className="w-20 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Dynamic Variables</label>
        <p className="mb-2 text-[10px] text-zinc-600">
          Click to insert a variable token into the text.
        </p>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {AVAILABLE_VARIABLES.map((v) => (
            <button
              key={v.token}
              onClick={() => insertVariable(v.token)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-zinc-400">{v.label}</span>
              <span className="font-mono text-[9px] text-zinc-600">{v.token}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
