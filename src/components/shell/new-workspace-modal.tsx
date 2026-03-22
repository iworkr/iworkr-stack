/**
 * @component NewWorkspaceModal
 * @status COMPLETE
 * @description Multi-step onboarding modal for creating a new workspace
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { useOnboardingStore, STEP_ORDER } from "@/lib/onboarding-store";
import { NewWorkspaceContext } from "@/lib/new-workspace-context";
import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { clearOrgCache } from "@/lib/hooks/use-org";

import { StepSector } from "@/components/onboarding/step-sector";
import { StepIdentity } from "@/components/onboarding/step-identity";
import { StepTrade } from "@/components/onboarding/step-trade";
import { StepTeam } from "@/components/onboarding/step-team";
import { StepTraining } from "@/components/onboarding/step-training";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepComplete } from "@/components/onboarding/step-complete";

const stepComponents: Record<string, React.ComponentType> = {
  sector: StepSector,
  identity: StepIdentity,
  trade: StepTrade,
  team: StepTeam,
  training: StepTraining,
  integrations: StepIntegrations,
  complete: StepComplete,
};

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0, scale: 0.97 },
};

interface NewWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewWorkspaceModal({ open, onClose }: NewWorkspaceModalProps) {
  const router = useRouter();
  const switchOrg = useAuthStore((s) => s.switchOrg);
  const refreshOrganizations = useAuthStore((s) => s.refreshOrganizations);
  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const industryType = useOnboardingStore((s) => s.industryType);
  const initialized = useRef(false);

  // Reset onboarding store when modal opens so we start fresh
  useEffect(() => {
    if (open && !initialized.current) {
      resetOnboarding();
      initialized.current = true;
    }
    if (!open) {
      initialized.current = false;
    }
  }, [open, resetOnboarding]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC key to close (only if not in a late step)
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && currentStep !== "complete") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, currentStep]);

  const handleComplete = useCallback(async (newOrgId: string) => {
    try {
      // refreshOrganizations was already called in StepComplete.handleEnter —
      // we only need to switch to the newly created org
      await switchOrg(newOrgId);
      clearOrgCache();

      // Update Supabase client header
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        // @ts-expect-error — internal header injection
        if (supabase.rest?.headers) {
          // @ts-expect-error — internal header injection
          supabase.rest.headers["x-active-workspace-id"] = newOrgId;
        }
      } catch { /* non-fatal */ }

      resetOnboarding();
      onClose();
      router.refresh();
      // Route to the correct sector dashboard for the new workspace
      const { getDashboardPath } = await import("@/lib/hooks/use-dashboard-path");
      router.push(getDashboardPath());
    } catch {
      // Graceful fallback
      resetOnboarding();
      onClose();
      router.refresh();
      const { getDashboardPath } = await import("@/lib/hooks/use-dashboard-path");
      router.push(getDashboardPath());
    }
  }, [switchOrg, resetOnboarding, onClose, router]);

  const handleClose = useCallback(() => {
    if (currentStep === "complete") return; // don't let them dismiss mid-completion
    resetOnboarding();
    onClose();
  }, [currentStep, resetOnboarding, onClose]);

  // Progress calculation (mirrors OnboardingLayout)
  const stepsForProgress = industryType
    ? STEP_ORDER.filter((s) => s !== "sector")
    : STEP_ORDER;
  const effectiveStep = currentStep === "sector" && industryType ? "identity" : currentStep;
  const stepIndex = stepsForProgress.indexOf(effectiveStep);
  const progress = ((Math.max(0, stepIndex) + 1) / stepsForProgress.length) * 100;
  const stepNumber = Math.max(0, stepIndex) + 1;
  const totalSteps = stepsForProgress.length;
  const isCare = industryType === "care";

  const StepComponent = stepComponents[currentStep] || StepSector;

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#050505]"
          style={{ isolation: "isolate" }}
        >
          {/* Noise grain */}
          <div className="stealth-noise fixed pointer-events-none" />

          {/* Atmospheric glow */}
          <div className="pointer-events-none fixed inset-0 z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.03] blur-[200px] bg-[var(--brand)]" />
          </div>

          {/* Vignette */}
          <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

          {/* Progress bar at top */}
          <div className="fixed top-0 right-0 left-0 z-40 h-px bg-[rgba(255,255,255,0.06)]">
            <motion.div
              className="h-full bg-gradient-to-r from-white/60 via-white/40 to-white/20"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Logo + care badge */}
          <div className="fixed top-6 left-6 z-40 flex items-center gap-2.5">
            <img
              src="/logos/logo-dark-streamline.png"
              alt="iWorkr"
              className="h-6 w-6 object-contain"
            />
            <span className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
              New Workspace
            </span>
            {isCare && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-400">
                care
              </span>
            )}
          </div>

          {/* Step counter + Close button */}
          <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-wider text-zinc-600">
              {stepNumber}/{totalSteps}
            </span>
            <span className="font-mono text-[11px] tracking-wider text-zinc-500">
              {currentStep.toUpperCase().replace("-", " ")}
            </span>
            {currentStep !== "complete" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleClose}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition-colors hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-zinc-200"
                title="Cancel"
              >
                <X size={14} />
              </motion.button>
            )}
          </div>

          {/* Content area — same as OnboardingLayout */}
          <div className="relative z-10 w-full max-w-[600px] px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <NewWorkspaceContext.Provider
                  value={{
                    isModal: true,
                    onComplete: handleComplete,
                    onClose: handleClose,
                  }}
                >
                  <StepComponent />
                </NewWorkspaceContext.Provider>
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
                Esc
              </kbd>
              to cancel
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
