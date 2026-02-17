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
  const spotlightBg = useMotionTemplate`radial-gradient(300px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.03), transparent 80%)`;

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handleMouseMove}
      className={`group/widget relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-[#0A0A0A] transition-all duration-300 hover:border-white/[0.1] ${className}`}
      style={{ borderRadius: 12 }}
    >
      {/* Cursor spotlight — ultra-subtle on hover */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover/widget:opacity-100"
        style={{ background: spotlightBg }}
      />

      {header && (
        <div className="relative z-10 flex items-center justify-between border-b border-white/[0.04] px-4 py-2.5">
          {header}
          {action && (
            <div className="opacity-0 transition-opacity duration-200 group-hover/widget:opacity-100">
              {action}
            </div>
          )}
        </div>
      )}
      <div className="relative z-10 flex-1 overflow-auto">{children}</div>
    </motion.div>
  );
}

export function WidgetSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/[0.05] bg-[#0A0A0A] ${className}`}
      style={{ borderRadius: 12 }}
    >
      <div className="relative overflow-hidden p-5">
        <div className="h-3 w-20 rounded-md bg-zinc-800/60" />
        <div className="mt-4 h-7 w-28 rounded-md bg-zinc-800/40" />
        <div className="mt-3 h-2.5 w-16 rounded-md bg-zinc-800/30" />
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
      </div>
    </div>
  );
}
