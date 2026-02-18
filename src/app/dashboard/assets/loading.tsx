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
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-lg bg-zinc-900/30" />
            <div className="h-7 w-14 animate-pulse rounded-lg bg-zinc-900/30" />
            <div className="h-7 w-20 animate-pulse rounded-lg bg-emerald-900/20" />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl bg-zinc-900/30 px-4 py-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-9 w-9 animate-pulse rounded-xl bg-zinc-900/50" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-16 animate-pulse rounded bg-zinc-900/50" />
                <div className="h-5 w-14 animate-pulse rounded bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 px-5 pb-1.5">
          {["w-24", "w-20", "w-14"].map((w, i) => (
            <div
              key={i}
              className={`h-7 ${w} animate-pulse rounded-md ${i === 0 ? "bg-white/[0.04]" : "bg-zinc-900/30"}`}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Content — grid cards */}
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl bg-zinc-900/40"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-zinc-900/30" />
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="h-2 w-14 animate-pulse rounded bg-zinc-900/50" />
                <div className="h-2 w-16 animate-pulse rounded bg-zinc-900/30" />
              </div>
              <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-900" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-zinc-900/30" />
              <div className="mt-1 h-[3px] w-full animate-pulse rounded-full bg-zinc-900/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
