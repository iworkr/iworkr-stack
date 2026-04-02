/**
 * @component components/site-renderer/blocks/PublicTestimonials.tsx
 * @status STABLE
 * @description Public Loom site render — PublicTestimonials
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { TestimonialsContent } from "@/components/site-editor/types";

export function PublicTestimonials({ block, globalStyles }: PublicBlockProps<"testimonials">) {
  const c = block.content as TestimonialsContent;

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        <div className={`grid gap-8 ${c.layout === "masonry" ? "columns-1 sm:columns-2 lg:columns-3 space-y-8" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {c.testimonials.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm ${c.layout === "masonry" ? "break-inside-avoid" : ""}`}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="h-4 w-4" fill={i < t.rating ? globalStyles.primaryColor : "#e5e7eb"} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-gray-700 mb-4">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                {t.photoUrl && (
                  <img src={t.photoUrl} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                )}
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                  {(t.role || t.company) && (
                    <div className="text-xs text-gray-500">{[t.role, t.company].filter(Boolean).join(", ")}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
