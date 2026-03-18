export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Revenue banner */}
      <div className="border-b border-white/[0.04] px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-28 rounded skeleton-shimmer" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-24 rounded-md skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="flex items-end gap-8">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded skeleton-shimmer" />
            <div className="h-10 w-36 rounded skeleton-shimmer" />
            <div className="h-3 w-24 rounded skeleton-shimmer" />
          </div>
          <div className="flex-1 h-20 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
            <div className="h-3 w-16 mb-2 rounded skeleton-shimmer" />
            <div className="h-6 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Ledger rows */}
      <div className="flex-1 px-6">
        <div className="flex items-center gap-4 py-2.5 border-b border-white/[0.04]">
          {["w-8", "w-24", "w-40", "w-24", "w-20", "w-16", "w-20"].map((w, i) => (
            <div key={i} className={`${w} h-2.5 rounded skeleton-shimmer`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-white/[0.03]" style={{ opacity: 1 - i * 0.06 }}>
            <div className="w-8"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
            <div className="w-24"><div className="h-3 w-16 rounded skeleton-shimmer" /></div>
            <div className="w-40"><div className="h-3 w-32 rounded skeleton-shimmer" /></div>
            <div className="w-24"><div className="h-3 w-16 rounded skeleton-shimmer" /></div>
            <div className="w-20"><div className="h-5 w-14 rounded-full skeleton-shimmer" /></div>
            <div className="w-16"><div className="h-3 w-12 rounded skeleton-shimmer" /></div>
            <div className="w-20"><div className="h-3 w-14 rounded skeleton-shimmer" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
