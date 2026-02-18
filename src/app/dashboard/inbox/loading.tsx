export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden bg-[#050505]">
      {/* Sidebar skeleton */}
      <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.04] bg-zinc-950 px-3 py-4">
        <div className="mb-4 h-5 w-24 animate-pulse rounded bg-zinc-900" />
        <div className="mb-3 h-8 w-full animate-pulse rounded-lg bg-zinc-900/50" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-md bg-zinc-900/40"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        <div className="mt-4 mb-2 h-3 w-16 animate-pulse rounded bg-zinc-900/30" />
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-7 animate-pulse rounded-md bg-zinc-900/30"
              style={{ animationDelay: `${i * 50 + 300}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Main area skeleton */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-zinc-900/30" />
        <div className="mt-4 h-4 w-32 animate-pulse rounded bg-zinc-900/30" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-900/20" />
      </div>
    </div>
  );
}
