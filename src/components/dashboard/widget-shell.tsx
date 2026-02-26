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
  const spotlightBg = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.03), transparent 80%)`;

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
      className={`group/widget relative flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-200 ${className}`}
      style={{ borderRadius: 16 }}
    >
      {/* Card body — Linear-style light cone */}
      <div
        className="widget-glass relative z-[1] flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 transition-[border-color,box-shadow] duration-200 group-hover/widget:border-white/10"
        style={{
          boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
          background: "radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%), #09090b",
        }}
      >
        {/* Hover light cone intensifier — shifts from 0.04 to 0.08 */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-200 group-hover/widget:opacity-100"
          style={{ background: "radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%)" }}
        />

        {/* Cursor spotlight — subtle on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-200 group-hover/widget:opacity-100"
          style={{ background: spotlightBg }}
        />

        {/* Noise texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px",
          }}
        />

        {header && (
          <div className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-3">
            {header}
            {action && (
              <div className="opacity-0 transition-opacity duration-200 group-hover/widget:opacity-100">
                {action}
              </div>
            )}
          </div>
        )}
        <div className="relative z-10 flex-1 overflow-auto scrollbar-none">{children}</div>
      </div>
    </motion.div>
  );
}

export function WidgetSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`widget-glass overflow-hidden rounded-2xl border border-white/5 ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)",
        background: "radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%), #09090b",
      }}
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
