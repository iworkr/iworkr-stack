export default function Loading() {
  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 border-r border-white/[0.04]">
        {/* Search */}
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="h-8 w-full rounded-lg skeleton-shimmer" />
        </div>
        {/* Channel tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-white/[0.04]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-20 rounded-md skeleton-shimmer" />
          ))}
        </div>
        {/* Message list */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03]" style={{ opacity: 1 - i * 0.06 }}>
            <div className="h-10 w-10 shrink-0 rounded-full skeleton-shimmer" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 rounded skeleton-shimmer" />
                <div className="h-2.5 w-10 rounded skeleton-shimmer" />
              </div>
              <div className="h-2.5 w-4/5 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-2xl skeleton-shimmer mb-4" />
        <div className="h-4 w-40 rounded skeleton-shimmer mb-2" />
        <div className="h-3 w-56 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
