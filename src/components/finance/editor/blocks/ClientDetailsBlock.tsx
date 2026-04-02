/**
 * @component components/finance/editor/blocks/ClientDetailsBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — ClientDetailsBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, ClientDetailsContent } from "../types";

export function ClientDetailsBlock({
  block,
  isEditing,
  onContentChange,
}: BlockRendererProps<"client_details">) {
  const c = block.content as ClientDetailsContent;

  return (
    <div className="px-10 py-3">
      <div className="font-mono text-[7px] tracking-[2px] text-gray-400 mb-1.5 uppercase">
        Bill To
      </div>
      {c.clientName ? (
        <>
          <div
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => {
              const val = e.currentTarget.textContent?.trim() || "";
              if (val !== c.clientName) onContentChange({ clientName: val });
            }}
            className="text-[13px] font-bold text-gray-900 outline-none focus:ring-1 focus:ring-blue-300 rounded px-0.5"
          >
            {c.clientName}
          </div>
          {c.clientAddress && (
            <div className="text-[9px] text-gray-500 leading-relaxed mt-0.5">
              {c.clientAddress}
            </div>
          )}
          {c.clientEmail && (
            <div className="text-[9px] text-gray-500 leading-relaxed">
              {c.clientEmail}
            </div>
          )}
          {c.ndisNumber && (
            <div className="text-[9px] text-gray-500 leading-relaxed font-mono">
              NDIS: {c.ndisNumber}
            </div>
          )}
        </>
      ) : (
        <div className="text-[11px] text-gray-300 italic py-2 border border-dashed border-gray-200 rounded px-2">
          Click to select a client…
        </div>
      )}
    </div>
  );
}
