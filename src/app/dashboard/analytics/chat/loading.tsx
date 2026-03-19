export default function PanopticonChatLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[#050505]">
      <aside className="w-[260px] shrink-0 border-r border-white/[0.06] bg-[#0A0A0A] animate-pulse">
        <div className="p-3 border-b border-white/[0.06]">
          <div className="h-9 bg-white/[0.04] rounded-lg" />
        </div>
        <div className="p-2 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/[0.02] rounded-lg" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <div className="h-5 w-40 bg-white/[0.04] rounded" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-16 h-16 bg-white/[0.03] rounded-2xl animate-pulse" />
        </div>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto h-12 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
