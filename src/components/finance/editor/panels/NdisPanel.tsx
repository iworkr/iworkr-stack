/**
 * @component components/finance/editor/panels/NdisPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — NdisPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { NdisLineItemsContent } from "../types";

export function NdisPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "ndis_line_items") return null;
  const c = block.content as NdisLineItemsContent;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        NDIS Line Items
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Participant NDIS Number</label>
        <input
          value={c.participantNdisNumber}
          onChange={(e) => update(blockId, { participantNdisNumber: e.target.value })}
          placeholder="e.g. 4312345678"
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Plan Managed By</label>
        <input
          value={c.planManagedBy}
          onChange={(e) => update(blockId, { planManagedBy: e.target.value })}
          placeholder="Plan manager name or NDIA"
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div className="pt-2 border-t border-[var(--border-base)]">
        <div className="text-[10px] text-zinc-500">
          {c.items.length} support item{c.items.length !== 1 ? "s" : ""}
        </div>
        <p className="mt-1 text-[10px] text-zinc-600">
          Double-click the table on the canvas to add and edit NDIS support items. Rates exceeding PRODA price caps will be highlighted in red.
        </p>
      </div>
    </div>
  );
}
