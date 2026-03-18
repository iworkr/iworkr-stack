export default function Loading() {
  return (
    <div className="flex h-full bg-[var(--background)]">
      {/* Channel sidebar */}
      <div className="w-72 shrink-0 border-r border-white/[0.04]">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="h-4 w-24 rounded skeleton-shimmer mb-3" />
          <div className="h-8 w-full rounded-lg skeleton-shimmer" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03]" style={{ opacity: 1 - i * 0.07 }}>
            <div className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 w-24 rounded skeleton-shimmer" />
              <div className="h-2.5 w-4/5 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04]">
          <div className="h-8 w-8 rounded-full skeleton-shimmer" />
          <div className="h-4 w-28 rounded skeleton-shimmer" />
        </div>
        <div className="flex-1" />
        <div className="px-5 py-3 border-t border-white/[0.04]">
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
