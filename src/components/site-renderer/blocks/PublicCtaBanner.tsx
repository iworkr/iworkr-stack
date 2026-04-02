/**
 * @component components/site-renderer/blocks/PublicCtaBanner.tsx
 * @status STABLE
 * @description Public Loom site render — PublicCtaBanner
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { CtaBannerContent } from "@/components/site-editor/types";

export function PublicCtaBanner({ block, globalStyles }: PublicBlockProps<"cta_banner">) {
  const c = block.content as CtaBannerContent;

  return (
    <section
      className="py-16 px-6"
      style={{ backgroundColor: c.backgroundColor || globalStyles.primaryColor }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2
          className="text-3xl font-bold mb-3"
          style={{ color: c.textColor || "#fff", fontFamily: "var(--site-font-heading)" }}
        >
          {c.headline || "Ready to Get Started?"}
        </h2>
        {c.subheadline && (
          <p className="mb-8 text-lg" style={{ color: `${c.textColor || "#fff"}cc` }}>
            {c.subheadline}
          </p>
        )}
        {c.ctaLabel && (
          <a
            href={c.ctaUrl || "#contact"}
            className={`inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold transition-transform hover:scale-[1.02] ${
              c.ctaStyle === "outline"
                ? "border-2"
                : ""
            }`}
            style={{
              backgroundColor: c.ctaStyle === "outline" ? "transparent" : "#fff",
              color: c.ctaStyle === "outline" ? (c.textColor || "#fff") : (c.backgroundColor || globalStyles.primaryColor),
              borderColor: c.ctaStyle === "outline" ? (c.textColor || "#fff") : "transparent",
              borderRadius: `var(--site-button-radius)`,
            }}
          >
            {c.ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}
