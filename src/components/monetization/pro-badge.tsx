"use client";

import { Crown, Lock } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Small "PRO" pill badge — shown inline in sidebar nav items, settings toggles, etc.
 */
export function ProBadge({ size = "sm" }: { size?: "sm" | "xs" }) {
  if (size === "xs") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-1.5 py-px text-[8px] font-semibold text-amber-400">
        PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
      <Crown size={7} />
      PRO
    </span>
  );
}

/**
 * Lock icon overlay — subtle indicator that a feature is gated.
 */
export function LockIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/10"
    >
      <Lock size={8} className="text-amber-400" />
    </motion.div>
  );
}
