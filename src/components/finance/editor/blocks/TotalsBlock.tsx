/**
 * @component components/finance/editor/blocks/TotalsBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — TotalsBlock
 * @lastReview 2026-03-28
 */
"use client";

import { useMemo } from "react";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { calcTotals } from "../math";
import type { BlockRendererProps, TotalsContent } from "../types";

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function TotalsBlock({
  block,
  settings,
}: BlockRendererProps<"totals">) {
  const blocks = useInvoiceEditorStore((s) => s.blocks);
  const globalSettings = useInvoiceEditorStore((s) => s.globalSettings);
  const totals = useMemo(() => calcTotals(blocks, globalSettings), [blocks, globalSettings]);
  const accent = settings.brandColor;
  const cur = settings.currency || "AUD";
  const c = block.content as TotalsContent;

  if (!c.showBreakdown) {
    return (
      <div className="px-10 py-3">
        <div className="ml-auto w-[220px]">
          <div
            className="flex justify-between py-2"
            style={{ borderTop: `2px solid ${accent}` }}
          >
            <span className="text-[13px] font-bold text-gray-900">Total</span>
            <span className="font-mono text-[14px] font-bold" style={{ color: accent }}>
              {fmtCurrency(totals.total, cur)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 py-3">
      <div className="ml-auto w-[220px]">
        <div className="flex justify-between py-1">
          <span className="text-[9px] text-gray-500">Subtotal</span>
          <span className="font-mono text-[10px] text-gray-700">{fmtCurrency(totals.subtotal, cur)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-[9px] text-gray-500">
              Discount
              {settings.discountType === "percent" ? ` (${settings.discountValue}%)` : ""}
            </span>
            <span className="font-mono text-[10px] text-red-500">-{fmtCurrency(totals.discount, cur)}</span>
          </div>
        )}
        {!settings.taxInclusive && (
          <div className="flex justify-between py-1">
            <span className="text-[9px] text-gray-500">GST ({settings.taxRate}%)</span>
            <span className="font-mono text-[10px] text-gray-700">{fmtCurrency(totals.tax, cur)}</span>
          </div>
        )}
        {settings.taxInclusive && totals.tax > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-[9px] text-gray-400 italic">Incl. GST ({settings.taxRate}%)</span>
            <span className="font-mono text-[10px] text-gray-400">{fmtCurrency(totals.tax, cur)}</span>
          </div>
        )}
        <div
          className="flex justify-between py-2 mt-1"
          style={{ borderTop: `2px solid ${accent}` }}
        >
          <span className="text-[13px] font-bold text-gray-900">Total</span>
          <span className="font-mono text-[14px] font-bold" style={{ color: accent }}>
            {fmtCurrency(totals.total, cur)}
          </span>
        </div>
      </div>
    </div>
  );
}
