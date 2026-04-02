/**
 * @component components/finance/editor/blocks/TextBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — TextBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, TextContent } from "../types";

export function TextBlock({
  block,
  isEditing,
  onContentChange,
}: BlockRendererProps<"text">) {
  const c = block.content as TextContent;

  return (
    <div className="px-10 py-2">
      {isEditing ? (
        <textarea
          value={c.text}
          onChange={(e) => onContentChange({ text: e.target.value })}
          placeholder="Type text here… Use {client.first_name} for dynamic variables"
          rows={2}
          className="w-full resize-none bg-transparent outline-none text-gray-600 leading-relaxed placeholder:text-gray-300"
          style={{ fontSize: c.fontSize }}
        />
      ) : (
        <div
          className="text-gray-600 leading-relaxed whitespace-pre-wrap min-h-[16px]"
          style={{ fontSize: c.fontSize }}
        >
          {c.text || (
            <span className="italic text-gray-300">Add text…</span>
          )}
        </div>
      )}
    </div>
  );
}
