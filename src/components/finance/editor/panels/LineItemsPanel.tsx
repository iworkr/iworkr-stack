/**
 * @component components/finance/editor/panels/LineItemsPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — LineItemsPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { LineItemsContent } from "../types";

export function LineItemsPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "line_items") return null;
  const c = block.content as LineItemsContent;

  function toggle(field: keyof Pick<LineItemsContent, "showQty" | "showDiscount" | "showTax">) {
    update(blockId, { [field]: !c[field] } as Partial<LineItemsContent>);
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Table Settings
      </h3>

      <div className="space-y-3">
        {(["showQty", "showDiscount", "showTax"] as const).map((field) => (
          <div key={field} className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              {field === "showQty" ? "Show Quantity" : field === "showDiscount" ? "Show Discount Column" : "Show Tax Column"}
            </span>
            <button
              onClick={() => toggle(field)}
              className={`relative h-5 w-9 rounded-full transition-colors ${c[field] ? "bg-emerald-500" : "bg-zinc-700"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${c[field] ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-[var(--border-base)]">
        <div className="text-[10px] text-zinc-500">
          {c.items.length} line item{c.items.length !== 1 ? "s" : ""}
        </div>
        <p className="mt-1 text-[10px] text-zinc-600">
          Double-click the table on the canvas to edit items inline.
        </p>
      </div>
    </div>
  );
}
