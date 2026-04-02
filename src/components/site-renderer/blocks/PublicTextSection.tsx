/**
 * @component components/site-renderer/blocks/PublicTextSection.tsx
 * @status STABLE
 * @description Public Loom site render — PublicTextSection
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { TextSectionContent } from "@/components/site-editor/types";

export function PublicTextSection({ block }: PublicBlockProps<"text_section">) {
  const c = block.content as TextSectionContent;
  const align = c.alignment === "left" ? "text-left" : c.alignment === "right" ? "text-right" : "text-center";
  const maxW = c.maxWidth === "narrow" ? "max-w-2xl" : c.maxWidth === "medium" ? "max-w-4xl" : "max-w-6xl";

  return (
    <section className="py-16 px-6">
      <div className={`mx-auto ${maxW} ${align}`}>
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        {c.body && (
          <div
            className="text-base leading-relaxed text-gray-600 whitespace-pre-line"
            style={{ fontFamily: "var(--site-font-body)" }}
          >
            {c.body}
          </div>
        )}
      </div>
    </section>
  );
}
