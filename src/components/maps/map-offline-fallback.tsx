"use client";

/**
 * Project Dark Earth — Fallback when the map cannot load (missing key, API error).
 * Do NOT render the Google iframe when this is shown.
 * PRD: bg-zinc-950, border border-white/5, "Map Offline" in JetBrains Mono.
 */
export function MapOfflineFallback({
  className = "",
  message = "Map Offline",
  subtext,
}: {
  className?: string;
  message?: string;
  subtext?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center border border-white/5 bg-zinc-950 font-mono ${className}`}
    >
      <p className="text-center text-sm text-zinc-500">{message}</p>
      {subtext && (
        <p className="mt-1 text-center text-xs text-zinc-600">{subtext}</p>
      )}
    </div>
  );
}
