"use client";

import type { Priority } from "@/lib/data";

const icons: Record<Priority, { color: string; path: string }> = {
  urgent: {
    color: "text-red-400",
    path: "M12 2L2 22h20L12 2zm0 6v6m0 4h.01", // warning triangle
  },
  high: {
    color: "text-orange-400",
    path: "M12 19V5m0 0l-4 4m4-4l4 4", // arrow up
  },
  medium: {
    color: "text-yellow-500/70",
    path: "M5 12h14", // dash
  },
  low: {
    color: "text-[rgba(0,230,118,0.6)]",
    path: "M12 5v14m0 0l-4-4m4 4l4-4", // arrow down
  },
  none: {
    color: "text-zinc-600",
    path: "M5 12h14",
  },
};

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const { color } = icons[priority];

  if (priority === "urgent") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <path d="M8 1L1 14h14L8 1z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
      </svg>
    );
  }

  if (priority === "high") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <path d="M8 12V4m0 0L5 7m3-3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (priority === "low") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
        <path d="M8 4v8m0 0l3-3m-3 3L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // medium / none
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={color}>
      <path d="M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
