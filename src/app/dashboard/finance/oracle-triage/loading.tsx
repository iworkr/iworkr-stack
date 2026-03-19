export default function OracleTriageLoading() {
  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-48 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-72 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-6 w-12 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
