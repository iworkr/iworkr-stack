"use client";

import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { type ReactNode, useCallback } from "react";

interface WidgetShellProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  header?: ReactNode;
  action?: ReactNode;
}

export function WidgetShell({
  children,
  className = "",
  delay = 0,
  header,
  action,
}: WidgetShellProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlightBg = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.035), transparent 80%)`;
  const borderGlow = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(16,185,129,0.15), transparent 70%)`;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handleMouseMove}
      className={`group/widget relative flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-500 ${className}`}
      style={{ borderRadius: 16 }}
    >
      {/* Outer border glow — only on hover, emerald */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover/widget:opacity-100"
        style={{ background: borderGlow }}
      />

      {/* Card body */}
      <div className="relative z-[1] flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.04] bg-zinc-900/40 backdrop-blur-xl transition-[border-color,box-shadow] duration-500 group-hover/widget:border-white/[0.08] group-hover/widget:shadow-2xl group-hover/widget:shadow-black/40">
        {/* Cursor spotlight fill */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover/widget:opacity-100"
          style={{ background: spotlightBg }}
        />

        {/* Noise texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px",
          }}
        />

        {header && (
          <div className="relative z-10 flex items-center justify-between border-b border-white/[0.03] px-5 py-3">
            {header}
            {action && (
              <div className="opacity-0 transition-opacity duration-300 group-hover/widget:opacity-100">
                {action}
              </div>
            )}
          </div>
        )}
        <div className="relative z-10 flex-1 overflow-auto">{children}</div>
      </div>
    </motion.div>
  );
}

export function WidgetSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/[0.04] bg-zinc-900/40 backdrop-blur-xl ${className}`}
    >
      <div className="relative overflow-hidden p-6">
        <div className="h-3 w-20 rounded-md bg-zinc-800/40" />
        <div className="mt-4 h-7 w-28 rounded-md bg-zinc-800/30" />
        <div className="mt-3 h-2.5 w-16 rounded-md bg-zinc-800/20" />
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
      </div>
    </div>
  );
}
