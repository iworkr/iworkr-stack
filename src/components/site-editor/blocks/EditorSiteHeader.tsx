/**
 * @component components/site-editor/blocks/EditorSiteHeader.tsx
 * @status STABLE
 * @description Loom site builder — EditorSiteHeader
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, SiteHeaderContent } from "../types";

export function EditorSiteHeader({ block, globalStyles }: SiteBlockRendererProps<"site_header">) {
  const c = block.content as SiteHeaderContent;

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="Logo" className="h-7 w-auto" />
          ) : (
            <span className="text-lg font-bold text-gray-900">Logo</span>
          )}
        </div>
        <nav className="flex items-center gap-6">
          {c.navLinks.map((link) => (
            <span key={link.id} className="text-xs font-medium text-gray-600">{link.label}</span>
          ))}
          {c.showPhone && c.phone && (
            <span className="text-xs font-semibold" style={{ color: globalStyles.primaryColor }}>{c.phone}</span>
          )}
          {c.ctaLabel && (
            <span
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white rounded"
              style={{ backgroundColor: globalStyles.primaryColor }}
            >
              {c.ctaLabel}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
