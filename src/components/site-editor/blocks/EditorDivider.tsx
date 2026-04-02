/**
 * @component components/site-editor/blocks/EditorDivider.tsx
 * @status STABLE
 * @description Loom site builder — EditorDivider
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, SiteDividerContent } from "../types";

export function EditorDivider({ block }: SiteBlockRendererProps<"divider">) {
  const c = block.content as SiteDividerContent;
  const maxW = c.maxWidth === "narrow" ? "max-w-sm" : c.maxWidth === "medium" ? "max-w-2xl" : "max-w-full";

  return (
    <div className={`mx-auto ${maxW} px-6 py-2`}>
      <hr style={{ borderTopWidth: c.thickness, borderTopColor: c.color || "#e5e7eb" }} className="border-0" />
    </div>
  );
}
