export default function SettingsLoading() {
  return (
    <div className="h-full p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg skeleton-shimmer" />
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
            <div className="h-10 w-10 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-3 w-48 rounded skeleton-shimmer" />
            </div>
            <div className="h-9 w-20 rounded-lg skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
