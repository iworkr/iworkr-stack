export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-900" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-900" />
      </div>

      {/* Stats/filter bar */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-zinc-900" />
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
            <div className="h-5 w-5 animate-pulse rounded bg-zinc-900" />
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-900" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-900" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
