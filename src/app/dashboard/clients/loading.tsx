export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Command bar skeleton */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 rounded skeleton-shimmer" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 w-20 rounded-md skeleton-shimmer" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-44 rounded-md skeleton-shimmer" />
            <div className="h-7 w-16 rounded-md skeleton-shimmer" />
            <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Column header skeleton */}
      <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-64 px-2"><div className="h-3 w-12 rounded skeleton-shimmer" /></div>
        <div className="w-24 px-2"><div className="h-3 w-12 rounded skeleton-shimmer" /></div>
        <div className="w-20 px-2"><div className="h-3 w-14 rounded skeleton-shimmer" /></div>
        <div className="min-w-0 flex-1 px-2"><div className="h-3 w-10 rounded skeleton-shimmer" /></div>
        <div className="w-16 px-2"><div className="ml-auto h-3 w-8 rounded skeleton-shimmer" /></div>
        <div className="w-28 px-2"><div className="ml-auto h-3 w-8 rounded skeleton-shimmer" /></div>
        <div className="w-24 px-2"><div className="ml-auto h-3 w-16 rounded skeleton-shimmer" /></div>
        <div className="w-24" />
      </div>

      {/* Summary bar skeleton */}
      <div className="flex items-center gap-6 border-b border-white/[0.02] bg-white/[0.01] px-7 py-2">
        <div className="h-3 w-20 rounded skeleton-shimmer" />
        <div className="h-3 w-28 rounded skeleton-shimmer" />
      </div>

      {/* Row skeletons */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-white/[0.03] px-5"
            style={{ height: 64, animationDelay: `${i * 50}ms` }}
          >
            {/* Avatar + Name */}
            <div className="flex w-64 items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full skeleton-shimmer" style={{ animationDelay: `${i * 50}ms` }} />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 rounded skeleton-shimmer" style={{ animationDelay: `${i * 50 + 20}ms` }} />
                <div className="h-2.5 w-16 rounded skeleton-shimmer" style={{ animationDelay: `${i * 50 + 40}ms` }} />
              </div>
            </div>

            {/* Status pill */}
            <div className="w-24 px-2">
              <div className="h-5 w-14 rounded-md skeleton-shimmer" style={{ animationDelay: `${i * 50 + 30}ms` }} />
            </div>

            {/* Contact */}
            <div className="flex w-20 items-center justify-center gap-1 px-2">
              <div className="h-5 w-5 rounded skeleton-shimmer" />
              <div className="h-5 w-5 rounded skeleton-shimmer" />
            </div>

            {/* Email */}
            <div className="min-w-0 flex-1 px-2">
              <div className="h-3 w-36 rounded skeleton-shimmer" style={{ animationDelay: `${i * 50 + 40}ms` }} />
            </div>

            {/* Jobs */}
            <div className="w-16 px-2 text-right">
              <div className="ml-auto h-3 w-6 rounded skeleton-shimmer" />
            </div>

            {/* LTV */}
            <div className="w-28 px-2 text-right">
              <div className="ml-auto h-3 w-16 rounded skeleton-shimmer" style={{ animationDelay: `${i * 50 + 60}ms` }} />
            </div>

            {/* Last Active */}
            <div className="w-24 px-2 text-right">
              <div className="ml-auto h-3 w-14 rounded skeleton-shimmer" />
            </div>

            <div className="w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
