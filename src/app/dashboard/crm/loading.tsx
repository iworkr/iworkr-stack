export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-28 rounded skeleton-shimmer" />
          <div className="h-5 w-12 rounded-full skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 gap-4 overflow-hidden px-6 py-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex w-[280px] shrink-0 flex-col gap-2.5" style={{ opacity: 1 - col * 0.12 }}>
            <div className="flex items-center justify-between px-1 py-2">
              <div className="h-3 w-24 rounded skeleton-shimmer" />
              <div className="h-5 w-5 rounded skeleton-shimmer" />
            </div>
            {Array.from({ length: 3 - Math.floor(col / 2) }).map((_, card) => (
              <div key={card} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-2.5">
                <div className="h-3.5 w-4/5 rounded skeleton-shimmer" />
                <div className="h-2.5 w-3/5 rounded skeleton-shimmer" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-5 w-5 rounded-full skeleton-shimmer" />
                  <div className="h-2.5 w-16 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
