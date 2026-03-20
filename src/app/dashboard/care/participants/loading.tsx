export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-56 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-[7.5rem] rounded-full bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div
                className="h-3 rounded bg-white/[0.04] animate-pulse"
                style={{ width: `${72 + i * 8}px` }}
              />
              <div className="h-6 w-[4.25rem] rounded bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden px-6 py-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/[0.04] py-3"
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 max-w-[14rem] rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 max-w-[10rem] rounded bg-white/[0.04] animate-pulse" />
            </div>
            <div className="hidden h-3 w-28 shrink-0 rounded bg-white/[0.04] animate-pulse sm:block" />
            <div className="h-6 w-[4.5rem] shrink-0 rounded-full bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
