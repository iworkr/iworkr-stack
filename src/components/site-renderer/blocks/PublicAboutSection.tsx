/**
 * @component components/site-renderer/blocks/PublicAboutSection.tsx
 * @status STABLE
 * @description Public Loom site render — PublicAboutSection
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { AboutSectionContent } from "@/components/site-editor/types";

export function PublicAboutSection({ block, globalStyles }: PublicBlockProps<"about_section">) {
  const c = block.content as AboutSectionContent;
  const imgLeft = c.imagePosition === "left";

  return (
    <section className="py-20 px-6">
      <div className={`mx-auto max-w-6xl flex flex-col gap-12 ${imgLeft ? "md:flex-row" : "md:flex-row-reverse"} items-center`}>
        {c.imageUrl && (
          <div className="w-full md:w-1/2">
            <img src={c.imageUrl} alt={c.heading} className="w-full rounded-2xl object-cover shadow-lg" />
          </div>
        )}
        <div className="w-full md:w-1/2 space-y-6">
          {c.heading && (
            <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "var(--site-font-heading)" }}>
              {c.heading}
            </h2>
          )}
          {c.body && <p className="text-base leading-relaxed text-gray-600 whitespace-pre-line">{c.body}</p>}
          {c.showStats && c.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-6 pt-4 sm:grid-cols-3">
              {c.stats.map((s) => (
                <div key={s.id}>
                  <div className="text-3xl font-bold" style={{ color: globalStyles.primaryColor }}>{s.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
