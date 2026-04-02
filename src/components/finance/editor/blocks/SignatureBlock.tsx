/**
 * @component components/finance/editor/blocks/SignatureBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — SignatureBlock
 * @lastReview 2026-03-28
 */
"use client";

import { PenLine } from "lucide-react";
import type { BlockRendererProps, SignatureContent } from "../types";

export function SignatureBlock({
  block,
  isEditing,
  onContentChange,
}: BlockRendererProps<"signature">) {
  const c = block.content as SignatureContent;

  return (
    <div className="px-10 py-4">
      <div className="font-mono text-[7px] tracking-[2px] text-gray-400 mb-2 uppercase">
        {isEditing ? (
          <input
            value={c.label}
            onChange={(e) => onContentChange({ label: e.target.value })}
            className="bg-transparent outline-none font-mono text-[7px] tracking-[2px] text-gray-400 uppercase"
          />
        ) : (
          c.label
        )}
      </div>
      <div className="h-20 rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center">
        {c.signatureDataUrl ? (
          <img
            src={c.signatureDataUrl}
            alt="Signature"
            className="max-h-16 object-contain"
          />
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <PenLine size={12} />
            <span>Sign here</span>
          </div>
        )}
      </div>
      {c.required && (
        <div className="mt-1 text-[7px] text-red-400">* Signature required</div>
      )}
    </div>
  );
}
