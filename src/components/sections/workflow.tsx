"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Inbox, MapPin, CreditCard } from "lucide-react";
import { useRef } from "react";
import { Section, SectionHeader } from "@/components/ui/section";
import { FadeIn } from "@/components/ui/fade-in";

const steps = [
  {
    icon: Inbox,
    label: "Step 01",
    title: "Capture the chaos.",
    description:
      "Forms, calls, and emails route directly to your unified inbox. Every lead tracked. Nothing slips through.",
    visual: "inbox",
  },
  {
    icon: MapPin,
    label: "Step 02",
    title: "Dispatch with precision.",
    description:
      "Drag-and-drop scheduling with auto-routing. The system calculates optimal paths between jobs in real-time.",
    visual: "map",
  },
  {
    icon: CreditCard,
    label: "Step 03",
    title: "Get paid before you leave.",
    description:
      "Invoices generated and sent automatically. Tap-to-pay on site. Funds in your account by morning.",
    visual: "payment",
  },
];

function InboxVisual() {
  return (
    <div className="space-y-2">
      {[
        { type: "Phone Call", from: "Sarah M.", time: "2m ago", count: null },
        { type: "Web Form", from: "david.park@email.com", time: "8m ago", count: null },
        { type: "Email", from: "Lisa Chen", time: "15m ago", count: 3 },
        { type: "Phone Call", from: "Unknown", time: "22m ago", count: null },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <div className="flex-1">
            <div className="text-xs font-medium text-[var(--text-heading)]">{item.from}</div>
            <div className="text-[10px] text-[var(--text-dim)]">{item.type}</div>
          </div>
          <span className="text-[10px] text-[var(--text-dim)]">{item.time}</span>
          {item.count && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/12 text-[9px] text-emerald-600 dark:text-emerald-400">
              {item.count}
            </span>
          )}
        </motion.div>
      ))}
      {/* Counter */}
      <div className="mt-3 text-center">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="font-mono text-2xl font-medium text-[var(--text-primary)]"
        >
          12
        </motion.span>
        <span className="ml-1 text-xs text-[var(--text-dim)]">new leads today</span>
      </div>
    </div>
  );
}

function MapVisual() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticMapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=-27.4698,153.0251&zoom=13&size=640x400&scale=2&maptype=roadmap&style=element:geometry%7Ccolor:0x0a0a0a&style=feature:road%7Celement:geometry%7Ccolor:0x18181b&style=feature:road%7Celement:geometry.stroke%7Ccolor:0x27272a&style=feature:road%7Celement:labels%7Cvisibility:off&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off&style=feature:water%7Celement:geometry%7Ccolor:0x050505&style=feature:landscape%7Celement:geometry%7Ccolor:0x0a0a0a&style=element:labels.text.fill%7Ccolor:0x52525b&style=element:labels.text.stroke%7Ccolor:0x0a0a0a&markers=color:0x10B981%7C-27.4698,153.0251&markers=color:0x10B981%7C-27.4575,153.0355&markers=color:0x10B981%7C-27.4785,153.0190&key=${apiKey}`
    : null;

  return (
    <div className="relative">
      <div className="relative h-64 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
        {staticMapUrl ? (
          <img
            src={staticMapUrl}
            alt="Route optimization map"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPin size={24} strokeWidth={1} className="text-[var(--text-dim)]" />
          </div>
        )}

        {/* Route overlay line */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <motion.path
            d="M 60 180 C 100 180, 120 100, 160 90 S 240 60, 300 50"
            fill="none"
            stroke="rgba(16,185,129,0.5)"
            strokeWidth="2"
            strokeDasharray="8 4"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{ background: `linear-gradient(to top, var(--section-fade), transparent)` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>Optimized route: 3 jobs</span>
        <span className="text-emerald-600 dark:text-emerald-400">Saving 47 min</span>
      </div>
    </div>
  );
}

function PaymentVisual() {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: "spring" }}
        className="w-full max-w-xs rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 backdrop-blur-sm"
      >
        <div className="mb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, type: "spring" }}
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20"
          >
            <CreditCard size={20} className="text-emerald-500" />
          </motion.div>
          <div className="text-xs text-[var(--text-muted)]">Payment Successful</div>
          <div className="mt-1 text-2xl font-medium tracking-tight text-[var(--text-primary)]">
            $1,240.00
          </div>
        </div>

        <div className="space-y-2 border-t border-[var(--card-border)] pt-3">
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">Invoice</span>
            <span className="text-[var(--text-body)]">#INV-1247</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">Client</span>
            <span className="text-[var(--text-body)]">Sarah Mitchell</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--text-muted)]">Method</span>
            <span className="text-[var(--text-body)]">Tap to Pay</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8 }}
        className="mt-3 text-center text-[10px] text-[var(--text-dim)]"
      >
        Funds available by 6:00 AM
      </motion.div>
    </div>
  );
}

const visuals: Record<string, React.FC> = {
  inbox: InboxVisual,
  map: MapVisual,
  payment: PaymentVisual,
};

export function Workflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const progressHeight = useTransform(scrollYProgress, [0.2, 0.8], ["0%", "100%"]);

  return (
    <Section id="workflow" className="overflow-hidden">
      {/* Line grid texture */}
      <div className="pointer-events-none absolute inset-0 bg-line-grid opacity-50" />
      {/* Radial fade overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, var(--section-fade) 100%)`,
        }}
      />

      <FadeIn>
        <SectionHeader
          label="Workflow"
          title="From lead to ledger. Automated."
          description="Three steps. Zero admin overhead. Watch the entire job lifecycle execute itself."
          className="text-center mx-auto"
        />
      </FadeIn>

      <div ref={containerRef} className="relative">
        {/* Progress line */}
        <div className="absolute top-0 left-1/2 hidden h-full w-px -translate-x-1/2 bg-[var(--card-border)] md:block">
          <motion.div
            className="w-full bg-gradient-to-b from-[var(--text-muted)] to-[var(--card-border)]"
            style={{ height: progressHeight }}
          />
        </div>

        <div className="space-y-24 md:space-y-32">
          {steps.map((step, i) => {
            const Visual = visuals[step.visual];
            const isEven = i % 2 === 0;

            return (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div
                  className={`flex flex-col gap-8 md:flex-row md:items-center md:gap-16 ${
                    isEven ? "" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Text */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border-hover)] bg-[var(--subtle-bg)]">
                        <step.icon size={16} className="text-[var(--text-muted)]" />
                      </div>
                      <span className="font-mono text-[11px] tracking-wider text-[var(--text-dim)] uppercase">
                        {step.label}
                      </span>
                    </div>
                    <h3 className="text-2xl font-medium tracking-tight text-[var(--text-heading)] md:text-3xl">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual */}
                  <div className="flex-1">
                    <Visual />
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
