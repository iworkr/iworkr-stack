export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden bg-[var(--background)]">
      {/* Routing Ledger skeleton */}
      <div className="flex h-full w-[320px] shrink-0 flex-col border-r border-white/[0.04] bg-[#070707] px-3 py-4">
        <div className="mb-3 h-4 w-20 animate-pulse rounded bg-zinc-900" />
        <div className="mb-3 h-8 w-full animate-pulse rounded-lg bg-zinc-900/50" />
        <div className="mb-3 flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-6 flex-1 animate-pulse rounded-md bg-zinc-900/40"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-zinc-900/30"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#050505]">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-zinc-900/30" />
        <div className="mt-4 h-4 w-32 animate-pulse rounded bg-zinc-900/30" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-900/20" />
      </div>
    </div>
  );
}
