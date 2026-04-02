/**
 * @component components/site-renderer/blocks/PublicStatsCounter.tsx
 * @status STABLE
 * @description Public Loom site render — PublicStatsCounter
 * @lastReview 2026-03-28
 */
import type { PublicBlockProps } from ".";
import type { StatsCounterContent } from "@/components/site-editor/types";

export function PublicStatsCounter({ block, globalStyles }: PublicBlockProps<"stats_counter">) {
  const c = block.content as StatsCounterContent;

  return (
    <section
      className="py-16 px-6"
      style={{ backgroundColor: c.backgroundColor || globalStyles.primaryColor }}
    >
      <div className="mx-auto max-w-5xl grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center">
        {c.stats.map((s) => (
          <div key={s.id}>
            <div className="text-4xl font-extrabold text-white">
              {s.prefix}{s.value}{s.suffix}
            </div>
            <div className="mt-2 text-sm font-medium text-white/70">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
