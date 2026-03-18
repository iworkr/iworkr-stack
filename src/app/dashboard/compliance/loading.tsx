export default function Loading() {
  return (
    <div className="h-full overflow-auto bg-[var(--background)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-40 rounded skeleton-shimmer" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-20 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="h-3 w-24 mb-3 rounded skeleton-shimmer" />
            <div className="h-10 w-20 mb-2 rounded skeleton-shimmer" />
            <div className="h-2 w-full rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div className="rounded-xl border border-white/[0.04]">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.04]">
          {["w-40", "w-24", "w-20", "w-28", "w-16"].map((w, i) => (
            <div key={i} className={`${w} h-2.5 rounded skeleton-shimmer`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.03]" style={{ opacity: 1 - i * 0.06 }}>
            <div className="w-40"><div className="h-3 w-28 rounded skeleton-shimmer" /></div>
            <div className="w-24"><div className="h-5 w-16 rounded-full skeleton-shimmer" /></div>
            <div className="w-20"><div className="h-3 w-14 rounded skeleton-shimmer" /></div>
            <div className="w-28"><div className="h-3 w-20 rounded skeleton-shimmer" /></div>
            <div className="w-16"><div className="h-4 w-4 rounded skeleton-shimmer" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
