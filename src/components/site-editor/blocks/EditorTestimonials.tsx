/**
 * @component components/site-editor/blocks/EditorTestimonials.tsx
 * @status STABLE
 * @description Loom site builder — EditorTestimonials
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, TestimonialsContent } from "../types";

export function EditorTestimonials({ block, isEditing, globalStyles, onContentChange }: SiteBlockRendererProps<"testimonials">) {
  const c = block.content as TestimonialsContent;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "What Our Clients Say"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.testimonials.map((t) => (
            <div key={t.id} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-3 w-3" fill={i < t.rating ? globalStyles.primaryColor : "#e5e7eb"} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs text-gray-600 mb-3">&ldquo;{t.text}&rdquo;</p>
              <div className="text-xs font-semibold text-gray-900">{t.name}</div>
              {t.role && <div className="text-[10px] text-gray-500">{t.role}</div>}
            </div>
          ))}
          {c.testimonials.length === 0 && (
            <div className="col-span-full text-center text-xs text-gray-400 py-8">Add testimonials via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
