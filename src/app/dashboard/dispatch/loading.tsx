export default function Loading() {
  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 border-r border-white/[0.04] p-4 space-y-4">
        <div className="h-8 w-full rounded-lg skeleton-shimmer" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.04]" style={{ opacity: 1 - i * 0.1 }}>
              <div className="h-8 w-8 rounded-full skeleton-shimmer" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 rounded skeleton-shimmer" />
                <div className="h-2.5 w-16 rounded skeleton-shimmer" />
              </div>
              <div className="h-2 w-2 rounded-full skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 skeleton-shimmer rounded-none" />
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
