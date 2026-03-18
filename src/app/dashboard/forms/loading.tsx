export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-white/[0.05]">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            <div className="h-4 w-20 rounded-full skeleton-shimmer" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 rounded skeleton-shimmer" />
            <div className="h-7 w-7 rounded-md skeleton-shimmer" />
            <div className="h-7 w-24 rounded-md skeleton-shimmer" />
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-1 px-5 pb-1">
          {["w-20", "w-28", "w-24"].map((w, i) => (
            <div key={i} className={`h-3 ${w} rounded skeleton-shimmer`} style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </div>
      </div>

      {/* Blueprint card grid */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-950/40"
            style={{ aspectRatio: "3 / 4", animationDelay: `${i * 50}ms` }}
          >
            {/* Preview area */}
            <div className="flex items-center justify-center bg-[var(--surface-1)] p-4" style={{ height: "55%" }}>
              <div className="w-full max-w-[100px] rounded-lg border border-white/[0.04] bg-[var(--background)] p-3 space-y-1.5">
                <div className="h-1.5 w-[80%] rounded-full skeleton-shimmer" />
                <div className="h-1 w-full rounded-full skeleton-shimmer" />
                <div className="h-1 w-[70%] rounded-full skeleton-shimmer" />
                <div className="h-2 w-full rounded skeleton-shimmer" />
              </div>
            </div>
            {/* Body area */}
            <div className="p-3 space-y-2" style={{ height: "45%" }}>
              <div className="h-3 w-[70%] rounded skeleton-shimmer" />
              <div className="h-2 w-full rounded skeleton-shimmer" />
              <div className="h-2 w-[40%] rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
