"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";
import { useOnboardingStore, getStepProgress } from "@/lib/onboarding-store";

const slideVariants = {
  enter: {
    x: 40,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: -40,
    opacity: 0,
    scale: 0.97,
  },
};

export function OnboardingLayout({
  children,
  stepKey,
}: {
  children: ReactNode;
  stepKey: string;
}) {
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const progress = getStepProgress(currentStep);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)]">
      {/* Noise grain — standardized opacity */}
      <div className="stealth-noise fixed" />

      {/* Atmospheric glow — system boot ambience */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[var(--brand)] opacity-[0.03] blur-[200px]" />
      </div>

      {/* Progress bar — thin gradient line at top */}
      <div className="fixed top-0 right-0 left-0 z-40 h-px bg-[rgba(255,255,255,0.06)]">
        <motion.div
          className="h-full bg-gradient-to-r from-white/60 via-white/40 to-white/20"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      {/* Logo */}
      <div className="fixed top-6 left-6 z-40 flex items-center gap-2.5">
        <img
          src="/logos/logo-dark-streamline.png"
          alt="iWorkr"
          className="h-6 w-6 object-contain"
        />
      </div>

      {/* Step counter */}
      <div className="fixed top-6 right-6 z-40">
        <span className="font-mono text-[11px] tracking-wider text-zinc-600">
          {currentStep.toUpperCase().replace("-", " ")}
        </span>
      </div>

      {/* Content area */}
      <div className="relative z-10 w-full max-w-[600px] px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepKey}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Keyboard hints */}
      <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <kbd className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            Enter
          </kbd>
          to continue
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <kbd className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            Tab
          </kbd>
          to navigate
        </span>
      </div>
    </div>
  );
}
