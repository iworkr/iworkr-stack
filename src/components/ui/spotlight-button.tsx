"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type ReactNode } from "react";

interface SpotlightButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
  onClick?: () => void;
}

const variants = {
  primary:
    "bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90 border border-transparent",
  secondary:
    "bg-transparent text-[var(--text-primary)] border border-[var(--card-border)] hover:border-[var(--card-border-hover)] hover:bg-[var(--subtle-bg)]",
  ghost:
    "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent",
};

const sizes = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

export function SpotlightButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href,
  onClick,
}: SpotlightButtonProps) {
  const baseClasses = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    const isInternal = href.startsWith("/");

    if (isInternal) {
      return (
        <Link href={href} className={baseClasses}>
          {children}
        </Link>
      );
    }

    return (
      <motion.a
        href={href}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        className={baseClasses}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className={baseClasses}
    >
      {children}
    </motion.button>
  );
}
