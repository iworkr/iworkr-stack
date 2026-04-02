/**
 * @component components/site-editor/blocks/EditorFeatureGrid.tsx
 * @status STABLE
 * @description Loom site builder — EditorFeatureGrid
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, FeatureGridContent } from "../types";

export function EditorFeatureGrid({ block, isEditing, onContentChange }: SiteBlockRendererProps<"feature_grid">) {
  const c = block.content as FeatureGridContent;
  const cols = c.columns === 4 ? "grid-cols-4" : c.columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-2"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Features"}
        </h2>
        <p
          className="text-sm text-gray-500 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ subheading: e.currentTarget.textContent || "" })}
        >
          {c.subheading || "Why choose us"}
        </p>
        <div className={`grid gap-4 ${cols}`}>
          {c.features.map((f) => (
            <div key={f.id} className="rounded-lg bg-white p-4 border border-gray-100 shadow-sm">
              <div className="mb-2 text-xl">{f.icon || "✦"}</div>
              <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{f.description}</p>
            </div>
          ))}
          {c.features.length === 0 && (
            <div className="col-span-full text-center text-xs text-gray-400 py-8">Add features via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
