/**
 * @component components/site-editor/blocks/EditorFaqAccordion.tsx
 * @status STABLE
 * @description Loom site builder — EditorFaqAccordion
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, FaqAccordionContent } from "../types";

export function EditorFaqAccordion({ block, isEditing, onContentChange }: SiteBlockRendererProps<"faq_accordion">) {
  const c = block.content as FaqAccordionContent;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-2xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Frequently Asked Questions"}
        </h2>
        <div className="space-y-2">
          {c.faqs.map((faq) => (
            <div key={faq.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">{faq.question}</div>
              <div className="text-xs text-gray-500 mt-1">{faq.answer}</div>
            </div>
          ))}
          {c.faqs.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-8">Add FAQ items via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
