"use client";

import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Lock,
  Check,
  ArrowRight,
  Sparkles,
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
  Clock,
  Cpu,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
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

/* ── Bento value props per feature ─────────────────────── */

const bentoPropsMap: Record<GatedFeature, { icon: typeof Zap; title: string; desc: string }[]> = {
  automations: [
    { icon: Zap, title: "Workflow Engine", desc: "Build if/then automations that run 24/7" },
    { icon: Clock, title: "Time Saved", desc: "Avg 20+ hours reclaimed per week" },
    { icon: Cpu, title: "Smart Triggers", desc: "SMS, email, and schedule-based triggers" },
    { icon: TrendingUp, title: "Scale", desc: "Handle 10x jobs without 10x effort" },
  ],
  integrations: [
    { icon: Plug, title: "Connect Tools", desc: "Stripe, Xero, Zapier, and more" },
    { icon: Layers, title: "Sync Data", desc: "Real-time two-way data sync" },
    { icon: Shield, title: "Secure", desc: "OAuth 2.0 encrypted connections" },
    { icon: TrendingUp, title: "Revenue", desc: "Auto-reconcile payments instantly" },
  ],
  custom_forms: [
    { icon: FileText, title: "Form Builder", desc: "Drag-and-drop with 15+ field types" },
    { icon: Shield, title: "Signatures", desc: "Legally binding digital signatures" },
    { icon: Download, title: "PDF Export", desc: "Branded exports and archival" },
    { icon: Layers, title: "Templates", desc: "Reusable inspection & safety forms" },
  ],
  ai_phone_agent: [
    { icon: Bot, title: "AI Answering", desc: "24/7 intelligent call handling" },
    { icon: Clock, title: "Auto Booking", desc: "Jobs created from phone calls" },
    { icon: TrendingUp, title: "Never Miss", desc: "Zero missed leads, ever" },
    { icon: Cpu, title: "Smart Routing", desc: "Route calls to the right team" },
  ],
  multi_branch: [
    { icon: Globe, title: "Locations", desc: "Manage all branches centrally" },
    { icon: BarChart3, title: "Per-Branch", desc: "Isolated reporting per location" },
    { icon: Users, title: "Unified Team", desc: "Cross-branch team visibility" },
    { icon: Layers, title: "Scale", desc: "Add locations as you grow" },
  ],
  api_access: [
    { icon: Key, title: "REST API", desc: "Full programmatic access" },
    { icon: Zap, title: "Webhooks", desc: "Real-time event subscriptions" },
    { icon: Shield, title: "Auth", desc: "API key + OAuth support" },
    { icon: Cpu, title: "Rate Limit", desc: "10,000 requests per minute" },
  ],
  sso: [
    { icon: Shield, title: "SAML 2.0", desc: "Enterprise SSO protocol" },
    { icon: Globe, title: "Google SSO", desc: "Google Workspace integration" },
    { icon: Users, title: "AD Sync", desc: "Active Directory provisioning" },
    { icon: Key, title: "Security", desc: "Enforce org-wide auth policies" },
  ],
  analytics: [
    { icon: BarChart3, title: "Forecasting", desc: "Revenue and pipeline predictions" },
    { icon: TrendingUp, title: "Productivity", desc: "Technician efficiency metrics" },
    { icon: Users, title: "Client LTV", desc: "Lifetime value tracking" },
    { icon: Layers, title: "Dashboards", desc: "Custom analytics views" },
  ],
  unlimited_seats: [
    { icon: Users, title: "Unlimited", desc: "Add your entire team" },
    { icon: Shield, title: "RBAC", desc: "Role-based access control" },
    { icon: Globe, title: "Cross-Branch", desc: "Team visibility everywhere" },
    { icon: TrendingUp, title: "Scale", desc: "Grow without per-seat costs" },
  ],
  export: [
    { icon: Download, title: "CSV & PDF", desc: "Export any dataset" },
    { icon: Clock, title: "Scheduled", desc: "Automated report delivery" },
    { icon: Layers, title: "Date Ranges", desc: "Custom period selections" },
    { icon: BarChart3, title: "Templates", desc: "Save export configurations" },
  ],
};

/* ── Circuit Board Hero (Lottie-style CSS) ────────────── */

function CircuitBoardHero({ feature, isHovered }: { feature: GatedFeature; isHovered: boolean }) {
  const Icon = featureIcons[feature] || Sparkles;

  return (
    <div className="relative mb-10 flex items-center justify-center" style={{ height: 160, width: 160 }}>
      {/* Central emerald glow — fades in first */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.05, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="absolute h-48 w-48 rounded-full bg-emerald-500 blur-3xl"
      />

      {/* Circuit grid — builds itself */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute inset-0"
      >
        {/* Horizontal lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={`h-${i}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 0.15 }}
            transition={{ duration: 0.4, delay: 0.4 + i * 0.06 }}
            className="absolute left-0 right-0 h-px origin-left bg-gradient-to-r from-transparent via-zinc-500 to-transparent"
            style={{ top: `${20 + i * 15}%` }}
          />
        ))}
        {/* Vertical lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={`v-${i}`}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 0.15 }}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.06 }}
            className="absolute top-0 bottom-0 w-px origin-top bg-gradient-to-b from-transparent via-zinc-500 to-transparent"
            style={{ left: `${20 + i * 15}%` }}
          />
        ))}
        {/* Node dots at intersections */}
        {[
          [20, 20], [50, 20], [80, 20],
          [35, 50], [65, 50],
          [20, 80], [50, 80], [80, 80],
        ].map(([x, y], i) => (
          <motion.div
            key={`n-${i}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2, delay: 0.7 + i * 0.04, type: "spring", stiffness: 400 }}
            className="absolute h-1 w-1 rounded-full bg-zinc-600"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          />
        ))}
        {/* Pulse paths — emerald traces that travel along circuit */}
        <motion.div
          animate={{ left: ["10%", "90%"] }}
          transition={{ duration: isHovered ? 1.2 : 3, repeat: Infinity, ease: "linear" }}
          className="absolute h-px w-6 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
          style={{ top: "50%" }}
        />
        <motion.div
          animate={{ top: ["10%", "90%"] }}
          transition={{ duration: isHovered ? 1.5 : 3.5, repeat: Infinity, ease: "linear", delay: 0.8 }}
          className="absolute w-px h-6 bg-gradient-to-b from-transparent via-emerald-500/60 to-transparent"
          style={{ left: "50%" }}
        />
      </motion.div>

      {/* Center icon — builds last */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.6, type: "spring", stiffness: 300 }}
        className="relative z-10"
      >
        <motion.div
          animate={isHovered ? { scale: [1, 1.05, 1] } : { scale: [1, 1.02, 1] }}
          transition={{ duration: isHovered ? 0.8 : 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0A0A0A] shadow-[0_0_30px_-8px_rgba(16,185,129,0.15)]"
        >
          <Icon size={24} strokeWidth={1.5} className="text-zinc-300" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── Bento Card ──────────────────────────────────────── */

function BentoCard({ icon: Icon, title, desc, index }: { icon: typeof Zap; title: string; desc: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 + index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col rounded-lg border border-white/[0.05] bg-zinc-900/40 p-4 transition-colors duration-200 hover:border-emerald-500/10 hover:bg-zinc-900/60"
    >
      <div className="mb-2.5 flex w-full justify-center">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/[0.04] bg-white/[0.02]">
          <Icon size={13} strokeWidth={1.5} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
        </div>
      </div>
      <h3 className="text-center text-[12px] font-medium text-zinc-200">{title}</h3>
      <p className="mt-0.5 text-center font-mono text-[10px] text-zinc-600">{desc}</p>
    </motion.div>
  );
}

/* ── Shimmer CTA Button ──────────────────────────────── */

function ShimmerButton({
  loading,
  onClick,
  label,
}: {
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={loading}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900 py-3 text-[13px] font-medium text-white transition-all duration-300 hover:border-emerald-500/20 hover:text-white disabled:opacity-60"
    >
      {/* Shimmer sweep on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-700 group-hover:translate-x-full">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      {loading ? (
        <motion.div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="h-4 w-4 rounded-full border border-zinc-600 border-t-emerald-400"
          />
          <span className="text-zinc-400">Processing…</span>
        </motion.div>
      ) : (
        <>
          {label}
          <ArrowRight size={13} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
        </>
      )}
    </motion.button>
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

/* ── Variant A: Full Page — "Stealth Luxury" ─────────── */

function FullPagePaywall({ feature, config }: { feature: GatedFeature; config: FeatureConfig }) {
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const bentoProps = bentoPropsMap[feature] || bentoPropsMap.automations;

  const handleUpgrade = () => {
    setLoading(true);
    window.location.href = "/settings/billing";
  };

  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 bg-[#050505]">
      {/* Central emerald glow (fades in first) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[400px] w-[400px] rounded-full bg-emerald-500/[0.04] blur-[100px]" />
      </motion.div>

      {/* Faint grid underlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex max-w-lg flex-col items-center text-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CircuitBoardHero feature={feature} isHovered={isHovered} />

        {/* Headline — staggered after hero */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl font-semibold tracking-tight text-white"
        >
          Scale with {config.label}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 max-w-sm text-[14px] leading-relaxed text-zinc-500"
        >
          {config.description}
        </motion.p>

        {/* Bento Grid */}
        <div className="mt-8 grid w-full grid-cols-2 gap-2">
          {bentoProps.map((prop, i) => (
            <BentoCard key={prop.title} icon={prop.icon} title={prop.title} desc={prop.desc} index={i} />
          ))}
        </div>

        {/* Ghost CTA */}
        <ShimmerButton
          loading={loading}
          onClick={handleUpgrade}
          label={`Upgrade to ${planNames[config.requiredPlan] || "Pro"}`}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-3 font-mono text-[10px] text-zinc-700"
        >
          Powered by Polar · Cancel anytime · 14-day free trial
        </motion.p>
      </div>
    </div>
  );
}

/* ── Variant B: Feature Intercept Modal ──────────────── */

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
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative mx-4 w-full max-w-md overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A]"
        >
          {/* Subtle emerald top line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            >
              <X size={14} />
            </button>
          )}

          <div className="flex flex-col items-center px-7 pb-7 pt-8 text-center">
            {/* Icon with circuit ring */}
            <div className="relative mb-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-8px] rounded-xl border border-dashed border-white/[0.05]"
              />
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0C0C0C]"
              >
                <Icon size={20} strokeWidth={1.5} className="text-zinc-400" />
              </motion.div>
            </div>

            <span className="mb-3 inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-2.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-500">
              <Crown size={8} /> {planNames[config.requiredPlan] || "Pro"} Feature
            </span>

            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Unlock {config.label}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
              {config.description}
            </p>

            {/* Benefits as check list */}
            <div className="mt-5 w-full space-y-2">
              {config.benefits.map((b, i) => (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="flex items-center gap-2.5 text-left"
                >
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/[0.08]">
                    <Check size={9} className="text-emerald-500" />
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">{b}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.button
              onClick={handleUpgrade}
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900 py-2.5 text-[12px] font-medium text-white transition-all duration-200 hover:border-emerald-500/20 disabled:opacity-60"
            >
              {loading ? (
                <motion.div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="h-3.5 w-3.5 rounded-full border border-zinc-600 border-t-emerald-400"
                  />
                  <span className="text-zinc-400">Processing…</span>
                </motion.div>
              ) : (
                <>
                  Unlock {config.label}
                  <ArrowRight size={12} className="text-zinc-500" />
                </>
              )}
            </motion.button>

            <p className="mt-2 font-mono text-[9px] text-zinc-700">
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
  const Icon = featureIcons[feature] || Lock;

  const handleUpgrade = () => {
    setLoading(true);
    window.location.href = "/settings/billing";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-lg border border-white/[0.05] bg-[#0A0A0A]"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.04] bg-white/[0.02]">
            <Icon size={14} strokeWidth={1.5} className="text-zinc-500" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-zinc-200">
              {config.label} — Limit Reached
            </p>
            <p className="font-mono text-[10px] text-zinc-600">
              {config.description}
            </p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-4 py-1.5 text-[11px] font-medium text-white transition-all duration-200 hover:border-emerald-500/20 disabled:opacity-60"
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              className="h-3 w-3 rounded-full border border-zinc-600 border-t-emerald-400"
            />
          ) : (
            <>
              Upgrade
              <ArrowRight size={11} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Standalone PaywallModal (for feature intercepts) ──── */

export { ModalPaywall };
