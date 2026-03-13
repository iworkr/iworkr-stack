/* ═══════════════════════════════════════════════════════════════════
   Project Panopticon — /olympus/health Loading Skeleton
   Terminal-aesthetic shimmer matching Obsidian Absolute design
   ═══════════════════════════════════════════════════════════════════ */

export default function HealthLoading() {
  return (
    <div className="flex h-full flex-col animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div>
          <div className="h-2.5 w-32 rounded bg-white/[0.04]" />
          <div className="mt-2 h-4 w-56 rounded bg-white/[0.04]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/[0.04]" />
          <div className="h-7 w-20 rounded-md bg-white/[0.04]" />
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="flex items-center gap-3 border-b border-white/[0.04] px-6 py-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center rounded-lg bg-white/[0.02] px-4 py-2.5 ring-1 ring-white/[0.04]">
            <div className="h-5 w-12 rounded bg-white/[0.04]" />
            <div className="mt-1 h-2 w-16 rounded bg-white/[0.03]" />
          </div>
        ))}
      </div>

      {/* 2-Pane Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Feed */}
        <div className="w-[420px] min-w-[420px] border-r border-white/[0.04]">
          <div className="flex items-center gap-2 border-b border-white/[0.03] px-3 py-2">
            <div className="h-7 flex-1 rounded-md bg-white/[0.03]" />
            <div className="h-7 w-24 rounded-md bg-white/[0.03]" />
            <div className="h-7 w-24 rounded-md bg-white/[0.03]" />
          </div>
          <div className="space-y-0">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="border-b border-white/[0.02] px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-12 rounded bg-white/[0.04]" />
                  <div className="h-3 w-32 rounded bg-white/[0.03]" />
                  <div className="ml-auto h-2.5 w-10 rounded bg-white/[0.03]" />
                </div>
                <div className="mt-1.5 h-2.5 w-48 rounded bg-white/[0.02]" />
                <div className="mt-1 h-2 w-24 rounded bg-white/[0.02]" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: empty state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-white/[0.02] ring-1 ring-white/[0.04]" />
            <div className="mt-4 h-3 w-24 rounded bg-white/[0.03] mx-auto" />
            <div className="mt-2 h-2.5 w-40 rounded bg-white/[0.02] mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
