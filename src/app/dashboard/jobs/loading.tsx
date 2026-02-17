export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Control bar skeleton */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <div className="h-5 w-12 animate-pulse rounded bg-zinc-900" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-16 animate-pulse rounded-md bg-zinc-900/60" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded-md bg-zinc-900/40" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-zinc-900/60" />
          <div className="h-7 w-20 animate-pulse rounded-md bg-zinc-900" />
        </div>
      </div>

      {/* Column headers skeleton */}
      <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-2">
        <div className="w-8" />
        <div className="w-8" />
        <div className="w-[80px] px-2"><div className="h-2.5 w-6 animate-pulse rounded bg-zinc-900/40" /></div>
        <div className="w-8" />
        <div className="min-w-0 flex-1 px-2"><div className="h-2.5 w-8 animate-pulse rounded bg-zinc-900/40" /></div>
        <div className="w-32 px-2"><div className="h-2.5 w-10 animate-pulse rounded bg-zinc-900/40" /></div>
        <div className="w-32 px-2"><div className="h-2.5 w-14 animate-pulse rounded bg-zinc-900/40" /></div>
        <div className="w-8" />
        <div className="w-20 px-2"><div className="h-2.5 w-6 animate-pulse rounded bg-zinc-900/40" /></div>
        <div className="w-8" />
      </div>

      {/* Row skeletons */}
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center border-b border-white/[0.03] px-5"
            style={{ height: 40, animationDelay: `${i * 40}ms` }}
          >
            <div className="w-8" />
            <div className="w-8 px-1"><div className="h-3.5 w-3.5 animate-pulse rounded bg-zinc-900/30" /></div>
            <div className="w-[80px] px-2"><div className="h-3 w-14 animate-pulse rounded bg-zinc-900/40" /></div>
            <div className="w-8 px-1"><div className="h-3.5 w-3.5 animate-pulse rounded-full bg-zinc-900/30" /></div>
            <div className="min-w-0 flex-1 px-2"><div className="h-3.5 animate-pulse rounded bg-zinc-900/50" style={{ width: `${40 + Math.random() * 30}%` }} /></div>
            <div className="w-32 px-2"><div className="h-3 w-20 animate-pulse rounded bg-zinc-900/30" /></div>
            <div className="w-32 px-2"><div className="h-3 w-16 animate-pulse rounded bg-zinc-900/20" /></div>
            <div className="w-8 px-1"><div className="h-5 w-5 animate-pulse rounded-md bg-zinc-900/30" /></div>
            <div className="w-20 px-2"><div className="h-3 w-12 animate-pulse rounded bg-zinc-900/30" /></div>
            <div className="w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
