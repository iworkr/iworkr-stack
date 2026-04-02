/**
 * @component components/site-editor/blocks/EditorServicesGrid.tsx
 * @status STABLE
 * @description Loom site builder — EditorServicesGrid
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, ServicesGridContent } from "../types";

export function EditorServicesGrid({ block, isEditing, onContentChange }: SiteBlockRendererProps<"services_grid">) {
  const c = block.content as ServicesGridContent;
  const cols = c.columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Our Services"}
        </h2>
        <div className={`grid gap-4 ${cols}`}>
          {c.services.map((s) => (
            <div key={s.id} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
              {c.showImages && s.imageUrl && (
                <div className="aspect-video bg-gray-100">
                  <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="text-lg mb-1">{s.icon || "🔧"}</div>
                <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              </div>
            </div>
          ))}
          {c.services.length === 0 && (
            <div className="col-span-full text-center text-xs text-gray-400 py-8">Add services via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
