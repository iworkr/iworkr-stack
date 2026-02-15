"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";

export function StepComplete() {
  const { companyName } = useOnboardingStore();
  const [entering, setEntering] = useState(false);

  const handleEnter = useCallback(() => {
    if (entering) return;
    setEntering(true);
    // Simulate entering workspace
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  }, [entering]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "a" || e.key === "A" || e.key === "Enter") {
        e.preventDefault();
        handleEnter();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleEnter]);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Pulse emanation */}
      <div className="relative mb-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            animate={{
              scale: [1, 3],
              opacity: [0.2, 0],
            }}
            transition={{
              duration: 3,
              delay: i * 1,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Center logo */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: 0.2,
            duration: 0.6,
            type: "spring",
            stiffness: 200,
          }}
          className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] backdrop-blur-sm"
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
              <span className="text-lg font-bold text-black">iW</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Status text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3"
      >
        {/* Operational status */}
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-500"
            />
          </span>
          <span className="font-mono text-xs tracking-wider text-emerald-400 uppercase">
            System Operational
          </span>
        </div>

        <h2 className="text-3xl font-medium tracking-tight text-zinc-100 md:text-4xl">
          {companyName || "Your workspace"} is ready.
        </h2>

        <p className="mx-auto max-w-sm text-sm text-zinc-500">
          All systems are calibrated. Your workspace is provisioned and
          operational. Welcome to iWorkr.
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mt-10"
      >
        {!entering ? (
          <div className="space-y-4">
            <button
              onClick={handleEnter}
              className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-all hover:bg-zinc-200"
            >
              Enter Workspace
              <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                A
              </kbd>
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <motion.div
              className="mx-auto h-px w-48 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ scaleX: [0, 1] }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
            <p className="font-mono text-xs tracking-wider text-zinc-500">
              Initializing dashboard...
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
