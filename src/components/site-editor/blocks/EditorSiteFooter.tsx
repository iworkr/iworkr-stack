/**
 * @component components/site-editor/blocks/EditorSiteFooter.tsx
 * @status STABLE
 * @description Loom site builder — EditorSiteFooter
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, SiteFooterContent } from "../types";

export function EditorSiteFooter({ block }: SiteBlockRendererProps<"site_footer">) {
  const c = block.content as SiteFooterContent;

  return (
    <footer className="bg-gray-900 text-gray-300 py-8 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 grid-cols-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-2">{c.companyName || "Company"}</h3>
            {c.description && <p className="text-[10px] text-gray-400 leading-relaxed">{c.description}</p>}
          </div>
          {c.columns.map((col) => (
            <div key={col.id}>
              <h4 className="text-[10px] font-semibold text-white mb-2 uppercase tracking-wider">{col.heading}</h4>
              <ul className="space-y-1">
                {col.links.map((link) => (
                  <li key={link.id} className="text-[10px] text-gray-400">{link.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {c.showCopyright && (
          <div className="mt-6 pt-4 border-t border-gray-800 text-center text-[10px] text-gray-500">
            {c.copyrightText || "© 2026 Company. All rights reserved."}
          </div>
        )}
      </div>
    </footer>
  );
}
