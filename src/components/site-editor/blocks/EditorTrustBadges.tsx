/**
 * @component components/site-editor/blocks/EditorTrustBadges.tsx
 * @status STABLE
 * @description Loom site builder — EditorTrustBadges
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, TrustBadgesContent } from "../types";

export function EditorTrustBadges({ block, isEditing, onContentChange }: SiteBlockRendererProps<"trust_badges">) {
  const c = block.content as TrustBadgesContent;

  return (
    <section className="py-10 px-6 bg-gray-50">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500 mb-6"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Trusted By"}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {c.badges.map((b) => (
            <div key={b.id} className="text-center">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt={b.label} className={`h-8 w-auto object-contain ${c.grayscale ? "grayscale" : ""}`} />
              ) : (
                <span className="text-xs text-gray-500">{b.label || "Badge"}</span>
              )}
            </div>
          ))}
          {c.badges.length === 0 && (
            <div className="text-xs text-gray-400">Add trust badges via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
