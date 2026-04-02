/**
 * @component components/site-editor/blocks/EditorEmbedDaedalusForm.tsx
 * @status STABLE
 * @description Loom site builder — EditorEmbedDaedalusForm
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, EmbedDaedalusFormContent } from "../types";

export function EditorEmbedDaedalusForm({ block, isEditing, onContentChange }: SiteBlockRendererProps<"embed_daedalus_form">) {
  const c = block.content as EmbedDaedalusFormContent;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-md">
        {c.showTitle && (
          <h2
            className="text-xl font-bold text-gray-900 text-center mb-6"
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
          >
            {c.heading || "Form"}
          </h2>
        )}
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          {c.templateId ? (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Daedalus Form</span> — Template: <code className="text-[10px]">{c.templateId.slice(0, 8)}...</code>
            </div>
          ) : (
            <div className="text-xs text-gray-400">Select a form template in the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
