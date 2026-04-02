/**
 * @component components/site-editor/blocks/EditorCtaBanner.tsx
 * @status STABLE
 * @description Loom site builder — EditorCtaBanner
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, CtaBannerContent } from "../types";

export function EditorCtaBanner({ block, isEditing, globalStyles, onContentChange }: SiteBlockRendererProps<"cta_banner">) {
  const c = block.content as CtaBannerContent;

  return (
    <section className="py-10 px-6" style={{ backgroundColor: c.backgroundColor || globalStyles.primaryColor }}>
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: c.textColor || "#fff" }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ headline: e.currentTarget.textContent || "" })}
        >
          {c.headline || "Ready to Get Started?"}
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: `${c.textColor || "#fff"}cc` }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ subheadline: e.currentTarget.textContent || "" })}
        >
          {c.subheadline || "Contact us today"}
        </p>
        <span
          className="inline-flex items-center px-6 py-2.5 text-sm font-semibold rounded-lg"
          style={{
            backgroundColor: c.ctaStyle === "outline" ? "transparent" : "#fff",
            color: c.ctaStyle === "outline" ? (c.textColor || "#fff") : (c.backgroundColor || globalStyles.primaryColor),
            border: c.ctaStyle === "outline" ? `2px solid ${c.textColor || "#fff"}` : "none",
          }}
        >
          {c.ctaLabel || "Get Started"}
        </span>
      </div>
    </section>
  );
}
