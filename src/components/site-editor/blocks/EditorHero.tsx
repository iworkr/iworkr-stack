/**
 * @component components/site-editor/blocks/EditorHero.tsx
 * @status STABLE
 * @description Loom site builder — EditorHero
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, HeroContent } from "../types";

export function EditorHero({ block, isEditing, globalStyles, onContentChange }: SiteBlockRendererProps<"hero">) {
  const c = block.content as HeroContent;
  const alignClass = c.alignment === "left" ? "text-left items-start" : c.alignment === "right" ? "text-right items-end" : "text-center items-center";

  const bgStyle: React.CSSProperties = {};
  if (c.backgroundType === "image" && c.backgroundUrl) {
    bgStyle.backgroundImage = `url(${c.backgroundUrl})`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
  } else if (c.backgroundType === "gradient") {
    bgStyle.background = `linear-gradient(135deg, ${c.gradientFrom || globalStyles.primaryColor}, ${c.gradientTo || globalStyles.secondaryColor})`;
  } else {
    bgStyle.backgroundColor = "#f9fafb";
  }

  const textColor = c.backgroundType === "image" || c.backgroundType === "gradient" ? "#fff" : "#111";

  return (
    <section className="relative min-h-[400px] flex items-center" style={bgStyle}>
      {c.backgroundType === "image" && (
        <div className="absolute inset-0 bg-black" style={{ opacity: c.overlayOpacity ?? 0.5 }} />
      )}
      <div className={`relative z-10 mx-auto max-w-4xl px-6 py-16 flex flex-col gap-4 ${alignClass} w-full`}>
        <h1
          className="text-4xl font-extrabold leading-tight"
          style={{ color: textColor }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ headline: e.currentTarget.textContent || "" })}
        >
          {c.headline || "Your Business, Online"}
        </h1>
        <p
          className="max-w-2xl text-lg"
          style={{ color: c.backgroundType === "image" || c.backgroundType === "gradient" ? "rgba(255,255,255,0.85)" : "#555" }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ subheadline: e.currentTarget.textContent || "" })}
        >
          {c.subheadline || "Add a subheadline here"}
        </p>
        <div className="flex flex-wrap gap-3 mt-2">
          <span
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white rounded-lg"
            style={{ backgroundColor: globalStyles.primaryColor }}
          >
            {c.ctaLabel || "Get Started"}
          </span>
          {c.secondaryCtaLabel && (
            <span className="inline-flex items-center px-6 py-3 text-sm font-semibold border-2 rounded-lg" style={{ borderColor: textColor, color: textColor }}>
              {c.secondaryCtaLabel}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
