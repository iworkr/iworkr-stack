export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-lg border-2 border-zinc-800" />
          <div className="absolute inset-0 animate-spin rounded-lg border-2 border-transparent border-t-white" />
        </div>
        <p className="text-xs text-zinc-500 tracking-wider uppercase">Loading</p>
      </div>
    </div>
  );
}
