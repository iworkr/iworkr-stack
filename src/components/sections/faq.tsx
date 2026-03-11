"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { FadeIn } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

const faqs = [
  {
    q: "How long does setup take?",
    a: "Most teams are fully operational within 24 hours. Our onboarding flow detects whether you're a trades or care business, imports your existing data, configures compliance and scheduling, and connects your payment processor in a guided setup.",
  },
  {
    q: "Does iWorkr work offline?",
    a: "Yes. The mobile app is offline-first by design. Field technicians and support workers can clock in, view job or shift details, capture photos, and collect signatures without signal. Everything syncs automatically when connectivity returns.",
  },
  {
    q: "Does iWorkr support NDIS and aged care providers?",
    a: "Absolutely. iWorkr includes purpose-built features for care organisations: workforce credential enforcement (NDIS screening, WWCC, First Aid), electronic medication records (eMAR), incident reporting, health observations, progress notes with GPS-verified shift tracking, and service agreement management.",
  },
  {
    q: "How does the AI Phone Agent work?",
    a: "The AI agent answers incoming calls 24/7, qualifies leads, and books jobs directly into your schedule. It understands natural language, handles common questions about pricing and availability, and escalates complex requests to your team.",
  },
  {
    q: "Can I integrate with my existing accounting software?",
    a: "iWorkr integrates natively with Xero, QuickBooks, and Stripe. Invoices, payments, and expenses sync bi-directionally in real-time. No manual data entry required.",
  },
  {
    q: "Is there a contract or commitment?",
    a: "No contracts. No setup fees. Cancel anytime. We believe our product should earn your business every month. Start with a 14-day free trial — no credit card required.",
  },
  {
    q: "What industries does iWorkr support?",
    a: "iWorkr serves two sectors: trades (plumbing, electrical, HVAC, cleaning, carpentry, landscaping, general contracting) and care (NDIS providers, aged care, disability support, allied health, home care). The platform dynamically adapts its terminology, compliance rules, and features based on your industry.",
  },
  {
    q: "How does credential compliance work?",
    a: "For care organisations, iWorkr enforces credential requirements at the scheduling level. Workers cannot be assigned to shifts unless their NDIS screening, Working With Children Check, and First Aid certifications are current. Expired or missing credentials trigger automatic alerts and block assignments until resolved.",
  },
];

function FAQItem({ faq, index }: { faq: (typeof faqs)[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-[var(--card-border)]"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-sm font-medium text-[var(--text-primary)] md:text-base">
          {faq.q}
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--card-border-hover)] bg-[var(--subtle-bg)]">
          {open ? (
            <Minus size={12} className="text-[var(--text-muted)]" />
          ) : (
            <Plus size={12} className="text-[var(--text-muted)]" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-[var(--text-muted)]">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  return (
    <Section id="faq" className="overflow-hidden">
      {/* Subtle noise texture */}
      <div className="stealth-noise" />

      <FadeIn>
        <SectionHeader
          label="FAQ"
          title="Questions answered."
          className="text-center mx-auto"
        />
      </FadeIn>

      <div className="mx-auto max-w-2xl">
        {faqs.map((faq, i) => (
          <FAQItem key={faq.q} faq={faq} index={i} />
        ))}
      </div>
    </Section>
  );
}
