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
      whileHover={glow ? { boxShadow: "0 0 20px rgba(255,255,255,0.1)" } : {}}
      className={`inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-1.5 text-sm text-zinc-400 backdrop-blur-md transition-all duration-300 hover:border-[rgba(255,255,255,0.2)] hover:text-zinc-200 ${className}`}
    >
      {children}
    </motion.span>
  );
}
