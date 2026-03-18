export default function Loading() {
  return (
    <div className="h-full overflow-auto bg-[var(--background)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-44 rounded skeleton-shimmer" />
          <div className="h-5 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* KPI bento grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-4 rounded skeleton-shimmer" />
              <div className="h-3 w-20 rounded skeleton-shimmer" />
            </div>
            <div className="h-8 w-16 rounded skeleton-shimmer mb-2" />
            <div className="h-2.5 w-24 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* Main column — 2 cols */}
        <div className="col-span-2 space-y-4">
          {/* Shifts card */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="h-4 w-32 rounded skeleton-shimmer mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.12 }}>
                  <div className="h-10 w-10 rounded-full skeleton-shimmer" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/5 rounded skeleton-shimmer" />
                    <div className="h-2.5 w-2/5 rounded skeleton-shimmer" />
                  </div>
                  <div className="h-5 w-16 rounded-full skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
          {/* Timeline card */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="h-4 w-28 rounded skeleton-shimmer mb-4" />
            <div className="h-40 rounded-lg skeleton-shimmer" />
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="h-4 w-24 rounded skeleton-shimmer mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full skeleton-shimmer" />
                  <div className="h-3 w-full rounded skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="h-4 w-20 rounded skeleton-shimmer mb-4" />
            <div className="h-24 rounded-lg skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
