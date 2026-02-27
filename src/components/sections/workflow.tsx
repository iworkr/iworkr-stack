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
  return (
    <div className="relative">
      <div className="relative h-64 overflow-hidden rounded-lg border border-[var(--card-border)]">
        <svg
          viewBox="0 0 640 400"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <filter id="routeGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Map background */}
          <rect width="640" height="400" fill="#09090b" />

          {/* City blocks */}
          {[
            [22, 22, 85, 62],
            [117, 22, 85, 62],
            [22, 94, 85, 62],
            [117, 94, 85, 62],
            [22, 166, 85, 48],
            [117, 166, 85, 48],
            [232, 22, 120, 62],
            [232, 94, 120, 62],
            [232, 166, 120, 48],
            [382, 22, 120, 62],
            [382, 94, 120, 62],
            [382, 166, 120, 48],
            [532, 22, 90, 62],
            [532, 94, 90, 62],
            [532, 166, 90, 48],
          ].map(([x, y, w, h], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="1"
              fill="#0c0c0e"
            />
          ))}

          {/* Brisbane River */}
          <path
            d="M -20 340 C 80 295, 160 320, 260 280 C 340 250, 400 270, 490 240 C 560 218, 610 235, 670 220"
            fill="none"
            stroke="#060608"
            strokeWidth="55"
            strokeLinecap="round"
          />

          {/* River banks (subtle edge) */}
          <path
            d="M -20 340 C 80 295, 160 320, 260 280 C 340 250, 400 270, 490 240 C 560 218, 610 235, 670 220"
            fill="none"
            stroke="#0e0e11"
            strokeWidth="57"
            strokeLinecap="round"
            strokeOpacity="0.5"
          />

          {/* Arterial roads (major) */}
          <line x1="0" y1="88" x2="640" y2="88" stroke="#18181b" strokeWidth="4" />
          <line x1="0" y1="160" x2="640" y2="160" stroke="#18181b" strokeWidth="4" />
          <line x1="0" y1="220" x2="640" y2="220" stroke="#16161a" strokeWidth="3" />
          <line x1="212" y1="0" x2="212" y2="290" stroke="#18181b" strokeWidth="4" />
          <line x1="362" y1="0" x2="362" y2="280" stroke="#18181b" strokeWidth="4" />
          <line x1="112" y1="0" x2="112" y2="260" stroke="#18181b" strokeWidth="3" />
          <line x1="512" y1="0" x2="512" y2="260" stroke="#16161a" strokeWidth="3" />

          {/* Local streets (minor) */}
          {[16, 160, 310, 460, 610].map((x, i) => (
            <line
              key={`vh${i}`}
              x1={x}
              y1="0"
              x2={x}
              y2="250"
              stroke="#111114"
              strokeWidth="1"
            />
          ))}
          {[16, 55, 128, 195].map((y, i) => (
            <line
              key={`hh${i}`}
              x1="0"
              y1={y}
              x2="640"
              y2={y}
              stroke="#111114"
              strokeWidth="1"
            />
          ))}

          {/* Diagonal road */}
          <line
            x1="362"
            y1="160"
            x2="512"
            y2="88"
            stroke="#15151a"
            strokeWidth="2.5"
          />

          {/* Bridge across river */}
          <line
            x1="362"
            y1="240"
            x2="362"
            y2="350"
            stroke="#18181b"
            strokeWidth="3"
          />

          {/* Street labels */}
          <text x="130" y="84" fill="#3f3f46" fontSize="6" fontFamily="system-ui">
            ANN ST
          </text>
          <text x="270" y="156" fill="#3f3f46" fontSize="6" fontFamily="system-ui">
            WICKHAM TCE
          </text>
          <text
            x="215"
            y="50"
            fill="#3f3f46"
            fontSize="6"
            fontFamily="system-ui"
            transform="rotate(90 215 50)"
          >
            EDWARD ST
          </text>
          <text
            x="365"
            y="50"
            fill="#3f3f46"
            fontSize="6"
            fontFamily="system-ui"
            transform="rotate(90 365 50)"
          >
            ALBERT ST
          </text>
          <text x="435" y="84" fill="#3f3f46" fontSize="6" fontFamily="system-ui">
            COMMERCIAL RD
          </text>

          {/* Optimized route polyline — follows roads precisely */}
          <polyline
            points="112,195 112,160 212,160 212,88 362,88 362,160 437,124 512,88 512,160"
            fill="none"
            stroke="#10B981"
            strokeWidth="3.5"
            strokeOpacity="0.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#routeGlow)"
          />

          {/* Route direction dots */}
          {[
            [162, 160],
            [290, 88],
            [400, 141],
            [475, 106],
          ].map(([cx, cy], i) => (
            <circle
              key={`d${i}`}
              cx={cx}
              cy={cy}
              r="1.5"
              fill="#10B981"
              fillOpacity="0.4"
            />
          ))}

          {/* Marker A — start */}
          <circle cx="112" cy="195" r="12" fill="#10B981" fillOpacity="0.15" />
          <circle cx="112" cy="195" r="7" fill="#10B981" />
          <text
            x="112"
            y="199"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            A
          </text>

          {/* Marker B — midpoint */}
          <circle cx="362" cy="160" r="12" fill="#10B981" fillOpacity="0.15" />
          <circle cx="362" cy="160" r="7" fill="#10B981" />
          <text
            x="362"
            y="164"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            B
          </text>

          {/* Marker C — end */}
          <circle cx="512" cy="160" r="12" fill="#10B981" fillOpacity="0.15" />
          <circle cx="512" cy="160" r="7" fill="#10B981" />
          <text
            x="512"
            y="164"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="bold"
            fontFamily="system-ui"
          >
            C
          </text>

          {/* ETA labels */}
          <rect x="142" y="147" width="32" height="12" rx="2" fill="#10B981" fillOpacity="0.12" />
          <text x="158" y="156" textAnchor="middle" fill="#10B981" fontSize="7" fontFamily="system-ui">
            8 min
          </text>
          <rect x="410" y="100" width="36" height="12" rx="2" fill="#10B981" fillOpacity="0.12" />
          <text x="428" y="109" textAnchor="middle" fill="#10B981" fontSize="7" fontFamily="system-ui">
            12 min
          </text>
        </svg>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
          style={{
            background: `linear-gradient(to top, var(--section-fade), transparent)`,
          }}
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
