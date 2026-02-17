export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <div className="h-5 w-20 animate-pulse rounded bg-zinc-900" />
          <div className="flex items-center gap-1">
            <div className="h-7 w-7 animate-pulse rounded-md bg-zinc-900" />
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-900" />
            <div className="h-7 w-7 animate-pulse rounded-md bg-zinc-900" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-zinc-900" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-900" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          {/* Hour headers */}
          <div className="flex border-b border-white/[0.04]" style={{ paddingLeft: 200 }}>
            <div className="flex gap-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex w-[120px] shrink-0 items-center justify-center border-l border-white/[0.04] py-2">
                  <div className="h-3 w-10 animate-pulse rounded bg-zinc-900" />
                </div>
              ))}
            </div>
          </div>

          {/* Technician rows */}
          <div className="flex-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex border-b border-white/[0.03]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Resource column */}
                <div className="flex h-[80px] w-[200px] shrink-0 items-center gap-3 border-r border-white/[0.05] px-4">
                  <div className="h-7 w-7 animate-pulse rounded-md bg-zinc-900" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 animate-pulse rounded bg-zinc-900" />
                    <div className="h-[3px] w-full animate-pulse rounded-full bg-zinc-900" />
                  </div>
                </div>
                {/* Timeline track */}
                <div className="relative flex-1" style={{ height: 80 }}>
                  {Math.random() > 0.3 && (
                    <div
                      className="absolute top-2 h-[calc(100%-16px)] animate-pulse rounded-md bg-zinc-900/50"
                      style={{
                        left: `${10 + Math.random() * 20}%`,
                        width: `${15 + Math.random() * 20}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
