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
    "bg-white text-black hover:bg-zinc-200 border border-transparent",
  secondary:
    "bg-transparent text-zinc-100 border border-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.05)]",
  ghost:
    "bg-transparent text-zinc-400 hover:text-zinc-100 border border-transparent",
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
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={baseClasses}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={baseClasses}
    >
      {children}
    </motion.button>
  );
}
