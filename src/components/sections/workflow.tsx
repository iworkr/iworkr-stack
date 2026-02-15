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
          className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
        >
          <div className="h-2 w-2 rounded-full bg-blue-400" />
          <div className="flex-1">
            <div className="text-xs font-medium text-zinc-300">{item.from}</div>
            <div className="text-[10px] text-zinc-600">{item.type}</div>
          </div>
          <span className="text-[10px] text-zinc-600">{item.time}</span>
          {item.count && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[9px] text-blue-400">
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
          className="font-mono text-2xl font-medium text-zinc-200"
        >
          12
        </motion.span>
        <span className="ml-1 text-xs text-zinc-600">new leads today</span>
      </div>
    </div>
  );
}

function MapVisual() {
  return (
    <div className="relative">
      {/* Greyscale map placeholder */}
      <div className="relative h-64 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
        {/* Grid streets */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Route line */}
        <svg className="absolute inset-0 h-full w-full">
          <motion.path
            d="M 60 180 C 100 180, 120 100, 160 90 S 240 60, 300 50"
            fill="none"
            stroke="rgba(59,130,246,0.6)"
            strokeWidth="2"
            strokeDasharray="8 4"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
          />
        </svg>

        {/* Pins */}
        {[
          { x: "15%", y: "70%", label: "Current", color: "bg-emerald-500" },
          { x: "42%", y: "35%", label: "Next Job", color: "bg-blue-500" },
          { x: "78%", y: "20%", label: "After", color: "bg-zinc-500" },
        ].map((pin, i) => (
          <motion.div
            key={pin.label}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 + i * 0.2, type: "spring" }}
            className="absolute flex flex-col items-center"
            style={{ left: pin.x, top: pin.y }}
          >
            <div
              className={`h-3 w-3 rounded-full ${pin.color} ring-2 ring-black`}
            />
            <span className="mt-1 rounded bg-black/80 px-1.5 py-0.5 text-[8px] text-zinc-400">
              {pin.label}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Optimized route: 3 jobs</span>
        <span className="text-emerald-400">Saving 47 min</span>
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
        className="w-full max-w-xs rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-sm"
      >
        <div className="mb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, type: "spring" }}
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20"
          >
            <CreditCard size={20} className="text-emerald-400" />
          </motion.div>
          <div className="text-xs text-zinc-500">Payment Successful</div>
          <div className="mt-1 text-2xl font-medium tracking-tight text-zinc-100">
            $1,240.00
          </div>
        </div>

        <div className="space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Invoice</span>
            <span className="text-zinc-400">#INV-1247</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Client</span>
            <span className="text-zinc-400">Sarah Mitchell</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Method</span>
            <span className="text-zinc-400">Tap to Pay</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8 }}
        className="mt-3 text-center text-[10px] text-zinc-600"
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
        <div className="absolute top-0 left-1/2 hidden h-full w-px -translate-x-1/2 bg-[rgba(255,255,255,0.06)] md:block">
          <motion.div
            className="w-full bg-gradient-to-b from-white/20 to-white/5"
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]">
                        <step.icon size={16} className="text-zinc-400" />
                      </div>
                      <span className="font-mono text-[11px] tracking-wider text-zinc-600 uppercase">
                        {step.label}
                      </span>
                    </div>
                    <h3 className="text-2xl font-medium tracking-tight text-zinc-100 md:text-3xl">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-500">
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
