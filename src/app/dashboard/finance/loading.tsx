export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-white/[0.04] bg-zinc-950/80">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-14 animate-pulse rounded bg-zinc-900/50" />
              <div className="h-3 w-1 animate-pulse rounded bg-zinc-900/30" />
              <div className="h-3 w-12 animate-pulse rounded bg-zinc-900" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-900/30" />
          </div>
          <div className="h-7 w-28 animate-pulse rounded-lg bg-emerald-900/20" />
        </div>
        {/* Tab pills */}
        <div className="flex gap-1 px-5 pb-1.5">
          {["w-16", "w-14", "w-12", "w-14"].map((w, i) => (
            <div
              key={i}
              className={`h-7 ${w} animate-pulse rounded-md ${i === 0 ? "bg-white/[0.04]" : "bg-zinc-900/30"}`}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Revenue banner */}
      <div className="border-b border-white/[0.03] px-6 pt-6 pb-4">
        <div className="mb-1 h-3 w-32 animate-pulse rounded bg-zinc-900/50" />
        <div className="mb-6 h-12 w-44 animate-pulse rounded bg-zinc-900" />
        <div className="relative h-[140px] w-full animate-pulse rounded-xl bg-zinc-900/20">
          <div className="absolute bottom-4 left-4 right-4 h-[2px] rounded bg-emerald-900/20" />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-zinc-900/30 p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-900/50" />
            <div className="mb-3 h-8 w-24 animate-pulse rounded bg-zinc-900" />
            <div className="h-[3px] w-full animate-pulse rounded-full bg-zinc-900/30" />
          </div>
        ))}
      </div>

      {/* Ledger header */}
      <div className="px-6 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-900/50" />
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-900/30" />
        </div>
        <div className="mb-2 flex items-center gap-3 px-3 py-1">
          {["w-16", "w-16", "w-28", "w-20", "w-20"].map((w, i) => (
            <div key={i} className={`h-2 ${w} animate-pulse rounded bg-zinc-900/30`} style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>

      {/* Ledger rows */}
      <div className="space-y-0 px-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md px-3 py-2.5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-4 w-12 animate-pulse rounded-md bg-zinc-900/30" />
            <div className="h-3 w-14 animate-pulse rounded bg-zinc-900/50" />
            <div className="h-3 flex-1 animate-pulse rounded bg-zinc-900/40" />
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-900/30" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-zinc-900/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
