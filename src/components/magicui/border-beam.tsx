/**
 * @component BorderBeam
 * @status COMPLETE
 * @description Renders an animated gradient beam effect along element borders
 * @lastAudit 2026-03-22
 */
"use client";

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
  reverse?: boolean;
  borderWidth?: number;
}

export const BorderBeam = ({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  reverse = false,
  borderWidth = 1,
}: BorderBeamProps) => {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      style={{ padding: borderWidth }}
    >
      <div
        className="absolute aspect-square animate-border-beam"
        style={{
          width: size,
          offsetPath: "rect(0 auto auto 0 round 12px)",
          background: `linear-gradient(to right, ${colorFrom}, ${colorTo})`,
          filter: `blur(calc(${size}px / 2))`,
          borderRadius: "50%",
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      />
    </div>
  );
};
