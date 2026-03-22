/**
 * @component SpotlightButton
 * @status COMPLETE
 * @description Animated CTA button with hover spotlight effect and multiple variant styles
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { type ReactNode } from "react";

interface SpotlightButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "brand";
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
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
  brand:
    "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] border border-transparent",
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
  style,
  href,
  onClick,
}: SpotlightButtonProps) {
  const baseClasses = `inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`;
  const mergedStyle: React.CSSProperties = { borderRadius: "var(--radius-button)", ...style };

  if (href) {
    const isInternal = href.startsWith("/");

    if (isInternal) {
      return (
        <Link href={href} className={baseClasses} style={mergedStyle}>
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
        style={mergedStyle}
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
      style={mergedStyle}
    >
      {children}
    </motion.button>
  );
}
