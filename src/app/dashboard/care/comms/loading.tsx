export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden bg-[var(--background)]">
      {/* Routing Ledger skeleton */}
      <div className="flex h-full w-[320px] shrink-0 flex-col border-r border-white/[0.04] bg-[#070707] px-3 py-4">
        <div className="mb-3 h-4 w-20 rounded skeleton-shimmer" />
        <div className="mb-3 h-8 w-full rounded-lg skeleton-shimmer" />
        <div className="mb-3 flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-6 flex-1 rounded-md skeleton-shimmer"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-lg skeleton-shimmer"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#050505]">
        <div className="h-16 w-16 rounded-2xl skeleton-shimmer" />
        <div className="mt-4 h-4 w-32 rounded skeleton-shimmer" />
        <div className="mt-2 h-3 w-48 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
