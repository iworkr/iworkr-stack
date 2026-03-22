/**
 * @component FeatureGate
 * @status COMPLETE
 * @description Conditionally renders children based on plan entitlements, showing upgrade prompt for locked features
 * @lastAudit 2026-03-22
 */
"use client";

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Crown } from "lucide-react";
import { useBillingStore } from "@/lib/billing-store";
import { PLANS, type PlanDefinition } from "@/lib/plans";
import { useUpgradeModal } from "@/lib/upgrade-modal-store";

const PLAN_ORDER = ["free", "starter", "pro", "business"];

function meetsRequirement(current: string, required: string): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required);
}

function getRequiredPlan(tier: string): PlanDefinition {
  return PLANS.find((p) => p.key === tier) || PLANS[2];
}

interface FeatureGateProps {
  requiredTier: "starter" | "pro" | "business";
  children: ReactNode;
  featureTitle?: string;
  featureDescription?: string;
}

export function FeatureGate({
  requiredTier,
  children,
  featureTitle,
  featureDescription,
}: FeatureGateProps) {
  const { plan, planTier } = useBillingStore();
  const { openUpgrade } = useUpgradeModal();
  // Use planTier (which includes org fallback) if the plan key is free
  const currentTier = plan.key !== "free" ? plan.key : planTier || "free";

  if (meetsRequirement(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(requiredTier);
  const title = featureTitle || `${requiredPlan.name} Feature`;
  const description =
    featureDescription ||
    `Upgrade to ${requiredPlan.name} to unlock this feature and supercharge your operations.`;

  function handleUpgrade() {
    openUpgrade({
      plan: requiredTier,
      feature: title,
      description,
    });
  }

  return (
    <div className="relative h-full w-full min-h-[400px]">
      {/* Blurred preview content behind the gate */}
      <div className="pointer-events-none select-none blur-[6px] opacity-20 h-full">
        {children}
      </div>

      {/* Paywall overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
        {/* Dark scrim with noise */}
        <div className="absolute inset-0 bg-[var(--background)]/85 backdrop-blur-lg" />
        <div className="stealth-noise" />

        {/* Radial glow behind upgrade area */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 500,
            height: 400,
            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.05) 0%, transparent 65%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center text-center max-w-sm px-8 py-12"
        >
          {/* Icon with subtle pulse ring */}
          <div className="relative mb-6">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-2xl bg-[var(--brand)]/10"
              style={{ margin: "-8px" }}
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--brand)]/15 bg-[var(--brand)]/[0.06]" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
              <Lock className="h-5 w-5 text-zinc-400" />
            </div>
          </div>

          <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {requiredPlan.name} Plan
          </p>
          <h2 className="text-[18px] font-medium text-white tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 leading-relaxed max-w-xs">
            {description}
          </p>

          <motion.button
            onClick={handleUpgrade}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="stealth-btn-brand group mt-8 gap-2 px-6 py-2.5 text-[13px] shadow-[0_0_24px_-8px_rgba(16,185,129,0.2)] transition-all hover:shadow-[0_0_32px_-8px_rgba(16,185,129,0.3)]"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade to {requiredPlan.name}
            <ArrowRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>

          <p className="mt-4 text-[11px] text-zinc-600">
            {requiredPlan.hasFreeTrial
              ? `${requiredPlan.trialDays}-day free trial · No credit card required`
              : "No credit card required"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

interface SoftGateProps {
  requiredTier: "starter" | "pro" | "business";
  children: ReactNode;
  label?: string;
}

export function SoftGate({ requiredTier, children, label }: SoftGateProps) {
  const { plan, planTier } = useBillingStore();
  const { openUpgrade } = useUpgradeModal();
  const currentTier = plan.key !== "free" ? plan.key : planTier || "free";

  if (meetsRequirement(currentTier, requiredTier)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(requiredTier);
  const tierLabel = label || requiredPlan.name.toUpperCase();

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <div
        className="opacity-50 cursor-not-allowed pointer-events-none"
        aria-disabled="true"
      >
        {children}
      </div>

      <button
        onClick={() =>
          openUpgrade({
            plan: requiredTier,
            feature: `${requiredPlan.name} Feature`,
            description: `Upgrade to ${requiredPlan.name} to unlock this capability.`,
          })
        }
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
      >
        {tierLabel}
      </button>
    </div>
  );
}

interface PastDueBannerProps {
  orgId: string;
}

export function PastDueBanner({ orgId }: PastDueBannerProps) {
  const subscription = useBillingStore((s) => s.subscription);
  const [loading, setLoading] = useState(false);

  if (subscription?.status !== "past_due") return null;

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-rose-500/20 bg-rose-500/10">
      <p className="text-xs text-rose-500 font-medium">
        Your last payment failed. Please update your billing information to
        avoid service interruption.
      </p>
      <button
        onClick={openPortal}
        disabled={loading}
        className="shrink-0 rounded-md px-3 py-1 text-xs font-medium text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
      >
        {loading ? "Loading..." : "Update billing"}
      </button>
    </div>
  );
}
