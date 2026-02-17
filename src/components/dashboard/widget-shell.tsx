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
  const spotlightBg = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.04), transparent 80%)`;

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handleMouseMove}
      className={`group/widget relative flex h-full flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C0C] transition-all duration-300 hover:border-[rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.04)] ${className}`}
      style={{ borderRadius: 12 }}
    >
      {/* Cursor spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/widget:opacity-100"
        style={{ background: spotlightBg }}
      />

      {header && (
        <div className="relative z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5">
          {header}
          {action}
        </div>
      )}
      <div className="relative z-10 flex-1 overflow-auto">{children}</div>
    </motion.div>
  );
}

export function WidgetSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C0C] ${className}`}
      style={{ borderRadius: 12 }}
    >
      <div className="relative overflow-hidden p-4">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="mt-3 h-8 w-32 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-20 rounded bg-zinc-800" />
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-800/20 to-transparent" />
      </div>
    </div>
  );
}
