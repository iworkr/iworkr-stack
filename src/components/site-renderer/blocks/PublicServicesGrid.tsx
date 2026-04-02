/**
 * @component components/site-renderer/blocks/PublicServicesGrid.tsx
 * @status STABLE
 * @description Public Loom site render — PublicServicesGrid
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { ServicesGridContent } from "@/components/site-editor/types";

export function PublicServicesGrid({ block }: PublicBlockProps<"services_grid">) {
  const c = block.content as ServicesGridContent;
  const cols = c.columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        <div className={`grid gap-8 ${cols}`}>
          {c.services.map((s) => (
            <div key={s.id} className="group overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-lg">
              {c.showImages && s.imageUrl && (
                <div className="aspect-video overflow-hidden">
                  <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
              )}
              <div className="p-6">
                <div className="mb-2 text-2xl">{s.icon || "🔧"}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
