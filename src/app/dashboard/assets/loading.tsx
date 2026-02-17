export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-white/[0.05]">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-900" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-zinc-900/50" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-md bg-zinc-900/50" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-zinc-900" />
            <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-900" />
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-zinc-900/40 px-4 py-2.5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-900/50" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-16 animate-pulse rounded bg-zinc-900/50" />
                <div className="h-4 w-12 animate-pulse rounded bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-5 pb-1">
          {["w-24", "w-20", "w-14"].map((w, i) => (
            <div key={i} className={`h-3 ${w} animate-pulse rounded bg-zinc-900`} style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>

      {/* Content — scanning animation */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="h-5 w-5 animate-pulse rounded bg-zinc-900" />
        </div>
        <div className="h-3 w-28 animate-pulse rounded bg-zinc-900/50" />
      </div>
    </div>
  );
}
