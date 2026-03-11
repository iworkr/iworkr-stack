"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { PLANS } from "@/lib/plans";
import { useAuthStore } from "@/lib/auth-store";

const displayPlans = PLANS.filter((p) => p.key !== "free");

function PriceDisplay({
  price,
}: {
  price: number;
  isYearly: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-medium text-[var(--text-muted)] align-super">$</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={price}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="text-5xl font-medium tracking-tight text-[var(--text-primary)]"
        >
          {price}
        </motion.span>
      </AnimatePresence>
      <span className="text-sm text-[var(--text-muted)]">/mo</span>
    </div>
  );
}

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;

  function getCheckoutHref(plan: (typeof displayPlans)[0]) {
    if (plan.ctaLabel === "Contact sales") return "mailto:sales@iworkr.com";
    const interval = isYearly ? "yearly" : "monthly";
    // Authenticated users go straight to checkout; others go through auth first
    if (isAuthenticated) {
      return `/checkout?plan=${plan.key}&interval=${interval}`;
    }
    return `/auth?mode=signup&next=${encodeURIComponent(`/checkout?plan=${plan.key}&interval=${interval}`)}`;
  }

  return (
    <Section id="pricing" className="overflow-hidden">
      {/* Subtle noise texture */}
      <div className="stealth-noise" />
      {/* Soft emerald atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(16, 185, 129, 0.015) 0%, transparent 70%)",
        }}
      />

      <FadeIn>
        <SectionHeader
          label="Pricing"
          title="Transparent pricing. No surprises."
          description="Start free. Scale when you're ready. No contracts, no hidden fees."
          className="text-center mx-auto"
        />
      </FadeIn>

      {/* Toggle */}
      <FadeIn delay={0.1} className="mb-12 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
              !isYearly
                ? "bg-[var(--text-primary)] text-[var(--background)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
              isYearly
                ? "bg-[var(--text-primary)] text-[var(--background)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Yearly
            <span className="ml-1.5 text-[10px] font-medium text-emerald-500/60">
              Save 20%
            </span>
          </button>
        </div>
      </FadeIn>

      {/* Cards */}
      <StaggerContainer
        className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-3"
        staggerDelay={0.1}
      >
        {displayPlans.map((plan) => (
          <StaggerItem key={plan.key}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`relative flex h-full flex-col rounded-xl border p-6 md:p-8 ${
                plan.highlighted
                  ? "border-emerald-500/15 bg-[var(--subtle-bg)]"
                  : "border-[var(--card-border)] bg-[var(--card-bg)]"
              }`}
              style={plan.highlighted ? { boxShadow: "0 0 40px -12px rgba(16,185,129,0.08)" } : undefined}
            >
              {/* Top glow for highlighted — Signal Green accent */}
              {plan.highlighted && (
                <>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  <BorderBeam
                    size={100}
                    duration={10}
                    colorFrom="#10B981"
                    colorTo="#059669"
                    borderWidth={1}
                  />
                </>
              )}

              {/* Badge */}
              {plan.badge && (
                <span
                  className="mb-4 inline-block w-fit rounded-full px-3 py-1 text-[10px] font-medium text-emerald-300/80"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.06)" }}
                >
                  {plan.badge}
                </span>
              )}

              {/* Plan name */}
              <h3 className="text-lg font-medium text-[var(--text-primary)]">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{plan.description}</p>

              {/* Price */}
              <div className="my-6">
                <PriceDisplay
                  price={isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  isYearly={isYearly}
                />
                {isYearly && (
                  <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                    Billed annually ($
                    {plan.yearlyPrice * 12}
                    /yr)
                  </p>
                )}
              </div>

              {/* CTA */}
              <SpotlightButton
                variant={plan.highlighted ? "primary" : "secondary"}
                size="md"
                className="mb-6 w-full"
                href={getCheckoutHref(plan)}
              >
                {plan.ctaLabel}
                <ArrowRight size={14} />
              </SpotlightButton>

              {/* Trial badge */}
              {plan.hasFreeTrial && plan.ctaLabel !== "Contact sales" && (
                <p className="mb-4 text-center text-[11px] text-zinc-500">
                  {plan.trialDays}-day free trial · No credit card upfront
                </p>
              )}

              {/* Features */}
              <div className="grid grid-cols-1 gap-2.5 border-t border-[var(--card-border)] pt-6">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <Check size={14} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-body)]">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </Section>
  );
}
