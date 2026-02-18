export default function DashboardLoading() {
  return (
    <div className="h-full p-6">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-20 rounded-md skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5">
            <div className="mb-3 h-3 w-16 rounded skeleton-shimmer" />
            <div className="mb-2 h-7 w-24 rounded skeleton-shimmer" />
            <div className="h-3 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5">
          <div className="mb-4 h-4 w-28 rounded skeleton-shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-2.5 w-1/2 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5">
          <div className="mb-4 h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-48 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
