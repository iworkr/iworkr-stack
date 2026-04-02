/**
 * @component components/finance/editor/blocks/HeaderBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — HeaderBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, HeaderContent } from "../types";

export function HeaderBlock({
  block,
  isActive,
  isEditing,
  settings,
  workspace,
  onContentChange,
}: BlockRendererProps<"header">) {
  const c = block.content as HeaderContent;
  const accent = settings.brandColor || workspace.brand_color_hex || "#10B981";

  return (
    <div className="px-10 pt-10 pb-4">
      <div style={{ height: 2, backgroundColor: accent, opacity: 0.3, marginBottom: 20 }} />
      <div className="flex justify-between items-start">
        <div className="max-w-[55%]">
          {c.showLogo && workspace.logo_url ? (
            <img
              src={workspace.logo_url}
              alt={workspace.name}
              className="mb-2 max-h-12 max-w-[160px] object-contain"
            />
          ) : (
            <div className="text-lg font-bold text-gray-900 mb-1">{workspace.name}</div>
          )}
          {c.showOrgDetails && (
            <div className="space-y-0.5 text-[8px] leading-relaxed text-gray-500">
              {workspace.tax_id && <div>ABN: {workspace.tax_id}</div>}
              {workspace.address && <div>{workspace.address}</div>}
              {workspace.email && <div>{workspace.email}</div>}
              {workspace.phone && <div>{workspace.phone}</div>}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            contentEditable={isEditing}
            suppressContentEditableWarning
            onBlur={(e) => {
              const val = e.currentTarget.textContent?.trim() || "INVOICE";
              if (val !== c.title) onContentChange({ title: val });
            }}
            className="font-mono text-[10px] tracking-[2px] text-gray-400 outline-none focus:ring-1 focus:ring-blue-300 rounded px-1"
          >
            {c.title}
          </div>
        </div>
      </div>
    </div>
  );
}
