export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Command bar skeleton */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-900" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 w-20 animate-pulse rounded-md bg-zinc-900/60" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-44 animate-pulse rounded-md bg-zinc-900/40" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-zinc-900/40" />
            <div className="h-7 w-24 animate-pulse rounded-lg bg-emerald-900/30" />
          </div>
        </div>
      </div>

      {/* Column header skeleton */}
      <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-5 py-2">
        <div className="w-64 px-2"><div className="h-3 w-12 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-24 px-2"><div className="h-3 w-12 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-20 px-2"><div className="h-3 w-14 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="min-w-0 flex-1 px-2"><div className="h-3 w-10 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-16 px-2"><div className="ml-auto h-3 w-8 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-28 px-2"><div className="ml-auto h-3 w-8 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-24 px-2"><div className="ml-auto h-3 w-16 animate-pulse rounded bg-zinc-900/60" /></div>
        <div className="w-24" />
      </div>

      {/* Summary bar skeleton */}
      <div className="flex items-center gap-6 border-b border-white/[0.02] bg-white/[0.01] px-7 py-2">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-900/40" />
        <div className="h-3 w-28 animate-pulse rounded bg-zinc-900/40" />
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
              <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-900" style={{ animationDelay: `${i * 50}ms` }} />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-900" style={{ animationDelay: `${i * 50 + 20}ms` }} />
                <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-900/60" style={{ animationDelay: `${i * 50 + 40}ms` }} />
              </div>
            </div>

            {/* Status pill */}
            <div className="w-24 px-2">
              <div className="h-5 w-14 animate-pulse rounded-md bg-zinc-900/50" style={{ animationDelay: `${i * 50 + 30}ms` }} />
            </div>

            {/* Contact */}
            <div className="flex w-20 items-center justify-center gap-1 px-2">
              <div className="h-5 w-5 animate-pulse rounded bg-zinc-900/30" />
              <div className="h-5 w-5 animate-pulse rounded bg-zinc-900/30" />
            </div>

            {/* Email */}
            <div className="min-w-0 flex-1 px-2">
              <div className="h-3 w-36 animate-pulse rounded bg-zinc-900/40" style={{ animationDelay: `${i * 50 + 40}ms` }} />
            </div>

            {/* Jobs */}
            <div className="w-16 px-2 text-right">
              <div className="ml-auto h-3 w-6 animate-pulse rounded bg-zinc-900/40" />
            </div>

            {/* LTV */}
            <div className="w-28 px-2 text-right">
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-emerald-900/20" style={{ animationDelay: `${i * 50 + 60}ms` }} />
            </div>

            {/* Last Active */}
            <div className="w-24 px-2 text-right">
              <div className="ml-auto h-3 w-14 animate-pulse rounded bg-zinc-900/30" />
            </div>

            <div className="w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
