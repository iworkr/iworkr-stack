/**
 * @component components/site-renderer/blocks/PublicTrustBadges.tsx
 * @status STABLE
 * @description Public Loom site render — PublicTrustBadges
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
import type { PublicBlockProps } from ".";
import type { TrustBadgesContent } from "@/components/site-editor/types";

export function PublicTrustBadges({ block }: PublicBlockProps<"trust_badges">) {
  const c = block.content as TrustBadgesContent;

  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="mx-auto max-w-6xl">
        {c.heading && (
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-500 mb-8">
            {c.heading}
          </h2>
        )}
        <div className={`flex flex-wrap items-center justify-center ${c.layout === "grid" ? "gap-8" : "gap-12"}`}>
          {c.badges.map((b) => (
            <a key={b.id} href={b.url || "#"} className="block transition-opacity hover:opacity-80" target="_blank" rel="noopener noreferrer">
              {b.imageUrl ? (
                <img
                  src={b.imageUrl}
                  alt={b.label}
                  className={`h-12 w-auto object-contain ${c.grayscale ? "grayscale hover:grayscale-0 transition-all" : ""}`}
                />
              ) : (
                <span className="text-sm font-medium text-gray-600">{b.label}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
