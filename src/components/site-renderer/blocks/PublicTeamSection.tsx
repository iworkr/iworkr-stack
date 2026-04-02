/**
 * @component components/site-renderer/blocks/PublicTeamSection.tsx
 * @status STABLE
 * @description Public Loom site render — PublicTeamSection
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { TeamSectionContent } from "@/components/site-editor/types";

export function PublicTeamSection({ block }: PublicBlockProps<"team_section">) {
  const c = block.content as TeamSectionContent;

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {c.members.map((m) => (
            <div key={m.id} className="rounded-xl bg-white p-6 text-center shadow-sm border border-gray-100">
              {m.photoUrl && (
                <img src={m.photoUrl} alt={m.name} className="mx-auto mb-4 h-24 w-24 rounded-full object-cover" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">{m.name}</h3>
              <p className="text-sm text-gray-500">{m.role}</p>
              {m.bio && <p className="mt-3 text-sm leading-relaxed text-gray-600">{m.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
