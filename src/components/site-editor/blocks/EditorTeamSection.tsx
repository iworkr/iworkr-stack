/**
 * @component components/site-editor/blocks/EditorTeamSection.tsx
 * @status STABLE
 * @description Loom site builder — EditorTeamSection
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, TeamSectionContent } from "../types";

export function EditorTeamSection({ block, isEditing, onContentChange }: SiteBlockRendererProps<"team_section">) {
  const c = block.content as TeamSectionContent;

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Our Team"}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.members.map((m) => (
            <div key={m.id} className="rounded-lg bg-white p-4 text-center border border-gray-100">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-gray-200" />
              )}
              <h3 className="text-sm font-semibold text-gray-900">{m.name}</h3>
              <p className="text-xs text-gray-500">{m.role}</p>
            </div>
          ))}
          {c.members.length === 0 && (
            <div className="col-span-full text-center text-xs text-gray-400 py-8">Add team members via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
