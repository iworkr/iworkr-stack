export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-white/[0.05]">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-900" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-zinc-900/50" />
          </div>
          <div className="h-7 w-28 animate-pulse rounded-md bg-zinc-900" />
        </div>
        {/* Tab bar */}
        <div className="flex gap-1 px-5 pb-1">
          {["w-16", "w-14", "w-12", "w-14"].map((w, i) => (
            <div key={i} className={`h-3 ${w} animate-pulse rounded bg-zinc-900`} style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>

      {/* Hero revenue area */}
      <div className="border-b border-white/[0.04] px-6 pt-6 pb-4">
        <div className="mb-1 h-3 w-32 animate-pulse rounded bg-zinc-900/50" />
        <div className="mb-4 h-10 w-40 animate-pulse rounded bg-zinc-900" />
        <div className="h-[100px] w-full animate-pulse rounded-lg bg-zinc-900/30" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/[0.05] bg-zinc-900/30 p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-900/50" />
            <div className="mb-2 h-7 w-20 animate-pulse rounded bg-zinc-900" />
            <div className="h-2 w-full animate-pulse rounded-full bg-zinc-900/30" />
          </div>
        ))}
      </div>

      {/* Recent rows */}
      <div className="space-y-1 px-6">
        <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-900/50" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md px-3 py-2"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="h-[6px] w-[6px] animate-pulse rounded-full bg-zinc-900" />
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-900/50" />
            <div className="h-3 w-28 animate-pulse rounded bg-zinc-900" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-zinc-900/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
