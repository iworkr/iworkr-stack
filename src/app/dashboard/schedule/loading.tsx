export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-5">
          <div className="h-5 w-[200px] rounded skeleton-shimmer" />
          <div className="h-6 w-12 rounded-md skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-lg p-0.5">
            {["w-10", "w-12", "w-14"].map((w, i) => (
              <div key={i} className={`h-7 ${w} rounded-md skeleton-shimmer`} />
            ))}
          </div>
          <div className="h-7 w-24 rounded-md skeleton-shimmer" />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-1 overflow-hidden border-t border-white/[0.04]">
        <div className="flex flex-1 flex-col">
          {/* Hour headers */}
          <div className="flex border-b border-white/[0.03]" style={{ paddingLeft: 220 }}>
            <div className="flex gap-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex w-[120px] shrink-0 items-center justify-center border-l border-white/[0.04] py-2.5">
                  <div className="h-3 w-10 rounded skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>

          {/* Technician rows */}
          <div className="flex-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex border-b border-white/[0.03]" style={{ opacity: 1 - i * 0.08 }}>
                <div className="flex shrink-0 items-center gap-3 border-r border-white/[0.04] px-4" style={{ width: 220, height: 88 }}>
                  <div className="h-9 w-9 rounded-full skeleton-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded skeleton-shimmer" />
                    <div className="h-2 w-14 rounded skeleton-shimmer" />
                    <div className="h-[3px] w-full rounded-full skeleton-shimmer" />
                  </div>
                </div>
                <div className="relative flex-1" style={{ height: 88 }}>
                  {i < 5 && (
                    <div
                      className="absolute top-2 rounded-lg skeleton-shimmer"
                      style={{
                        left: `${8 + i * 12}%`,
                        width: `${18 + (i * 7) % 20}%`,
                        height: 88 - 16,
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
