export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-6 w-32 rounded skeleton-shimmer" />
          <div className="h-5 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 border-b border-white/[0.04] px-6 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-14 rounded skeleton-shimmer" />
            <div className="h-5 w-6 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-white/[0.04] px-6 py-2.5">
        <div className="w-8" />
        {["w-40", "w-36", "w-24", "w-20", "w-28", "w-16"].map((w, i) => (
          <div key={i} className={`${w} h-2.5 rounded skeleton-shimmer`} />
        ))}
      </div>

      {/* Table rows */}
      <div className="flex-1 overflow-hidden px-0">
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/[0.03] px-6 py-3"
            style={{ opacity: 1 - i * 0.06 }}
          >
            <div className="w-8"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
            <div className="flex w-40 items-center gap-3">
              <div className="h-8 w-8 rounded-full skeleton-shimmer" />
              <div className="space-y-1">
                <div className="h-3 w-24 rounded skeleton-shimmer" />
                <div className="h-2.5 w-32 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="w-36"><div className="h-3 w-20 rounded skeleton-shimmer" /></div>
            <div className="w-24"><div className="h-5 w-16 rounded-full skeleton-shimmer" /></div>
            <div className="w-20"><div className="h-3 w-14 rounded skeleton-shimmer" /></div>
            <div className="w-28"><div className="h-3 w-20 rounded skeleton-shimmer" /></div>
            <div className="w-16"><div className="flex gap-0.5">{[1,2,3].map(n => <div key={n} className="h-1.5 w-1.5 rounded-full skeleton-shimmer" />)}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
