"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { type ReactNode, useRef, type MouseEvent } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  spotlightSize?: number;
  as?: "div" | "article";
}

export function GlassCard({
  children,
  className = "",
  spotlightSize = 350,
  as = "div",
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  function handleMouseMove(e: MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  const MotionTag = as === "article" ? motion.article : motion.div;

  return (
    <MotionTag
      ref={ref}
      onMouseMove={handleMouseMove}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={`group relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-[border-color] duration-200 hover:border-white/10 ${className}`}
    >
      {/* Spotlight */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${spotlightSize}px circle at ${springX.get()}px ${springY.get()}px, var(--subtle-bg-hover), transparent 80%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </MotionTag>
  );
}
