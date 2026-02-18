export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-orbit rounded-full border border-white/[0.04]" />
          <div className="absolute inset-2 animate-orbit-reverse rounded-full border border-emerald-500/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/logos/logo-dark-streamline.png"
              alt="Loading"
              className="h-6 w-6 object-contain brightness-150"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <p className="font-mono text-[10px] tracking-widest text-zinc-700 uppercase">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
