/**
 * @component components/site-editor/blocks/EditorTextSection.tsx
 * @status STABLE
 * @description Loom site builder — EditorTextSection
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, TextSectionContent } from "../types";

export function EditorTextSection({ block, isEditing, onContentChange }: SiteBlockRendererProps<"text_section">) {
  const c = block.content as TextSectionContent;
  const align = c.alignment === "left" ? "text-left" : c.alignment === "right" ? "text-right" : "text-center";
  const maxW = c.maxWidth === "narrow" ? "max-w-xl" : c.maxWidth === "medium" ? "max-w-3xl" : "max-w-5xl";

  return (
    <section className="py-10 px-6">
      <div className={`mx-auto ${maxW} ${align}`}>
        <h2
          className="text-2xl font-bold text-gray-900 mb-3"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Section Heading"}
        </h2>
        <div
          className="text-sm leading-relaxed text-gray-600 whitespace-pre-line"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ body: e.currentTarget.textContent || "" })}
        >
          {c.body || "Add your content here..."}
        </div>
      </div>
    </section>
  );
}
