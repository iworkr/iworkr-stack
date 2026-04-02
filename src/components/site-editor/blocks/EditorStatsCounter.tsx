/**
 * @component components/site-editor/blocks/EditorStatsCounter.tsx
 * @status STABLE
 * @description Loom site builder — EditorStatsCounter
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, StatsCounterContent } from "../types";

export function EditorStatsCounter({ block, globalStyles }: SiteBlockRendererProps<"stats_counter">) {
  const c = block.content as StatsCounterContent;

  return (
    <section className="py-10 px-6" style={{ backgroundColor: c.backgroundColor || globalStyles.primaryColor }}>
      <div className="mx-auto max-w-4xl grid gap-6 grid-cols-2 lg:grid-cols-4 text-center">
        {c.stats.map((s) => (
          <div key={s.id}>
            <div className="text-2xl font-bold text-white">{s.prefix}{s.value}{s.suffix}</div>
            <div className="text-xs text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
        {c.stats.length === 0 && (
          <div className="col-span-full text-xs text-white/50 py-4">Add stats via the property panel</div>
        )}
      </div>
    </section>
  );
}
