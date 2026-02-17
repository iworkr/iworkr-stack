"use client";

/**
 * Reusable shimmer/skeleton primitives for loading states.
 * Drop these in wherever data hasn't loaded yet — they feel
 * smooth, branded, and avoid showing dummy data.
 */

interface ShimmerProps {
  className?: string;
}

/** Inline text shimmer — use in place of a text value */
export function Shimmer({ className = "h-3 w-20" }: ShimmerProps) {
  return (
    <span
      className={`relative inline-block overflow-hidden rounded bg-zinc-800/80 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
    </span>
  );
}

/** Circle shimmer — use for avatars */
export function ShimmerCircle({ className = "h-6 w-6" }: ShimmerProps) {
  return (
    <span
      className={`relative inline-block overflow-hidden rounded-full bg-zinc-800/80 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
    </span>
  );
}

/** Block shimmer — use for card areas */
export function ShimmerBlock({ className = "h-20 w-full" }: ShimmerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-zinc-800/60 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/20 to-transparent" />
    </div>
  );
}

/** Row of shimmer placeholders for a team member list */
export function ShimmerTeamRow() {
  return (
    <div className="flex items-center gap-2 px-2 py-[5px]">
      <ShimmerCircle className="h-5 w-5" />
      <Shimmer className="h-3 w-24" />
      <span className="ml-auto"><Shimmer className="h-2 w-10" /></span>
    </div>
  );
}
