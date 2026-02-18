"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Home, AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-6">
      {/* Noise grain */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md text-center"
      >
        {/* Animated warning */}
        <div className="relative mx-auto mb-8 h-28 w-28">
          <div className="absolute inset-0 animate-orbit rounded-full border border-rose-500/[0.06]" />
          <div className="absolute inset-3 animate-orbit-reverse rounded-full border border-rose-500/10" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/15 bg-rose-500/5">
              <AlertTriangle size={24} className="text-rose-400" />
            </div>
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 animate-signal-pulse rounded-2xl border border-rose-500/20" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="mb-2 font-mono text-[11px] font-medium tracking-widest text-zinc-700 uppercase">
            System Malfunction
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Something went wrong
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-zinc-500">
            An unexpected error occurred. Our systems have been notified and are working on a fix.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[10px] text-zinc-700">
              Error ID: {error.digest}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <button
            onClick={reset}
            className="btn-micro inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)]"
          >
            <RotateCcw size={14} />
            Try Again
          </button>
          <a
            href="/dashboard"
            className="btn-micro inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/[0.12] hover:text-white"
          >
            <Home size={14} />
            Command Center
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
