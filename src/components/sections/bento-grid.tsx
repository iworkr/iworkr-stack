"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Calendar,
  Smartphone,
  Bot,
  Users,
  FileText,
  TrendingUp,
  Check,
} from "lucide-react";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

/* ---------- Spotlight Card Primitive ---------- */
function BentoCard({
  children,
  className = "",
  spotlightSize = 400,
}: {
  children: ReactNode;
  className?: string;
  spotlightSize?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const springX = useSpring(mouseX, { stiffness: 200, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 200, damping: 25 });

  function handleMouseMove(e: MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  function handleMouseLeave() {
    mouseX.set(-1000);
    mouseY.set(-1000);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] ${className}`}
    >
      {/* Spotlight gradient */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${spotlightSize}px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), rgba(255,255,255,0.06), transparent 80%)`,
          // @ts-expect-error CSS custom properties
          "--mouse-x": springX,
          "--mouse-y": springY,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/* ---------- Card Visuals ---------- */

function SchedulerVisual() {
  const slots = [
    { time: "8:00", job: "Pipe repair", tech: "Mike T.", color: "blue" },
    { time: "9:30", job: "Travel", tech: "", color: "zinc" },
    { time: "10:00", job: "Boiler install", tech: "Sarah C.", color: "emerald" },
    { time: "12:00", job: "Emergency call", tech: "James O.", color: "amber" },
    { time: "2:00", job: "Inspection", tech: "Mike T.", color: "violet" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-300",
    zinc: "bg-zinc-800/50 border-zinc-700/30 text-zinc-500 italic",
  };

  return (
    <div className="mt-4 space-y-1.5">
      {slots.map((slot, i) => (
        <motion.div
          key={slot.time}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${colorMap[slot.color]}`}
        >
          <span className="w-10 font-mono text-[10px] opacity-60">
            {slot.time}
          </span>
          <span className="text-xs font-medium">{slot.job}</span>
          {slot.tech && (
            <span className="ml-auto text-[10px] opacity-50">{slot.tech}</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function MobileVisual() {
  return (
    <div className="mt-6 flex items-center justify-center">
      <motion.div
        whileHover={{ rotateY: 5, rotateX: -5 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative h-[260px] w-[130px] rounded-[22px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] p-1.5"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Notch */}
        <div className="mx-auto mb-2 h-4 w-14 rounded-full bg-black" />
        {/* Screen */}
        <div className="flex h-full flex-col items-center justify-center rounded-[16px] bg-black/50 p-3">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20"
          >
            <Check size={24} className="text-emerald-400" />
          </motion.div>
          <span className="text-[10px] font-medium text-zinc-300">
            Tap to Clock In
          </span>
          <span className="mt-1 text-[8px] text-zinc-600">
            8:02 AM · On Site
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function AIWaveformVisual() {
  return (
    <div className="mt-6 space-y-3">
      {/* Waveform bars — fixed height container to prevent CLS */}
      <div className="flex h-[50px] items-end justify-center gap-[3px]">
        {Array.from({ length: 24 }).map((_, i) => {
          const height = Math.sin(i * 0.5) * 20 + 25;
          return (
            <motion.div
              key={i}
              animate={{ height: [height, height * 0.4, height] }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                delay: i * 0.05,
                ease: "easeInOut",
              }}
              className="w-1 rounded-full bg-gradient-to-t from-zinc-700 to-zinc-400"
              style={{ height }}
            />
          );
        })}
      </div>

      {/* Chat bubbles */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="rounded-lg rounded-bl-none bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs text-zinc-300"
      >
        &ldquo;I need a plumber for tomorrow&rdquo;
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="ml-auto rounded-lg rounded-br-none bg-blue-500/10 px-3 py-2 text-xs text-blue-300"
      >
        Booking set for Tuesday at 9:00 AM
      </motion.div>
    </div>
  );
}

function CRMVisual() {
  const clients = [
    { name: "Sarah Mitchell", value: "$12,400", jobs: 23 },
    { name: "David Park", value: "$8,200", jobs: 15 },
    { name: "Lisa Chen", value: "$6,800", jobs: 11 },
    { name: "Tom Andrews", value: "$5,100", jobs: 9 },
  ];

  return (
    <div className="mt-4 space-y-2">
      {clients.map((client, i) => (
        <motion.div
          key={client.name}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ x: 4 }}
          className="group/client flex cursor-default items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400">
            {client.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="flex-1">
            <div className="text-xs text-zinc-300">{client.name}</div>
            <div className="text-[10px] text-zinc-600">
              {client.jobs} jobs
            </div>
          </div>
          <span className="font-mono text-xs text-zinc-500 opacity-0 transition-opacity group-hover/client:opacity-100">
            {client.value}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function QuotesVisual() {
  return (
    <div className="mt-6 flex flex-col items-center">
      <motion.div
        initial={{ rotateY: 0 }}
        whileInView={{ rotateY: 360 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]"
      >
        <FileText size={20} className="text-zinc-400" />
      </motion.div>

      <div className="w-full space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">Quote #1247</span>
          <span className="text-zinc-500">Feb 14, 2026</span>
        </div>
        <div className="text-xs font-medium text-zinc-300">
          Kitchen renovation — full re-pipe
        </div>
        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-2">
          <span className="text-sm font-medium text-zinc-200">$4,850.00</span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-md bg-emerald-500/20 px-3 py-1 text-[10px] font-medium text-emerald-400"
          >
            Accepted
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function FinancialsVisual() {
  // Revenue line chart points
  const points = [
    20, 35, 30, 45, 42, 55, 60, 58, 70, 75, 72, 85, 90, 95, 92, 100, 105, 115, 120,
    130,
  ];
  const max = Math.max(...points);
  const h = 120;
  const w = 100; // percentage

  const pathD = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p / max) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-end gap-6">
        <div>
          <div className="text-[10px] text-zinc-500">Monthly Revenue</div>
          <div className="text-2xl font-medium tracking-tight text-zinc-200">
            $127,400
          </div>
          <div className="text-[10px] text-emerald-400">+23% vs last month</div>
        </div>
        <div className="flex gap-2">
          {["Xero", "Stripe", "QuickBooks"].map((label) => (
            <span
              key={label}
              className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[9px] text-zinc-500"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1="0"
            y1={h * frac}
            x2={w}
            y2={h * frac}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        ))}
        {/* Gradient fill */}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L ${w} ${h} L 0 ${h} Z`}
          fill="url(#chartGrad)"
          className="animate-line-draw"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1"
          className="animate-line-draw"
        />
      </svg>
    </div>
  );
}

/* ---------- Main Bento Grid Section ---------- */

export function BentoGrid() {
  return (
    <Section id="features">
      <FadeIn>
        <SectionHeader
          label="Features"
          title="Engineered for field operations."
          description="Every component purpose-built. No bloat, no compromises. From scheduling to settlements — one unified platform."
        />
      </FadeIn>

      <StaggerContainer
        className="grid grid-cols-1 gap-4 md:grid-cols-12"
        staggerDelay={0.08}
      >
        {/* Row A */}
        <StaggerItem className="md:col-span-8">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-zinc-500">
              <Calendar size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Scheduling
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              Smart Scheduling.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Conflict-free dispatching with intelligent travel-time routing.
            </p>
            <SchedulerVisual />
          </BentoCard>
        </StaggerItem>

        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-zinc-500">
              <Smartphone size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Mobile
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              Offline-First Mobile.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              For the field. Works without signal.
            </p>
            <MobileVisual />
          </BentoCard>
        </StaggerItem>

        {/* Row B */}
        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-zinc-500">
              <Bot size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                AI Agent
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              AI Phone Agent.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Answers calls. Books jobs. 24/7.
            </p>
            <AIWaveformVisual />
          </BentoCard>
        </StaggerItem>

        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-zinc-500">
              <Users size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                CRM
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              Client History.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Full lifetime value. Every interaction tracked.
            </p>
            <CRMVisual />
          </BentoCard>
        </StaggerItem>

        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-zinc-500">
              <FileText size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Quotes
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              Instant Quotes.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Generate, send, and convert in minutes.
            </p>
            <QuotesVisual />
          </BentoCard>
        </StaggerItem>

        {/* Row C */}
        <StaggerItem className="md:col-span-12">
          <BentoCard className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-zinc-500">
              <TrendingUp size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Financials
              </span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-zinc-100">
              End-to-End Financials.
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Stripe Connect, Xero Sync, automatic payouts. Revenue visibility from
              quote to settlement.
            </p>
            <FinancialsVisual />
          </BentoCard>
        </StaggerItem>
      </StaggerContainer>
    </Section>
  );
}
