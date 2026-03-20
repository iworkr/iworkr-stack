export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-36 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-52 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-[7.25rem] rounded-lg bg-white/[0.04] animate-pulse"
              />
            ))}
            <div className="h-9 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
              <div className="flex items-baseline gap-2">
                <div className="h-7 w-24 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-10 rounded bg-white/[0.04] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-44 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-2">
            <div className="mb-4 h-3 w-32 rounded bg-white/[0.04] animate-pulse" />
            <div className="flex h-[calc(100%-1.75rem)] items-end gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-white/[0.06] animate-pulse"
                  style={{ height: `${28 + ((i * 7) % 48)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="h-44 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-4 h-3 w-28 rounded bg-white/[0.04] animate-pulse" />
            <div className="mx-auto mt-2 h-28 w-28 rounded-full border-[10px] border-white/[0.06] bg-white/[0.02] animate-pulse" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-3 w-40 rounded bg-white/[0.04] animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-white/[0.04] py-3"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-48 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-32 rounded bg-white/[0.04] animate-pulse" />
              </div>
              <div className="h-4 w-16 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-5 w-14 shrink-0 rounded-full bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
