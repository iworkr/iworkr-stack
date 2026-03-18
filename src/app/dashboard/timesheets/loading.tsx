export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-6 w-32 rounded skeleton-shimmer" />
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-24 rounded-full skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Telemetry bar */}
      <div className="grid grid-cols-4 gap-6 border-b border-white/[0.04] px-6 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-20 rounded skeleton-shimmer" />
            <div className="h-6 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-white/[0.04] px-8 py-2.5">
        <div className="w-8"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
        {["w-36", "w-28", "w-24", "w-20", "w-16", "w-20"].map((w, i) => (
          <div key={i} className={`${w} h-2.5 rounded skeleton-shimmer`} />
        ))}
      </div>

      {/* Table rows */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-white/[0.03] px-8 h-16" style={{ opacity: 1 - i * 0.06 }}>
            <div className="w-8"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
            <div className="flex w-36 items-center gap-3">
              <div className="h-8 w-8 rounded-full skeleton-shimmer" />
              <div className="space-y-1">
                <div className="h-3 w-20 rounded skeleton-shimmer" />
                <div className="h-2 w-16 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="w-28 space-y-1">
              <div className="h-3 w-20 rounded skeleton-shimmer" />
              <div className="h-2 w-24 rounded skeleton-shimmer" />
            </div>
            <div className="w-24 space-y-1">
              <div className="h-3 w-16 rounded skeleton-shimmer" />
              <div className="h-2 w-20 rounded skeleton-shimmer" />
            </div>
            <div className="w-20"><div className="h-3 w-12 rounded skeleton-shimmer" /></div>
            <div className="w-16"><div className="h-5 w-14 rounded-full skeleton-shimmer" /></div>
            <div className="w-20"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
