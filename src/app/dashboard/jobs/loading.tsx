export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Command bar skeleton */}
      <div className="flex items-center justify-between border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-16 rounded-lg skeleton-shimmer" />
            <div className="h-3 w-3 rounded skeleton-shimmer" />
            <div className="h-3.5 w-10 rounded skeleton-shimmer" />
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-16 rounded-md skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-28 rounded-lg skeleton-shimmer" />
          <div className="h-7 w-16 rounded-lg skeleton-shimmer" />
          <div className="h-7 w-20 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center border-b border-white/[0.04] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-8" />
        <div className="w-8" />
        <div className="w-[80px] px-2"><div className="h-2 w-6 rounded skeleton-shimmer" /></div>
        <div className="w-[72px] px-1"><div className="h-2 w-12 rounded skeleton-shimmer" /></div>
        <div className="min-w-0 flex-1 px-2"><div className="h-2 w-10 rounded skeleton-shimmer" /></div>
        <div className="w-28 px-2"><div className="h-2 w-12 rounded skeleton-shimmer" /></div>
        <div className="w-28 px-2"><div className="h-2 w-16 rounded skeleton-shimmer" /></div>
        <div className="w-10" />
        <div className="w-20 px-2"><div className="h-2 w-6 rounded skeleton-shimmer" /></div>
        <div className="w-24" />
      </div>

      {/* Row skeletons */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-white/[0.03] px-5"
            style={{ height: 42, opacity: 1 - i * 0.04 }}
          >
            <div className="w-8" />
            <div className="w-8 px-1"><div className="h-3.5 w-3.5 rounded skeleton-shimmer" /></div>
            <div className="w-[80px] px-2"><div className="h-3 w-14 rounded skeleton-shimmer" /></div>
            <div className="w-[72px] px-1"><div className="h-4 w-14 rounded-full skeleton-shimmer" /></div>
            <div className="min-w-0 flex-1 px-2"><div className="h-3.5 rounded skeleton-shimmer" style={{ width: `${35 + (i * 7) % 35}%` }} /></div>
            <div className="w-28 px-2"><div className="h-3 w-20 rounded skeleton-shimmer" /></div>
            <div className="w-28 px-2"><div className="h-3 w-16 rounded skeleton-shimmer" /></div>
            <div className="w-10 px-1"><div className="h-5 w-5 rounded-lg skeleton-shimmer" /></div>
            <div className="w-20 px-2"><div className="h-3 w-10 rounded skeleton-shimmer" /></div>
            <div className="w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
