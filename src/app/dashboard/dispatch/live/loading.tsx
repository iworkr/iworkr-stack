export default function DispatchLiveLoading() {
  return (
    <div className="flex h-full bg-[#050505]">
      <div className="flex-1 flex flex-col border-r border-white/[0.06]">
        <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-52 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-1.5">
                <div className="h-2.5 w-10 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-5 w-8 rounded bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
      <div className="w-[420px] shrink-0 bg-[#0A0A0A]">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="h-4 w-32 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-white/[0.04] animate-pulse" style={{ width: `${60 + Math.random() * 35}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
