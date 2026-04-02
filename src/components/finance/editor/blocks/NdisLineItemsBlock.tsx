/**
 * @component components/finance/editor/blocks/NdisLineItemsBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — NdisLineItemsBlock
 * @lastReview 2026-03-28
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BlockRendererProps, NdisLineItemsContent, NdisLineItem } from "../types";
import { makeBlockId } from "../types";
import { calcLineTotal } from "../math";

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function NdisLineItemsBlock({
  block,
  isActive,
  isEditing,
  settings,
  onContentChange,
}: BlockRendererProps<"ndis_line_items">) {
  const c = block.content as NdisLineItemsContent;
  const accent = settings.brandColor;
  const cur = settings.currency || "AUD";

  function updateItem(id: string, patch: Partial<NdisLineItem>) {
    onContentChange({
      items: c.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function addRow() {
    onContentChange({
      items: [
        ...c.items,
        {
          id: makeBlockId(),
          supportItemCode: "",
          description: "",
          dateOfSupport: new Date().toISOString().split("T")[0],
          hours: 1,
          rate: 0,
          claimType: "standard" as const,
          priceCap: null,
        },
      ],
    });
  }

  function removeRow(id: string) {
    onContentChange({ items: c.items.filter((it) => it.id !== id) });
  }

  return (
    <div className="px-10 py-3">
      <div className="h-px bg-gray-200 mb-4" />

      {/* Header */}
      <div
        className="grid grid-cols-[100px_1fr_80px_50px_70px_70px] gap-1 pb-1.5 mb-2 text-[7px] font-mono tracking-[1px] text-gray-400 uppercase"
        style={{ borderBottom: `2px solid ${accent}` }}
      >
        <span>Item Code</span>
        <span>Description</span>
        <span>Date</span>
        <span className="text-right">Hrs</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Rows */}
      {c.items.map((item) => {
        const lineTotal = calcLineTotal(item.hours, item.rate);
        const overCap = item.priceCap !== null && item.rate > item.priceCap;
        return (
          <div
            key={item.id}
            className="group grid grid-cols-[100px_1fr_80px_50px_70px_70px_24px] gap-1 items-center py-1.5 border-b border-gray-100"
          >
            {isEditing ? (
              <input
                value={item.supportItemCode}
                onChange={(e) => updateItem(item.id, { supportItemCode: e.target.value })}
                placeholder="XX_XXXXXXXXXX_X"
                maxLength={15}
                className="font-mono text-[8px] text-gray-600 bg-transparent outline-none placeholder:text-gray-300"
              />
            ) : (
              <span className="font-mono text-[8px] text-gray-600">{item.supportItemCode || "—"}</span>
            )}

            {isEditing ? (
              <input
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                placeholder="Support description"
                className="text-[9px] text-gray-700 bg-transparent outline-none placeholder:text-gray-300"
              />
            ) : (
              <span className="text-[9px] text-gray-700">{item.description || "—"}</span>
            )}

            {isEditing ? (
              <input
                type="date"
                value={item.dateOfSupport}
                onChange={(e) => updateItem(item.id, { dateOfSupport: e.target.value })}
                className="font-mono text-[8px] text-gray-600 bg-transparent outline-none"
              />
            ) : (
              <span className="font-mono text-[8px] text-gray-600">{item.dateOfSupport}</span>
            )}

            {isEditing ? (
              <input
                type="number"
                value={item.hours}
                onChange={(e) => updateItem(item.id, { hours: Math.max(0, Number(e.target.value)) })}
                className="text-right font-mono text-[9px] text-gray-600 bg-transparent outline-none w-full"
              />
            ) : (
              <span className="font-mono text-[9px] text-gray-600 text-right">{item.hours}</span>
            )}

            <div className="text-right">
              {isEditing ? (
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateItem(item.id, { rate: Math.max(0, Number(e.target.value)) })}
                  className={`w-full text-right font-mono text-[9px] bg-transparent outline-none ${overCap ? "text-red-500" : "text-gray-600"}`}
                />
              ) : (
                <span className={`font-mono text-[9px] ${overCap ? "text-red-500" : "text-gray-600"}`}>
                  {fmtCurrency(item.rate, cur)}
                </span>
              )}
            </div>

            <span className="font-mono text-[9px] font-bold text-gray-800 text-right">
              {fmtCurrency(lineTotal, cur)}
            </span>

            {isActive && (
              <button
                onClick={() => removeRow(item.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        );
      })}

      {isActive && (
        <button
          onClick={addRow}
          className="mt-2 flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus size={10} />
          Add NDIS support item
        </button>
      )}
    </div>
  );
}
