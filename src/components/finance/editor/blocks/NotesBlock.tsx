/**
 * @component components/finance/editor/blocks/NotesBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — NotesBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, NotesContent } from "../types";

export function NotesBlock({
  block,
  isEditing,
  onContentChange,
}: BlockRendererProps<"notes">) {
  const c = block.content as NotesContent;

  return (
    <div className="px-10 py-3">
      <div className="border-t border-gray-100 pt-3">
        <div className="font-mono text-[7px] tracking-[2px] text-gray-400 mb-1.5 uppercase">
          Notes
        </div>
        {isEditing ? (
          <textarea
            value={c.text}
            onChange={(e) => onContentChange({ text: e.target.value })}
            placeholder="Payment instructions, warranty info, thank-you message…"
            rows={3}
            className="w-full resize-none bg-transparent text-[9px] text-gray-500 leading-relaxed outline-none placeholder:text-gray-300"
          />
        ) : (
          <div className="text-[9px] text-gray-500 leading-relaxed whitespace-pre-wrap min-h-[20px]">
            {c.text || (
              <span className="italic text-gray-300">Add a note…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
