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
            <div className="h-7 w-16 animate-pulse rounded-md bg-zinc-900/50" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-zinc-900/50" />
            <div className="h-7 w-20 animate-pulse rounded-md bg-zinc-900" />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-1.5">
        <div className="w-8" />
        <div className="min-w-0 flex-1 px-2"><div className="h-2 w-16 animate-pulse rounded bg-zinc-800/50" /></div>
        <div className="w-24 px-2"><div className="h-2 w-10 animate-pulse rounded bg-zinc-800/50" /></div>
        <div className="w-24 px-2"><div className="h-2 w-12 animate-pulse rounded bg-zinc-800/50" /></div>
        <div className="w-28 px-2"><div className="h-2 w-10 animate-pulse rounded bg-zinc-800/50" /></div>
        <div className="w-28 px-2"><div className="h-2 w-14 animate-pulse rounded bg-zinc-800/50" /></div>
        <div className="w-8" />
      </div>

      {/* Rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center border-b border-white/[0.03] px-5"
          style={{ height: 40, opacity: 1 - i * 0.06 }}
        >
          <div className="w-8 flex items-center justify-center">
            <div className="h-[6px] w-[6px] animate-pulse rounded-full bg-zinc-800" />
          </div>
          <div className="min-w-0 flex-1 px-2 flex items-center gap-2.5">
            <div className="h-6 w-6 animate-pulse rounded-full bg-zinc-800/60" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-2 w-36 animate-pulse rounded bg-zinc-900/40" />
            </div>
          </div>
          <div className="w-24 px-2"><div className="h-2.5 w-12 animate-pulse rounded bg-zinc-900/40" /></div>
          <div className="w-24 px-2"><div className="h-2.5 w-14 animate-pulse rounded bg-zinc-900/40" /></div>
          <div className="w-28 px-2 flex gap-1">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-4 w-4 animate-pulse rounded bg-zinc-900/30" />
            ))}
          </div>
          <div className="w-28 px-2"><div className="h-2 w-16 animate-pulse rounded bg-zinc-900/40" /></div>
          <div className="w-8" />
        </div>
      ))}
    </div>
  );
}
