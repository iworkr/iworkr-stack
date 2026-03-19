export default function ComplianceEngineLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-48 bg-white/5 rounded-lg" />
          <div className="h-4 w-72 bg-white/[0.03] rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-white/5 rounded-lg" />
          <div className="h-8 w-24 bg-white/5 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white/[0.03] border border-white/[0.04] rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.04] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
