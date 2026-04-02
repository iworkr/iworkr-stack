/**
 * @component components/site-editor/blocks/EditorAboutSection.tsx
 * @status STABLE
 * @description Loom site builder — EditorAboutSection
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, AboutSectionContent } from "../types";

export function EditorAboutSection({ block, isEditing, globalStyles, onContentChange }: SiteBlockRendererProps<"about_section">) {
  const c = block.content as AboutSectionContent;

  return (
    <section className="py-12 px-6">
      <div className={`mx-auto max-w-5xl flex flex-col gap-8 ${c.imagePosition === "left" ? "md:flex-row" : "md:flex-row-reverse"} items-center`}>
        <div className="w-full md:w-1/2">
          {c.imageUrl ? (
            <img src={c.imageUrl} alt={c.heading} className="w-full rounded-xl object-cover" />
          ) : (
            <div className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">
              No image set
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2 space-y-4">
          <h2
            className="text-2xl font-bold text-gray-900"
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
          >
            {c.heading || "About Us"}
          </h2>
          <p
            className="text-sm leading-relaxed text-gray-600 whitespace-pre-line"
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => onContentChange({ body: e.currentTarget.textContent || "" })}
          >
            {c.body || "Tell your story here..."}
          </p>
          {c.showStats && c.stats.length > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              {c.stats.map((s) => (
                <div key={s.id}>
                  <div className="text-xl font-bold" style={{ color: globalStyles.primaryColor }}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
