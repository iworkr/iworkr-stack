/**
 * @component components/site-renderer/blocks/PublicHero.tsx
 * @status STABLE
 * @description Public Loom site render — PublicHero
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { HeroContent } from "@/components/site-editor/types";

export function PublicHero({ block, globalStyles }: PublicBlockProps<"hero">) {
  const c = block.content as HeroContent;
  const alignClass = c.alignment === "left" ? "text-left items-start" : c.alignment === "right" ? "text-right items-end" : "text-center items-center";

  const bgStyle: React.CSSProperties = {};
  if (c.backgroundType === "image" && c.backgroundUrl) {
    bgStyle.backgroundImage = `url(${c.backgroundUrl})`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
  } else if (c.backgroundType === "gradient") {
    bgStyle.background = `linear-gradient(135deg, ${c.gradientFrom || globalStyles.primaryColor}, ${c.gradientTo || globalStyles.secondaryColor})`;
  }

  return (
    <section className="relative min-h-[600px] flex items-center" style={bgStyle}>
      {c.backgroundType === "image" && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: c.overlayOpacity ?? 0.5 }}
        />
      )}
      <div className={`relative z-10 mx-auto max-w-5xl px-6 py-24 flex flex-col gap-6 ${alignClass}`}>
        <h1
          className="text-5xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          style={{ fontFamily: `var(--site-font-heading), sans-serif`, color: c.backgroundType !== "gradient" && c.backgroundType !== "image" ? "#111" : "#fff" }}
        >
          {c.headline || "Your Business, Online"}
        </h1>
        {c.subheadline && (
          <p
            className="max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: c.backgroundType !== "gradient" && c.backgroundType !== "image" ? "#555" : "rgba(255,255,255,0.85)" }}
          >
            {c.subheadline}
          </p>
        )}
        <div className="flex flex-wrap gap-4 mt-2">
          {c.ctaLabel && (
            <a
              href={c.ctaUrl || "#contact"}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: globalStyles.primaryColor,
                borderRadius: `var(--site-button-radius)`,
              }}
            >
              {c.ctaLabel}
            </a>
          )}
          {c.secondaryCtaLabel && (
            <a
              href={c.secondaryCtaUrl || "#services"}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold border-2 transition-transform hover:scale-[1.02]"
              style={{
                borderColor: c.backgroundType === "image" || c.backgroundType === "gradient" ? "#fff" : globalStyles.primaryColor,
                color: c.backgroundType === "image" || c.backgroundType === "gradient" ? "#fff" : globalStyles.primaryColor,
                borderRadius: `var(--site-button-radius)`,
              }}
            >
              {c.secondaryCtaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
