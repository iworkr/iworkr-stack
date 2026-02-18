export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header skeleton — stealth nav */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-5">
          <div className="h-5 w-[200px] animate-pulse rounded bg-zinc-900/60" />
          <div className="h-6 w-12 animate-pulse rounded-md bg-zinc-900/40" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-lg p-0.5">
            {["w-10", "w-12", "w-14"].map((w, i) => (
              <div key={i} className={`h-7 ${w} animate-pulse rounded-md bg-zinc-900/40`} style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-900/40" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="flex flex-1 overflow-hidden border-t border-white/[0.04]">
        <div className="flex flex-1 flex-col">
          {/* Hour headers */}
          <div className="flex border-b border-white/[0.03]" style={{ paddingLeft: 220 }}>
            <div className="flex gap-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex w-[120px] shrink-0 items-center justify-center border-l border-white/[0.04] py-2.5">
                  <div className="h-3 w-10 animate-pulse rounded bg-zinc-900/50" style={{ animationDelay: `${i * 40}ms` }} />
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
              >
                {/* Resource column */}
                <div className="flex shrink-0 items-center gap-3 border-r border-white/[0.04] px-4" style={{ width: 220, height: 88 }}>
                  <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-900/60" style={{ animationDelay: `${i * 60}ms` }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-zinc-900/50" style={{ animationDelay: `${i * 60 + 20}ms` }} />
                    <div className="h-2 w-14 animate-pulse rounded bg-zinc-900/30" style={{ animationDelay: `${i * 60 + 40}ms` }} />
                    <div className="h-[3px] w-full animate-pulse rounded-full bg-zinc-900/40" style={{ animationDelay: `${i * 60 + 60}ms` }} />
                  </div>
                </div>
                {/* Timeline track */}
                <div className="relative flex-1" style={{ height: 88 }}>
                  {Math.random() > 0.3 && (
                    <div
                      className="absolute top-2 animate-pulse rounded-lg bg-zinc-900/30"
                      style={{
                        left: `${10 + Math.random() * 20}%`,
                        width: `${15 + Math.random() * 20}%`,
                        height: 88 - 16,
                        animationDelay: `${i * 80}ms`,
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
