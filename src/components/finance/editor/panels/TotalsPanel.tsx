/**
 * @component components/finance/editor/panels/TotalsPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — TotalsPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useMemo } from "react";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { calcTotals } from "../math";
import type { TotalsContent } from "../types";

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function TotalsPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  const blocks = useInvoiceEditorStore((s) => s.blocks);
  const globalSettings = useInvoiceEditorStore((s) => s.globalSettings);
  const totals = useMemo(() => calcTotals(blocks, globalSettings), [blocks, globalSettings]);
  if (!block || block.type !== "totals") return null;
  const c = block.content as TotalsContent;
  const cur = globalSettings.currency || "AUD";

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Totals
      </h3>

      <div className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3 space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-zinc-500">Subtotal</span>
          <span className="font-mono text-zinc-300">{fmtCurrency(totals.subtotal, cur)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500">Discount</span>
            <span className="font-mono text-red-400">-{fmtCurrency(totals.discount, cur)}</span>
          </div>
        )}
        <div className="flex justify-between text-[11px]">
          <span className="text-zinc-500">
            {globalSettings.taxInclusive ? "Incl. Tax" : "Tax"} ({globalSettings.taxRate}%)
          </span>
          <span className="font-mono text-zinc-300">{fmtCurrency(totals.tax, cur)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-[var(--border-base)] pt-2">
          <span className="text-zinc-200">Total</span>
          <span className="font-mono text-emerald-400">{fmtCurrency(totals.total, cur)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">Show Breakdown</span>
        <button
          onClick={() => update(blockId, { showBreakdown: !c.showBreakdown })}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.showBreakdown ? "bg-emerald-500" : "bg-zinc-700"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${c.showBreakdown ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
