"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";
import { SpotlightButton } from "@/components/ui/spotlight-button";

const plans = [
  {
    name: "Starter",
    description: "For solo operators getting organized.",
    monthlyPrice: 47,
    yearlyPrice: 38,
    features: [
      "Up to 5 users",
      "Job scheduling",
      "Basic invoicing",
      "Mobile app (iOS + Android)",
      "Client database",
      "Email support",
    ],
    highlighted: false,
    cta: "Start free trial",
  },
  {
    name: "Standard",
    description: "For growing teams that need automation.",
    monthlyPrice: 97,
    yearlyPrice: 78,
    features: [
      "Unlimited users",
      "AI Phone Agent",
      "Smart routing",
      "Stripe + Xero integration",
      "Custom forms & quotes",
      "Priority support",
      "Multi-branch",
      "API access",
    ],
    highlighted: true,
    cta: "Start free trial",
    badge: "Most popular",
  },
  {
    name: "Enterprise",
    description: "For operations at scale.",
    monthlyPrice: 247,
    yearlyPrice: 198,
    features: [
      "Everything in Standard",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "Advanced analytics",
      "SSO / SAML",
      "On-premise option",
      "Training & onboarding",
    ],
    highlighted: false,
    cta: "Contact sales",
  },
];

function PriceDisplay({
  price,
  isYearly,
}: {
  price: number;
  isYearly: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-medium text-zinc-500 align-super">$</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={price}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="text-5xl font-medium tracking-tight text-zinc-100"
        >
          {price}
        </motion.span>
      </AnimatePresence>
      <span className="text-sm text-zinc-500">/mo</span>
    </div>
  );
}

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <Section id="pricing">
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
        <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
              !isYearly
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
              isYearly
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Yearly
            <span className="ml-1.5 text-[10px] font-medium text-emerald-500">
              Save 20%
            </span>
          </button>
        </div>
      </FadeIn>

      {/* Cards */}
      <StaggerContainer
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        staggerDelay={0.1}
      >
        {plans.map((plan) => (
          <StaggerItem key={plan.name}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`relative flex h-full flex-col rounded-xl border p-6 md:p-8 ${
                plan.highlighted
                  ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.04)]"
                  : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              {/* Top glow for highlighted */}
              {plan.highlighted && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              )}

              {/* Badge */}
              {plan.badge && (
                <span className="mb-4 inline-block w-fit rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-zinc-300">
                  {plan.badge}
                </span>
              )}

              {/* Plan name */}
              <h3 className="text-lg font-medium text-zinc-100">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>

              {/* Price */}
              <div className="my-6">
                <PriceDisplay
                  price={isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  isYearly={isYearly}
                />
                {isYearly && (
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Billed annually (${(isYearly ? plan.yearlyPrice : plan.monthlyPrice) * 12}/yr)
                  </p>
                )}
              </div>

              {/* CTA */}
              <SpotlightButton
                variant={plan.highlighted ? "primary" : "secondary"}
                size="md"
                className="mb-6 w-full"
                href="#"
              >
                {plan.cta}
                <ArrowRight size={14} />
              </SpotlightButton>

              {/* Features */}
              <div className="grid grid-cols-1 gap-2.5 border-t border-[rgba(255,255,255,0.06)] pt-6">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <Check size={14} className="shrink-0 text-zinc-500" />
                    <span className="text-sm text-zinc-400">{feature}</span>
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
