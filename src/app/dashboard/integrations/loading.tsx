export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
        <div className="h-9 w-32 rounded-lg skeleton-shimmer" />
      </div>

      {/* Stats/filter bar */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg skeleton-shimmer" />
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/50 p-4"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="h-5 w-5 rounded skeleton-shimmer" />
            <div className="h-4 w-48 rounded skeleton-shimmer" />
            <div className="ml-auto h-4 w-20 rounded skeleton-shimmer" />
            <div className="h-6 w-16 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
