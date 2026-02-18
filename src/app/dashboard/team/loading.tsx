export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-900/50" />
              <div className="h-3 w-3 animate-pulse rounded bg-zinc-900/30" />
              <div className="h-3 w-10 animate-pulse rounded bg-zinc-900" />
            </div>
            <div className="ml-2 flex items-center gap-3">
              <div className="h-5 w-16 animate-pulse rounded-md bg-zinc-900/30" />
              <div className="h-5 w-16 animate-pulse rounded-md bg-zinc-900/30" />
              <div className="h-5 w-16 animate-pulse rounded-md bg-amber-900/10" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-900/30" />
            <div className="h-7 w-16 animate-pulse rounded-lg bg-zinc-900/30" />
            <div className="flex rounded-lg bg-zinc-900/30">
              <div className="h-7 w-7 animate-pulse rounded-l-lg bg-zinc-900/40" />
              <div className="h-7 w-7 animate-pulse rounded-r-lg bg-zinc-900/20" />
            </div>
            <div className="h-7 w-14 animate-pulse rounded-lg bg-zinc-900/30" />
            <div className="h-7 w-16 animate-pulse rounded-lg bg-emerald-900/20" />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-5 py-1.5">
        <div className="w-8" />
        <div className="min-w-0 flex-1 px-2"><div className="h-2 w-14 animate-pulse rounded bg-zinc-800/40" /></div>
        <div className="w-28 px-2"><div className="h-2 w-8 animate-pulse rounded bg-zinc-800/40" /></div>
        <div className="w-24 px-2"><div className="h-2 w-10 animate-pulse rounded bg-zinc-800/40" /></div>
        <div className="w-36 px-2"><div className="h-2 w-8 animate-pulse rounded bg-zinc-800/40" /></div>
        <div className="w-24 px-2"><div className="h-2 w-14 animate-pulse rounded bg-zinc-800/40" /></div>
        <div className="w-20" />
      </div>

      {/* Rows */}
      {Array.from({ length: 11 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center border-b border-white/[0.03] px-5"
          style={{ height: 52, opacity: 1 - i * 0.06 }}
        >
          <div className="w-8 flex items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-800" />
          </div>
          <div className="min-w-0 flex-1 px-2 flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800/60" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-2 w-32 animate-pulse rounded bg-zinc-900/40" />
            </div>
          </div>
          <div className="w-28 px-2"><div className="h-4 w-16 animate-pulse rounded-md bg-zinc-900/30" /></div>
          <div className="w-24 px-2"><div className="h-4 w-14 animate-pulse rounded-md bg-zinc-900/30" /></div>
          <div className="w-36 px-2 flex gap-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 w-10 animate-pulse rounded-md bg-zinc-900/20" />
            ))}
          </div>
          <div className="w-24 px-2"><div className="h-2.5 w-12 animate-pulse rounded bg-zinc-900/40" /></div>
          <div className="w-20" />
        </div>
      ))}
    </div>
  );
}
