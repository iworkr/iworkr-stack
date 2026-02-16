export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-lg border-2 border-zinc-800" />
          <div className="absolute inset-0 animate-spin rounded-lg border-2 border-transparent border-t-white" />
        </div>
        <p className="text-xs text-zinc-500 tracking-wider uppercase">Loading module</p>
      </div>
    </div>
  );
}
