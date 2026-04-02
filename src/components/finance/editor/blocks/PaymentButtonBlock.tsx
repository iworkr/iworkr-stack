/**
 * @component components/finance/editor/blocks/PaymentButtonBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — PaymentButtonBlock
 * @lastReview 2026-03-28
 */
"use client";

import { CreditCard } from "lucide-react";
import type { BlockRendererProps, PaymentButtonContent } from "../types";

export function PaymentButtonBlock({
  block,
  isEditing,
  settings,
  onContentChange,
}: BlockRendererProps<"payment_button">) {
  const c = block.content as PaymentButtonContent;
  const accent = settings.brandColor;

  return (
    <div className="px-10 py-4">
      <div
        className="flex items-center justify-between rounded-lg p-4"
        style={{
          backgroundColor: `${accent}12`,
          border: `1px solid ${accent}30`,
        }}
      >
        <div className="text-[10px] text-gray-600 max-w-[65%]">
          Pay this invoice securely online using credit card, debit card, or bank transfer.
        </div>
        <div
          className="flex items-center gap-1.5 rounded-md px-5 py-2 text-white text-[9px] font-bold font-mono tracking-wider"
          style={{ backgroundColor: accent }}
        >
          <CreditCard size={12} />
          {isEditing ? (
            <input
              value={c.label}
              onChange={(e) => onContentChange({ label: e.target.value })}
              className="bg-transparent text-white outline-none w-20 text-center"
            />
          ) : (
            <span>{c.label.toUpperCase()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
