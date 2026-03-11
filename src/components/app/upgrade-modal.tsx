"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  ArrowRight,
  Sparkles,
  Zap,
  Crown,
  Shield,
  Star,
} from "lucide-react";
import { useUpgradeModal } from "@/lib/upgrade-modal-store";
import { useBillingStore } from "@/lib/billing-store";
import { PLANS, type PlanDefinition } from "@/lib/plans";
import { useRouter } from "next/navigation";

const paidPlans = PLANS.filter((p) => p.key !== "free");

const PLAN_ICONS: Record<string, typeof Zap> = {
  starter: Zap,
  pro: Crown,
  business: Star,
};

/* ── Monthly / Yearly Toggle ──────────────────────────── */

function BillingToggle({
  isYearly,
  onChange,
}: {
  isYearly: boolean;
  onChange: (yearly: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
      <button
        onClick={() => onChange(false)}
        className={`relative rounded-full px-4 py-1.5 text-[12px] font-medium transition-all duration-200 ${
          !isYearly
            ? "bg-white text-black shadow-sm"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange(true)}
        className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium transition-all duration-200 ${
          isYearly
            ? "bg-white text-black shadow-sm"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        Yearly
        <span
          className={`text-[9px] font-semibold ${
            isYearly ? "text-emerald-700" : "text-emerald-500"
          }`}
        >
          -20%
        </span>
      </button>
    </div>
  );
}

/* ── Plan Card ────────────────────────────────────────── */

function PlanCard({
  plan,
  isYearly,
  isCurrent,
  isRecommended,
  index,
  onSelect,
}: {
  plan: PlanDefinition;
  isYearly: boolean;
  isCurrent: boolean;
  isRecommended: boolean;
  index: number;
  onSelect: (plan: PlanDefinition) => void;
}) {
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const Icon = PLAN_ICONS[plan.key] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex flex-col rounded-xl border p-5 transition-all duration-200 ${
        isRecommended
          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1]"
      }`}
    >
      {/* Recommended glow line */}
      {isRecommended && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      )}

      {/* Badge */}
      {isRecommended && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-2.5 left-1/2 -translate-x-1/2"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
            <Sparkles size={8} />
            Most popular
          </span>
        </motion.div>
      )}

      {/* Plan header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
            isRecommended
              ? "border-emerald-500/20 bg-emerald-500/10"
              : "border-white/[0.06] bg-white/[0.03]"
          }`}
        >
          <Icon
            size={14}
            className={isRecommended ? "text-emerald-400" : "text-zinc-400"}
          />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-white">{plan.name}</h3>
          <p className="text-[10px] text-zinc-600">{plan.description}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[11px] text-zinc-500">$</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={price}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="text-[28px] font-semibold tabular-nums tracking-tight text-white"
            >
              {price}
            </motion.span>
          </AnimatePresence>
          <span className="text-[11px] text-zinc-500">/mo</span>
        </div>
        {isYearly && (
          <p className="mt-0.5 text-[10px] text-zinc-600">
            ${price * 12}/yr · Billed annually
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mb-5 flex-1 space-y-2">
        {plan.features.slice(0, 6).map((feature) => (
          <div key={feature} className="flex items-start gap-2">
            <Check
              size={11}
              className={`mt-0.5 shrink-0 ${
                isRecommended ? "text-emerald-500/70" : "text-zinc-600"
              }`}
            />
            <span className="text-[11px] leading-tight text-zinc-400">
              {feature}
            </span>
          </div>
        ))}
        {plan.features.length > 6 && (
          <p className="text-[10px] text-zinc-600 pl-[19px]">
            +{plan.features.length - 6} more
          </p>
        )}
      </div>

      {/* CTA */}
      {isCurrent ? (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] py-2.5 text-[12px] font-medium text-zinc-500">
          <Check size={12} />
          Current plan
        </div>
      ) : (
        <motion.button
          onClick={() => onSelect(plan)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-medium transition-all duration-200 ${
            isRecommended
              ? "bg-white text-black hover:bg-zinc-200"
              : "border border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06]"
          }`}
        >
          {plan.hasFreeTrial ? "Start 14-day trial" : "Get started"}
          <ArrowRight size={12} className="opacity-50" />
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Main Upgrade Modal ────────────────────────────────── */

export function UpgradeModal() {
  const { open, triggerFeature, triggerDescription, closeUpgrade } =
    useUpgradeModal();
  const { plan: currentPlan, planTier } = useBillingStore();
  // Effective plan key — use planTier which includes org fallback
  const effectivePlanKey = currentPlan.key !== "free" ? currentPlan.key : planTier || "free";
  const [isYearly, setIsYearly] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeUpgrade();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, closeUpgrade]);

  function handleSelectPlan(plan: PlanDefinition) {
    const interval = isYearly ? "yearly" : "monthly";
    closeUpgrade();
    router.push(`/checkout?plan=${plan.key}&interval=${interval}`);
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
            onClick={closeUpgrade}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[860px] max-h-[90vh] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0A0A0A] shadow-2xl"
            >
              {/* Top emerald accent line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

              {/* Noise overlay */}
              <div
                className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.012]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Radial glow behind cards */}
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />

              {/* Close button */}
              <button
                onClick={closeUpgrade}
                className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              >
                <X size={16} />
              </button>

              {/* Content */}
              <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                {/* Header */}
                <div className="mb-8 text-center">
                  {triggerFeature ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10"
                      >
                        <Sparkles size={18} className="text-emerald-400" />
                      </motion.div>
                      <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="text-[20px] font-semibold tracking-tight text-white"
                      >
                        Unlock {triggerFeature}
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="mt-1.5 text-[13px] text-zinc-500"
                      >
                        {triggerDescription ||
                          "Upgrade your plan to access this feature."}
                      </motion.p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"
                      >
                        <Crown size={18} className="text-zinc-300" />
                      </motion.div>
                      <motion.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="text-[20px] font-semibold tracking-tight text-white"
                      >
                        Upgrade your workspace
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="mt-1.5 text-[13px] text-zinc-500"
                      >
                        Choose the plan that fits your operations.
                      </motion.p>
                    </>
                  )}
                </div>

                {/* Billing Toggle */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mb-8 flex justify-center"
                >
                  <BillingToggle isYearly={isYearly} onChange={setIsYearly} />
                </motion.div>

                {/* Plan Cards Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {paidPlans.map((plan, i) => (
                    <PlanCard
                      key={plan.key}
                      plan={plan}
                      isYearly={isYearly}
                      isCurrent={effectivePlanKey === plan.key}
                      isRecommended={plan.highlighted}
                      index={i}
                      onSelect={handleSelectPlan}
                    />
                  ))}
                </div>

                {/* Footer trust signals */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <Shield size={10} className="text-zinc-600" />
                    <span>Secured by Stripe</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <Zap size={10} className="text-zinc-600" />
                    <span>14-day free trial</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <Check size={10} className="text-zinc-600" />
                    <span>Cancel anytime</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
