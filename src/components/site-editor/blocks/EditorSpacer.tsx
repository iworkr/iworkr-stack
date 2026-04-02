/**
 * @component components/site-editor/blocks/EditorSpacer.tsx
 * @status STABLE
 * @description Loom site builder — EditorSpacer
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, SiteSpacerContent } from "../types";

export function EditorSpacer({ block }: SiteBlockRendererProps<"spacer">) {
  const c = block.content as SiteSpacerContent;
  return (
    <div
      className="flex items-center justify-center border border-dashed border-gray-200 text-[10px] text-gray-400"
      style={{ height: c.height }}
    >
      Spacer · {c.height}px
    </div>
  );
}
