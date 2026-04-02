/**
 * @component components/finance/editor/blocks/SpacerBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — SpacerBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, SpacerContent } from "../types";

export function SpacerBlock({
  block,
  isActive,
}: BlockRendererProps<"spacer">) {
  const c = block.content as SpacerContent;

  return (
    <div
      className="relative"
      style={{ height: c.height }}
    >
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[8px] text-gray-300 bg-white/80 px-2 rounded">
            {c.height}px
          </div>
        </div>
      )}
    </div>
  );
}
