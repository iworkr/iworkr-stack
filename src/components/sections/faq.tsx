"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { FadeIn } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

const faqs = [
  {
    q: "How long does setup take?",
    a: "Most teams are fully operational within 24 hours. Our onboarding flow imports your existing client data, configures your schedule, and connects your payment processor in a guided setup.",
  },
  {
    q: "Does iWorkr work offline?",
    a: "Yes. The mobile app is offline-first by design. Field technicians can clock in, view job details, capture photos, and collect signatures without signal. Everything syncs automatically when connectivity returns.",
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
    q: "What trades does iWorkr support?",
    a: "iWorkr is purpose-built for service trades: plumbing, electrical, HVAC, roofing, painting, landscaping, and general contracting. The platform is configurable for any field service workflow.",
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
      className="border-b border-[rgba(255,255,255,0.06)]"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-sm font-medium text-zinc-200 md:text-base">
          {faq.q}
        </span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]">
          {open ? (
            <Minus size={12} className="text-zinc-400" />
          ) : (
            <Plus size={12} className="text-zinc-400" />
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
            <p className="pb-5 text-sm leading-relaxed text-zinc-500">
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
    <Section id="faq">
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
