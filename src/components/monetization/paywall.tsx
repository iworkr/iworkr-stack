"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Check,
  ArrowRight,
  Sparkles,
  Loader2,
  Zap,
  BarChart3,
  Shield,
  Plug,
  FileText,
  Bot,
  Globe,
  Key,
  Download,
  Users,
  X,
  Crown,
} from "lucide-react";
import { useState } from "react";
import type { GatedFeature, FeatureConfig } from "./feature-gate";

/* ── Feature icon map ──────────────────────────────────── */

const featureIcons: Record<GatedFeature, typeof Zap> = {
  automations: Zap,
  integrations: Plug,
  custom_forms: FileText,
  ai_phone_agent: Bot,
  multi_branch: Globe,
  api_access: Key,
  sso: Shield,
  analytics: BarChart3,
  unlimited_seats: Users,
  export: Download,
};

/* ── Plan display names ────────────────────────────────── */

const planNames: Record<string, string> = {
  starter: "Starter",
  pro: "Standard",
  business: "Enterprise",
};

/* ── Animated Orb (Lottie-style CSS) ───────────────────── */

function AnimatedOrb({ feature }: { feature: GatedFeature }) {
  const Icon = featureIcons[feature] || Sparkles;
  return (
    <div className="relative mb-8 flex items-center justify-center">
      {/* Outer pulse */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.05, 0.15] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute h-40 w-40 rounded-full bg-[#00E676]"
      />
      {/* Middle ring */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.08, 0.2] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        className="absolute h-28 w-28 rounded-full bg-[#00E676]"
      />
      {/* Inner glow */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute h-20 w-20 rounded-full bg-gradient-to-br from-[#00E676]/30 to-emerald-600/20 blur-sm"
      />
      {/* Icon */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00E676]/20 bg-black/80 shadow-[0_0_40px_-8px_rgba(0,230,118,0.3)]"
      >
        <Icon size={28} className="text-[#00E676]" />
      </motion.div>
    </div>
  );
}

/* ── Main Paywall ──────────────────────────────────────── */

interface PaywallProps {
  feature: GatedFeature;
  config: FeatureConfig;
  currentPlan: string;
  variant: "full_page" | "modal" | "banner";
  onClose?: () => void;
}

export function Paywall({ feature, config, currentPlan, variant, onClose }: PaywallProps) {
  if (variant === "full_page") return <FullPagePaywall feature={feature} config={config} />;
  if (variant === "modal") return <ModalPaywall feature={feature} config={config} onClose={onClose} />;
  if (variant === "banner") return <BannerPaywall feature={feature} config={config} />;
  return null;
}

/* ── Variant A: Full Page Block ────────────────────────── */

function FullPagePaywall({ feature, config }: { feature: GatedFeature; config: FeatureConfig }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = () => {
    setLoading(true);
    window.location.href = "/settings/billing";
  };

  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-6">
      {/* Blurred background tease */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        {/* Faint grid lines to suggest complex UI underneath */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex max-w-md flex-col items-center text-center"
      >
        <AnimatedOrb feature={feature} />

        <h1 className="text-3xl font-medium tracking-tight text-[#EDEDED]">
          Unlock {config.label}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">
          {config.description}
        </p>

        {/* Benefits */}
        <div className="mt-8 w-full space-y-3">
          {config.benefits.map((b) => (
            <motion.div
              key={b}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(0,230,118,0.1)]">
                <Check size={10} className="text-[#00E676]" />
              </div>
              <span className="text-[14px] text-zinc-300">{b}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          onClick={handleUpgrade}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-10 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E676] to-emerald-600 px-6 py-3.5 text-[14px] font-semibold text-black shadow-[0_0_30px_-5px_rgba(0,230,118,0.4)] transition-all hover:shadow-[0_0_40px_-5px_rgba(0,230,118,0.5)] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={16} />
              Upgrade to {planNames[config.requiredPlan] || "Pro"}
              <ArrowRight size={14} />
            </>
          )}
        </motion.button>

        <p className="mt-3 text-[11px] text-zinc-600">
          Powered by Polar. Cancel anytime. 14-day free trial included.
        </p>
      </motion.div>
    </div>
  );
}

/* ── Variant B: Feature Intercept Modal ────────────────── */

function ModalPaywall({
  feature,
  config,
  onClose,
}: {
  feature: GatedFeature;
  config: FeatureConfig;
  onClose?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const Icon = featureIcons[feature] || Sparkles;

  const handleUpgrade = () => {
    setLoading(true);
    window.location.href = "/settings/billing";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a]"
        >
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00E676]/30 to-transparent" />

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <X size={16} />
            </button>
          )}

          <div className="flex flex-col items-center px-8 pb-8 pt-10 text-center">
            {/* Icon */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00E676]/20 bg-[rgba(0,230,118,0.06)] shadow-[0_0_30px_-8px_rgba(0,230,118,0.2)]"
            >
              <Icon size={24} className="text-[#00E676]" />
            </motion.div>

            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
              <Crown size={9} /> PRO FEATURE
            </span>

            <h2 className="text-xl font-medium tracking-tight text-[#EDEDED]">
              {config.label} is a {planNames[config.requiredPlan]} feature
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
              {config.description}
            </p>

            {/* Benefits */}
            <div className="mt-6 w-full space-y-2">
              {config.benefits.map((b) => (
                <div key={b} className="flex items-center gap-2 text-left">
                  <Check size={11} className="shrink-0 text-[#00E676]" />
                  <span className="text-[12px] text-zinc-400">{b}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E676] to-emerald-600 py-3 text-[13px] font-semibold text-black shadow-[0_0_20px_-5px_rgba(0,230,118,0.3)] transition-all hover:shadow-[0_0_30px_-5px_rgba(0,230,118,0.4)] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  Unlock {config.label}
                  <ArrowRight size={13} />
                </>
              )}
            </button>

            <p className="mt-2.5 text-[10px] text-zinc-700">
              14-day free trial · Cancel anytime
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Variant C: Usage Cap Banner ───────────────────────── */

function BannerPaywall({ feature, config }: { feature: GatedFeature; config: FeatureConfig }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = () => {
    setLoading(true);
    window.location.href = "/settings/billing";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-xl border border-amber-500/15 bg-gradient-to-r from-amber-500/[0.04] to-[#00E676]/[0.04]"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/10">
            <Lock size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-zinc-200">
              {config.label} — Limit Reached
            </p>
            <p className="text-[11px] text-zinc-500">
              {config.description}
            </p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00E676] to-emerald-600 px-4 py-2 text-[12px] font-semibold text-black transition-all hover:shadow-[0_0_20px_-5px_rgba(0,230,118,0.3)] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <>
              Upgrade
              <ArrowRight size={12} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Standalone PaywallModal (for feature intercepts) ──── */

export { ModalPaywall };
