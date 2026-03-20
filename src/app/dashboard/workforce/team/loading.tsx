export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-64 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-7 w-20 rounded bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden px-6 py-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/[0.04] py-3"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-52 rounded bg-white/[0.04] animate-pulse" />
            </div>
            <div className="h-6 w-24 shrink-0 rounded-md bg-white/[0.04] animate-pulse" />
            <div className="h-5 w-16 shrink-0 rounded-full bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
