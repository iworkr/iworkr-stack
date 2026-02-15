"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { FadeIn } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

const testimonials = [
  {
    quote:
      "iWorkr cut our admin time by 40%. It's the first tool that feels like it was built by engineers, not salespeople.",
    name: "Mike Thompson",
    role: "Owner",
    company: "Apex Plumbing Co",
    metric: "40% less admin",
  },
  {
    quote:
      "The AI phone agent alone pays for itself. We capture every lead now — even at 2 AM on a Saturday.",
    name: "Sarah Chen",
    role: "Operations Manager",
    company: "ClearWater HVAC",
    metric: "3x more leads",
  },
  {
    quote:
      "We switched from three different apps. Having scheduling, invoicing, and CRM in one system changed everything.",
    name: "James O'Brien",
    role: "Director",
    company: "GridLine Electrical",
    metric: "1 unified system",
  },
  {
    quote:
      "Our field techs actually like using it. The offline-first mobile app works even in basements with zero signal.",
    name: "Lisa Park",
    role: "Field Supervisor",
    company: "Summit Services",
    metric: "100% adoption",
  },
  {
    quote:
      "Invoices go out before the van leaves the driveway. Our average payment time dropped from 14 days to same-day.",
    name: "David Mitchell",
    role: "Finance Lead",
    company: "TrueLevel Builds",
    metric: "Same-day payments",
  },
];

function TestimonialCard({
  testimonial,
  isCenter,
}: {
  testimonial: (typeof testimonials)[0];
  isCenter?: boolean;
}) {
  return (
    <div
      className={`flex h-full w-[320px] flex-shrink-0 flex-col rounded-xl border border-[rgba(255,255,255,0.08)] bg-zinc-900/80 p-6 transition-all duration-300 sm:w-[380px] ${
        isCenter ? "opacity-100" : "opacity-50 scale-[0.97]"
      }`}
    >
      {/* Quote mark */}
      <span className="mb-4 block font-serif text-4xl leading-none text-zinc-700">
        &ldquo;
      </span>

      {/* Quote */}
      <p className="flex-1 text-sm leading-relaxed text-zinc-300">
        {testimonial.quote}
      </p>

      {/* Metric badge */}
      <div className="my-4">
        <span className="inline-block rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] font-medium text-zinc-400">
          {testimonial.metric}
        </span>
      </div>

      {/* Author */}
      <div className="flex items-center gap-3 border-t border-[rgba(255,255,255,0.06)] pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400">
          {testimonial.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-200">
            {testimonial.name}
          </div>
          <div className="text-[11px] text-zinc-500">
            {testimonial.role}, {testimonial.company}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const constraintRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });

  return (
    <Section id="testimonials" className="overflow-hidden">
      <FadeIn>
        <SectionHeader
          label="Testimonials"
          title="Trusted by operators who demand precision."
          description="Real results from trade businesses that switched to iWorkr."
          className="text-center mx-auto"
        />
      </FadeIn>

      <div ref={constraintRef} className="relative -mx-6 md:-mx-12">
        {/* Edge gradients */}
        <div className="pointer-events-none absolute top-0 left-0 z-10 h-full w-16 bg-gradient-to-r from-black to-transparent md:w-32" />
        <div className="pointer-events-none absolute top-0 right-0 z-10 h-full w-16 bg-gradient-to-l from-black to-transparent md:w-32" />

        <motion.div
          drag="x"
          dragConstraints={{ left: -((testimonials.length - 1) * 400), right: 0 }}
          style={{ x: springX }}
          className="flex cursor-grab gap-5 px-6 active:cursor-grabbing md:px-12"
        >
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.name} testimonial={t} isCenter={i === 0} />
          ))}
        </motion.div>

        {/* Drag hint */}
        <FadeIn delay={0.5} className="mt-6 text-center">
          <span className="text-xs text-zinc-600">
            Drag to explore
            <span className="ml-2 inline-block animate-pulse">←→</span>
          </span>
        </FadeIn>
      </div>
    </Section>
  );
}
