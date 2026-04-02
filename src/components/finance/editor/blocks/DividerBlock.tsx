/**
 * @component components/finance/editor/blocks/DividerBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — DividerBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, DividerContent } from "../types";

export function DividerBlock({
  block,
}: BlockRendererProps<"divider">) {
  const c = block.content as DividerContent;

  return (
    <div className="px-10 py-2">
      <div
        style={{
          height: c.thickness,
          backgroundColor: c.color || "#e5e5e5",
        }}
      />
    </div>
  );
}
