/**
 * @component components/finance/editor/blocks/LineItemsBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — LineItemsBlock
 * @lastReview 2026-03-28
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BlockRendererProps, LineItemsContent, EditorLineItem } from "../types";
import { makeBlockId } from "../types";
import { calcLineTotal } from "../math";

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export function LineItemsBlock({
  block,
  isActive,
  isEditing,
  settings,
  onContentChange,
}: BlockRendererProps<"line_items">) {
  const c = block.content as LineItemsContent;
  const accent = settings.brandColor;
  const cur = settings.currency || "AUD";

  function updateItem(id: string, patch: Partial<EditorLineItem>) {
    onContentChange({
      items: c.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function addRow() {
    onContentChange({
      items: [
        ...c.items,
        { id: makeBlockId(), description: "", quantity: 1, unitPrice: 0, taxOverride: null },
      ],
    });
  }

  function removeRow(id: string) {
    onContentChange({ items: c.items.filter((it) => it.id !== id) });
  }

  return (
    <div className="px-10 py-3">
      <div className="h-px bg-gray-200 mb-4" />

      {/* Table header */}
      <div
        className="flex pb-1.5 mb-2"
        style={{ borderBottom: `2px solid ${accent}` }}
      >
        <div className="flex-1 pr-2 font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Description</div>
        {c.showQty && <div className="w-[50px] text-right font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Qty</div>}
        <div className="w-[80px] text-right font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Unit Price</div>
        {c.showDiscount && <div className="w-[65px] text-right font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Disc.</div>}
        {c.showTax && <div className="w-[55px] text-right font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Tax %</div>}
        <div className="w-[80px] text-right font-mono text-[7px] tracking-[1.5px] text-gray-400 uppercase">Amount</div>
        {isActive && <div className="w-[24px]" />}
      </div>

      {/* Rows */}
      {c.items.map((item) => {
        const lineTotal = calcLineTotal(item.quantity, item.unitPrice);
        return (
          <div
            key={item.id}
            className="group flex items-center py-1.5 border-b border-gray-100"
          >
            <div className="flex-1 pr-2">
              {isEditing ? (
                <input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Item description"
                  className="w-full bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-300"
                />
              ) : (
                <span className="text-[10px] text-gray-700">{item.description || "—"}</span>
              )}
            </div>
            {c.showQty && (
              <div className="w-[50px] text-right">
                {isEditing ? (
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Math.max(0, Number(e.target.value)) })}
                    className="w-full bg-transparent text-right font-mono text-[9px] text-gray-600 outline-none"
                  />
                ) : (
                  <span className="font-mono text-[9px] text-gray-600">{item.quantity}</span>
                )}
              </div>
            )}
            <div className="w-[80px] text-right">
              {isEditing ? (
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-transparent text-right font-mono text-[9px] text-gray-600 outline-none"
                />
              ) : (
                <span className="font-mono text-[9px] text-gray-600">{fmtCurrency(item.unitPrice, cur)}</span>
              )}
            </div>
            {c.showDiscount && (
              <div className="w-[65px] text-right font-mono text-[9px] text-gray-400">
                —
              </div>
            )}
            {c.showTax && (
              <div className="w-[55px] text-right">
                {isEditing ? (
                  <input
                    type="number"
                    value={item.taxOverride != null ? Math.round(item.taxOverride * 100) : settings.taxRate}
                    onChange={(e) => updateItem(item.id, { taxOverride: Math.max(0, Number(e.target.value)) / 100 })}
                    className="w-full bg-transparent text-right font-mono text-[9px] text-gray-600 outline-none"
                  />
                ) : (
                  <span className="font-mono text-[9px] text-gray-500">
                    {item.taxOverride != null ? `${Math.round(item.taxOverride * 100)}%` : `${settings.taxRate}%`}
                  </span>
                )}
              </div>
            )}
            <div className="w-[80px] text-right font-mono text-[9px] font-bold text-gray-800">
              {fmtCurrency(lineTotal, cur)}
            </div>
            {isActive && (
              <div className="w-[24px] flex justify-center">
                <button
                  onClick={() => removeRow(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add row */}
      {isActive && (
        <button
          onClick={addRow}
          className="mt-2 flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus size={10} />
          Add line item
        </button>
      )}
    </div>
  );
}
