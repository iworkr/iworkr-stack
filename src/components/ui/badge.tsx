"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Badge({ children, className = "", glow = false }: BadgeProps) {
  return (
    <motion.span
      whileHover={glow ? { boxShadow: "0 0 20px -8px rgba(0, 230, 118, 0.15)" } : {}}
      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-1.5 text-sm text-[var(--text-muted)] backdrop-blur-md transition-all duration-200 hover:border-[var(--card-border-hover)] hover:text-[var(--text-primary)] ${className}`}
    >
      {children}
    </motion.span>
  );
}
