"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { getDashboardPath } from "@/lib/hooks/use-dashboard-path";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      {/* Noise grain — standardized */}
      <div className="stealth-noise fixed" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md text-center"
      >
        {/* Animated orbital ring */}
        <div className="relative mx-auto mb-8 h-28 w-28">
          {/* Outer ring */}
          <div className="absolute inset-0 animate-orbit rounded-full border border-white/[0.04]" />
          {/* Inner ring */}
          <div className="absolute inset-3 animate-orbit-reverse rounded-full border border-emerald-500/10" />
          {/* Orbiting dot */}
          <div className="absolute inset-0 animate-orbit">
            <div className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500/60" />
          </div>
          {/* Center icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
              <Compass size={24} className="text-zinc-500" />
            </div>
          </motion.div>
          {/* Signal pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 animate-signal-pulse rounded-2xl border border-emerald-500/20" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="mb-2 font-mono text-[11px] font-medium tracking-widest text-zinc-700 uppercase">
            404 &mdash; Signal Lost
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Page not found
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-zinc-500">
            This page may have been moved, deleted, or never existed. Check the URL or return to safety.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <Link
            href={getDashboardPath()}
            className="btn-micro inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-all hover:bg-zinc-200"
          >
            <ArrowLeft size={14} />
            Return to Command Center
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
