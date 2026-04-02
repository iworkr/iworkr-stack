/**
 * @component components/site-renderer/blocks/PublicFeatureGrid.tsx
 * @status STABLE
 * @description Public Loom site render — PublicFeatureGrid
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { FeatureGridContent } from "@/components/site-editor/types";

export function PublicFeatureGrid({ block, globalStyles }: PublicBlockProps<"feature_grid">) {
  const c = block.content as FeatureGridContent;
  const cols = c.columns === 4 ? "md:grid-cols-4" : c.columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        {c.subheading && (
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">{c.subheading}</p>
        )}
        <div className={`grid gap-8 ${cols}`}>
          {c.features.map((f) => (
            <div key={f.id} className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 transition-shadow hover:shadow-md">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-2xl"
                style={{ backgroundColor: `${globalStyles.primaryColor}15`, color: globalStyles.primaryColor }}
              >
                {f.icon || "✦"}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
