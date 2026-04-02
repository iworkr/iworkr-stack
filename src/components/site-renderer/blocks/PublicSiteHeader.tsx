/**
 * @component components/site-renderer/blocks/PublicSiteHeader.tsx
 * @status STABLE
 * @description Public Loom site render — PublicSiteHeader
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { PublicBlockProps } from ".";
import type { SiteHeaderContent } from "@/components/site-editor/types";

export function PublicSiteHeader({ block, globalStyles, siteName }: PublicBlockProps<"site_header">) {
  const c = block.content as SiteHeaderContent;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={`bg-white border-b border-gray-100 ${c.sticky ? "sticky top-0 z-50" : ""}`}>
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt={siteName} className="h-8 w-auto" />
          ) : (
            <span className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--site-font-heading)" }}>
              {siteName}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {c.navLinks.map((link) => (
            <a key={link.id} href={link.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              {link.label}
            </a>
          ))}
          {c.showPhone && c.phone && (
            <a href={`tel:${c.phone}`} className="text-sm font-semibold" style={{ color: globalStyles.primaryColor }}>
              {c.phone}
            </a>
          )}
          {c.ctaLabel && (
            <a
              href={c.ctaUrl || "#contact"}
              className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white"
              style={{
                backgroundColor: globalStyles.primaryColor,
                borderRadius: `var(--site-button-radius)`,
              }}
            >
              {c.ctaLabel}
            </a>
          )}
        </nav>

        {/* Mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
          {c.navLinks.map((link) => (
            <a key={link.id} href={link.href} className="block text-sm font-medium text-gray-700 py-2">
              {link.label}
            </a>
          ))}
          {c.showPhone && c.phone && (
            <a href={`tel:${c.phone}`} className="block text-sm font-semibold py-2" style={{ color: globalStyles.primaryColor }}>
              {c.phone}
            </a>
          )}
          {c.ctaLabel && (
            <a
              href={c.ctaUrl || "#contact"}
              className="block w-full text-center py-3 text-sm font-semibold text-white"
              style={{
                backgroundColor: globalStyles.primaryColor,
                borderRadius: `var(--site-button-radius)`,
              }}
            >
              {c.ctaLabel}
            </a>
          )}
        </div>
      )}
    </header>
  );
}
