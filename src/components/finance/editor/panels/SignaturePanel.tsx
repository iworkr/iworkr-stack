/**
 * @component components/finance/editor/panels/SignaturePanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — SignaturePanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { SignatureContent } from "../types";

export function SignaturePanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "signature") return null;
  const c = block.content as SignatureContent;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Signature Field
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Label</label>
        <input
          value={c.label}
          onChange={(e) => update(blockId, { label: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">Required</span>
        <button
          onClick={() => update(blockId, { required: !c.required })}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.required ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${c.required ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>

      <p className="text-[10px] text-zinc-600">
        On the digital invoice, the client can draw their signature. The signed document is then locked and a final PDF is generated.
      </p>
    </div>
  );
}
