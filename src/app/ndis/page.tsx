"use client";

import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  Pill,
  ClipboardList,
  Activity,
  Users,
  Calendar,
  Smartphone,
  TrendingUp,
  Check,
  FileText,
  AlertTriangle,
  MapPin,
  LayoutDashboard,
  Menu,
  X,
  Plus,
  Minus,
  Inbox,
  CreditCard,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { useAuthStore } from "@/lib/auth-store";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { Particles } from "@/components/magicui/particles";
import { Meteors } from "@/components/magicui/meteors";
import { BorderBeam } from "@/components/magicui/border-beam";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { PLANS } from "@/lib/plans";
import { Footer } from "@/components/sections/footer";

/* ════════════════════════════════════════════════════════
 * NDIS / Care Landing Page — iWorkr for Care Providers
 * ════════════════════════════════════════════════════════ */

/* ── Word stagger animation ── */
const wordVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3 + i * 0.08,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

/* ── Spotlight Card ── */
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
      className={`group relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${spotlightSize}px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), var(--subtle-bg-hover), transparent 80%)`,
          // @ts-expect-error CSS custom properties
          "--mouse-x": springX,
          "--mouse-y": springY,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════
 * NAVBAR — Care Variant
 * ════════════════════════════════════════════════════════ */

const ndisNavLinks = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "For Trades", href: "/" },
  { label: "Pricing", href: "#pricing" },
];

function NdisNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const { theme } = useTheme();
  const { user, initialized, profile } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.8]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.08]);

  return (
    <>
      <motion.header className="fixed top-0 right-0 left-0 z-50">
        <motion.div
          className="absolute inset-0 backdrop-blur-xl"
          style={{ opacity: bgOpacity, backgroundColor: "var(--background)" }}
        />
        <motion.div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ opacity: borderOpacity, backgroundColor: "var(--card-border-hover)" }}
        />

        <nav className="relative mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src={theme === "light" ? "/logos/logo-light-full.png" : "/logos/logo-dark-full.png"}
              alt="iWorkr"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="rounded border border-blue-500/20 bg-blue-500/5 px-1.5 py-0.5 font-mono text-[10px] text-blue-400">
              care
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {ndisNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                {profile?.full_name && (
                  <span className="text-sm text-[var(--text-muted)]">{profile.full_name.split(" ")[0]}</span>
                )}
                <SpotlightButton size="sm" href="/dashboard">
                  <LayoutDashboard size={14} />
                  Dashboard
                </SpotlightButton>
              </>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Sign in
                </Link>
                <SpotlightButton size="sm" href="/auth" variant="primary">
                  Start free
                </SpotlightButton>
              </>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </motion.header>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 top-[57px] z-40 border-b border-[var(--overlay-border)] bg-[var(--overlay-bg)] backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {ndisNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--subtle-bg)] hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 border-t border-[var(--overlay-border)] pt-3">
              <SpotlightButton size="md" className="w-full" href="/auth" variant="primary">
                Start free trial
              </SpotlightButton>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════
 * HERO — Care
 * ════════════════════════════════════════════════════════ */

function NdisHero() {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  const words = "The operating system for care providers.".split(" ");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-6 pt-24 pb-16">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute top-0 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/4">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.012) 0%, transparent 70%)" }} />
      </div>
      <Particles className="pointer-events-none absolute inset-0" quantity={20} staticity={50} ease={50} size={0.2} color="#3B82F6" />
      <Meteors number={14} angle={0} minDuration={3} maxDuration={6} minDelay={0.2} maxDelay={2} className="opacity-50" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Announcement Pill */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          <Badge glow className="mb-8 cursor-pointer hover:border-white/10">
            <Heart size={14} className="text-blue-400" />
            <AnimatedShinyText shimmerWidth={80}>Purpose-built for NDIS &amp; Aged Care</AnimatedShinyText>
            <ArrowRight size={12} className="text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-0.5" />
          </Badge>
        </motion.div>

        {/* H1 */}
        <h1 className="mb-6 text-5xl font-medium leading-[1.08] tracking-tighter text-zinc-100 sm:text-6xl md:text-7xl lg:text-[76px]">
          {words.map((word, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={wordVariants}
              initial="hidden"
              animate="visible"
              className="mr-[0.25em] inline-block"
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--hero-grad-from), var(--hero-grad-to))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[var(--text-body)]"
        >
          NDIS providers, disability support, aged care, and allied health.
          Compliance, rostering, clinical records, and payments — one platform.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4"
        >
          {isAuthenticated ? (
            <SpotlightButton size="lg" href="/dashboard" variant="primary">
              <LayoutDashboard size={16} />
              Open Dashboard
            </SpotlightButton>
          ) : (
            <>
              <SpotlightButton size="lg" href="/auth?mode=signup" variant="primary">
                Start free trial
                <ArrowRight size={16} />
              </SpotlightButton>
              <SpotlightButton size="lg" href="mailto:sales@iworkr.com" variant="secondary">
                Talk to sales
              </SpotlightButton>
            </>
          )}
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          {["NDIS Registered", "PRODA Compatible", "Audit-Ready", "HIPAA Aligned"].map((badge, i) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]"
            >
              <ShieldCheck size={12} className="text-blue-400/60" />
              {badge}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════
 * SOCIAL PROOF — Care
 * ════════════════════════════════════════════════════════ */

const careLogos = [
  { name: "BrightPath", accent: "#3B82F6" },
  { name: "CareBridge", accent: "#8B5CF6" },
  { name: "AlliedFirst", accent: "#06B6D4" },
  { name: "NurtureCo", accent: "#10B981" },
  { name: "AbilityPlus", accent: "#F59E0B" },
  { name: "HomeHeart", accent: "#EF4444" },
  { name: "SupportHub", accent: "#EC4899" },
  { name: "WellSpring", accent: "#14B8A6" },
];

function NdisSocialProof() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--card-border)] py-12">
      <FadeIn>
        <p className="mb-8 text-center text-xs tracking-widest text-[var(--text-dim)] uppercase">
          Trusted by care providers across Australia
        </p>
      </FadeIn>
      <div className="relative">
        <div className="pointer-events-none absolute top-0 left-0 z-10 h-full w-24" style={{ background: "linear-gradient(to right, var(--section-fade), transparent)" }} />
        <div className="pointer-events-none absolute top-0 right-0 z-10 h-full w-24" style={{ background: "linear-gradient(to left, var(--section-fade), transparent)" }} />
        <div className="animate-marquee flex items-center gap-12">
          {[...careLogos, ...careLogos].map((logo, i) => (
            <div key={`${logo.name}-${i}`} className="flex items-center gap-2.5 opacity-40 transition-opacity duration-300 hover:opacity-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill={logo.accent} fillOpacity="0.15" />
                <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="700" fill={logo.accent}>{logo.name.charAt(0)}</text>
              </svg>
              <span className="whitespace-nowrap text-sm font-medium tracking-tight text-[var(--text-muted)]">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════
 * FEATURES — Care Bento Grid
 * ════════════════════════════════════════════════════════ */

function ComplianceVisual() {
  const credentials = [
    { name: "NDIS Worker Screening", status: "verified", expires: "Jun 2026" },
    { name: "Working With Children", status: "verified", expires: "Mar 2027" },
    { name: "First Aid Certificate", status: "expiring", expires: "Apr 2026" },
    { name: "Manual Handling", status: "pending", expires: "—" },
  ];
  return (
    <div className="mt-5 space-y-2">
      {credentials.map((cred) => (
        <div key={cred.name} className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${cred.status === "verified" ? "bg-emerald-500" : cred.status === "expiring" ? "bg-amber-500" : "bg-zinc-500"}`} />
            <span className="text-xs font-medium text-[var(--text-primary)]">{cred.name}</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{cred.expires}</span>
        </div>
      ))}
    </div>
  );
}

function EMARVisual() {
  const meds = [
    { name: "Paracetamol 500mg", time: "08:00", status: "given" },
    { name: "Metformin 850mg", time: "08:00", status: "given" },
    { name: "Salbutamol PRN", time: "—", status: "prn" },
  ];
  return (
    <div className="mt-5 space-y-2">
      {meds.map((med) => (
        <div key={med.name} className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`flex h-5 w-5 items-center justify-center rounded text-[10px] ${med.status === "given" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
              {med.status === "given" ? <Check size={10} /> : "P"}
            </div>
            <span className="text-xs font-medium text-[var(--text-primary)]">{med.name}</span>
          </div>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">{med.time}</span>
        </div>
      ))}
    </div>
  );
}

function RosterVisual() {
  const shifts = [
    { time: "6:00 AM", participant: "Margaret W.", worker: "Sarah T.", type: "Personal Care" },
    { time: "8:00 AM", participant: "David L.", worker: "James O.", type: "Community Access" },
    { time: "10:00 AM", participant: "Emily R.", worker: "Sarah T.", type: "Respite Care" },
    { time: "1:00 PM", participant: "Robert K.", worker: "Lisa M.", type: "Therapy" },
  ];
  return (
    <div className="mt-4 space-y-1.5">
      {shifts.map((shift, i) => (
        <motion.div
          key={shift.time}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
        >
          <span className="w-14 font-mono text-[10px] text-[var(--text-dim)]">{shift.time}</span>
          <div className="flex-1">
            <span className="text-xs font-medium text-[var(--text-heading)]">{shift.participant}</span>
            <span className="ml-2 text-[10px] text-[var(--text-dim)]">{shift.type}</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">{shift.worker}</span>
        </motion.div>
      ))}
    </div>
  );
}

function IncidentVisual() {
  const incidents = [
    { title: "Near miss — bathroom", severity: "low", time: "2h ago", status: "open" },
    { title: "Medication refusal", severity: "medium", time: "5h ago", status: "investigating" },
    { title: "Fall in kitchen", severity: "high", time: "1d ago", status: "closed" },
  ];
  return (
    <div className="mt-5 space-y-2">
      {incidents.map((inc) => (
        <div key={inc.title} className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${inc.severity === "high" ? "bg-rose-500" : inc.severity === "medium" ? "bg-amber-500" : "bg-sky-500"}`} />
            <span className="text-xs font-medium text-[var(--text-primary)]">{inc.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${inc.status === "open" ? "bg-rose-500/10 text-rose-400" : inc.status === "investigating" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-500/10 text-zinc-400"}`}>
              {inc.status}
            </span>
            <span className="text-[10px] text-[var(--text-dim)]">{inc.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressNotesVisual() {
  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--text-muted)]">Shift Report #847</span>
          <span className="text-[var(--text-dim)]">Today, 2:15 PM</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-heading)]">
          Margaret was in good spirits today. Assisted with personal care and morning routine. Mobility improving — walked to kitchen independently.
        </p>
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--card-border)] pt-2">
          <div className="flex items-center gap-1 text-[10px] text-emerald-400/70">
            <MapPin size={10} />
            GPS verified
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
            <Activity size={10} />
            Mood: Positive
          </div>
          <div className="ml-auto text-[10px] text-[var(--text-dim)]">Duration: 2h 15m</div>
        </div>
      </div>
    </div>
  );
}

function NdisFeatures() {
  return (
    <Section id="features" className="overflow-hidden">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(59,130,246,0.006) 0%, transparent 70%)" }} />
      <AnimatedGridPattern
        numSquares={20}
        maxOpacity={0.015}
        duration={7}
        repeatDelay={2}
        className={cn("pointer-events-none absolute inset-0 z-0", "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]")}
      />

      <FadeIn>
        <SectionHeader
          label="Features"
          title="Engineered for care compliance."
          description="Every feature purpose-built for NDIS, aged care, and disability support. Credential enforcement, clinical records, and shift management — zero paper."
        />
      </FadeIn>

      <StaggerContainer className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-12" staggerDelay={0.08}>
        {/* Rostering */}
        <StaggerItem className="md:col-span-8">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Calendar size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Rostering</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Smart Shift Rostering.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Drag-and-drop scheduling with credential checks. Only qualified workers get assigned.</p>
            <RosterVisual />
          </BentoCard>
        </StaggerItem>

        {/* Mobile */}
        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Smartphone size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Mobile</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Offline-First Mobile.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Support workers clock in, log notes, and track vitals — even without signal.</p>
            <div className="mt-6 flex items-center justify-center">
              <motion.div
                whileHover={{ rotateY: 5, rotateX: -5 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative h-[260px] w-[130px] rounded-[22px] border border-[var(--card-border-hover)] bg-[var(--subtle-bg)] p-1.5"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="mx-auto mb-2 h-4 w-14 rounded-full bg-[var(--surface-2)]" />
                <div className="flex h-full flex-col items-center justify-center rounded-[16px] bg-[var(--surface-1)] p-3">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/[0.06]"
                  >
                    <Check size={24} className="text-blue-400/80" />
                  </motion.div>
                  <span className="text-[10px] font-medium text-[var(--text-heading)]">Shift Started</span>
                  <span className="mt-1 text-[8px] text-[var(--text-dim)]">6:02 AM · GPS Verified</span>
                </div>
              </motion.div>
            </div>
          </BentoCard>
        </StaggerItem>

        {/* Compliance */}
        <StaggerItem className="md:col-span-6">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <ShieldCheck size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Compliance</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Workforce Compliance.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">NDIS screening, WWCC, certifications — tracked, enforced, and audit-ready.</p>
            <ComplianceVisual />
          </BentoCard>
        </StaggerItem>

        {/* eMAR */}
        <StaggerItem className="md:col-span-6">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Pill size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">eMAR</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Medication Records.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Electronic medication administration. Real-time tracking with full audit trail.</p>
            <EMARVisual />
          </BentoCard>
        </StaggerItem>

        {/* Incidents */}
        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <AlertTriangle size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Incidents</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Incident Reporting.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Capture, categorise, and investigate with full audit trail.</p>
            <IncidentVisual />
          </BentoCard>
        </StaggerItem>

        {/* Participant CRM */}
        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Users size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Participants</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Participant Profiles.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">NDIS numbers, care plans, service agreements, and emergency contacts.</p>
            <div className="mt-4 space-y-2">
              {[
                { name: "Margaret Williams", ndis: "43928XXXX", plan: "Core + Capacity" },
                { name: "David Liu", ndis: "43815XXXX", plan: "Core Support" },
                { name: "Emily Roberts", ndis: "43721XXXX", plan: "Core + Capital" },
              ].map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--subtle-bg)]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-medium text-blue-400">{p.name.split(" ").map(n => n[0]).join("")}</div>
                  <div className="flex-1">
                    <div className="text-xs text-[var(--text-heading)]">{p.name}</div>
                    <div className="text-[10px] text-[var(--text-dim)]">NDIS: {p.ndis}</div>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{p.plan}</span>
                </motion.div>
              ))}
            </div>
          </BentoCard>
        </StaggerItem>

        {/* Progress Notes */}
        <StaggerItem className="md:col-span-4">
          <BentoCard className="h-full p-6">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <ClipboardList size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Progress Notes</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Shift Reports.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">GPS-verified notes with mood, goals, and outcomes per shift.</p>
            <ProgressNotesVisual />
          </BentoCard>
        </StaggerItem>

        {/* Financials — Full Width */}
        <StaggerItem className="md:col-span-12">
          <BentoCard className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <TrendingUp size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Financials</span>
            </div>
            <h3 className="mt-3 text-xl font-medium tracking-tight text-[var(--text-heading)]">Service Agreement Tracking.</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">NDIS plan budgets, line items, utilisation tracking, and Xero integration. Real-time visibility from service agreement to settlement.</p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Active Agreements", value: "47", change: "+3 this week" },
                { label: "Monthly Revenue", value: "$184,200", change: "+12% vs last month" },
                { label: "Budget Utilisation", value: "78%", change: "On track" },
                { label: "Claims Processed", value: "312", change: "This month" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                  <div className="text-[10px] text-[var(--text-muted)]">{stat.label}</div>
                  <div className="mt-1 text-2xl font-medium tracking-tight text-[var(--text-primary)]">{stat.value}</div>
                  <div className="mt-0.5 text-[10px] text-blue-400/70">{stat.change}</div>
                </div>
              ))}
            </div>
          </BentoCard>
        </StaggerItem>
      </StaggerContainer>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════
 * WORKFLOW — Care
 * ════════════════════════════════════════════════════════ */

function NdisWorkflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const progressHeight = useTransform(scrollYProgress, [0.2, 0.8], ["0%", "100%"]);

  const steps = [
    {
      icon: Inbox,
      label: "Step 01",
      title: "Receive the referral.",
      description: "Referrals flow into your unified inbox. Participant details captured, NDIS numbers validated, and care plans initiated automatically.",
    },
    {
      icon: Calendar,
      label: "Step 02",
      title: "Roster with compliance.",
      description: "Drag-and-drop shift scheduling with hard-gate credential checks. Only workers with valid NDIS screening, WWCC, and certifications get assigned.",
    },
    {
      icon: ClipboardList,
      label: "Step 03",
      title: "Deliver and document.",
      description: "Support workers complete shifts with GPS-verified progress notes, medication records, and health observations. Everything audit-ready in real-time.",
    },
  ];

  return (
    <Section id="workflow" className="overflow-hidden">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute inset-0 bg-line-grid opacity-[0.02]" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, var(--section-fade) 100%)" }} />

      <FadeIn>
        <SectionHeader
          label="Workflow"
          title="From referral to report. Compliant."
          description="Three steps. Zero paper. Watch the entire care lifecycle execute with full audit compliance."
          className="text-center mx-auto"
        />
      </FadeIn>

      <div ref={containerRef} className="relative">
        <div className="absolute top-0 left-1/2 hidden h-full w-px -translate-x-1/2 bg-[var(--card-border)] md:block">
          <motion.div className="w-full bg-gradient-to-b from-[var(--text-muted)] to-[var(--card-border)]" style={{ height: progressHeight }} />
        </div>

        <div className="space-y-24 md:space-y-32">
          {steps.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <FadeIn key={step.title} delay={i * 0.1}>
                <div className={`flex flex-col gap-8 md:flex-row md:items-center md:gap-16 ${isEven ? "" : "md:flex-row-reverse"}`}>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border-hover)] bg-[var(--subtle-bg)]">
                        <step.icon size={16} className="text-[var(--text-muted)]" />
                      </div>
                      <span className="font-mono text-[11px] tracking-wider text-[var(--text-dim)] uppercase">{step.label}</span>
                    </div>
                    <h3 className="text-2xl font-medium tracking-tight text-[var(--text-heading)] md:text-3xl">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{step.description}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
                      <step.icon size={48} className="text-blue-400/20" />
                    </div>
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

/* ════════════════════════════════════════════════════════
 * TESTIMONIALS — Care
 * ════════════════════════════════════════════════════════ */

const careTestimonials = [
  {
    quote: "Credential tracking alone saved us from two audit findings. Everything is enforced before a shift even starts.",
    name: "Rachel Nguyen",
    role: "Compliance Manager",
    company: "BrightPath Disability Services",
    metric: "Zero audit gaps",
  },
  {
    quote: "We moved from paper MARs to iWorkr in a weekend. The eMAR module is exactly what NDIS providers need.",
    name: "Dr. Priya Mehta",
    role: "Clinical Director",
    company: "CareBridge Allied Health",
    metric: "Digital-first care",
  },
  {
    quote: "Our support workers clock in with GPS verification. The progress notes mean no more chasing shift reports.",
    name: "Tom Whitfield",
    role: "Operations Lead",
    company: "NurtureCo Home Care",
    metric: "Real-time visibility",
  },
  {
    quote: "Incident reporting used to take hours of paperwork. Now it's captured on-the-spot and audit-ready immediately.",
    name: "Sarah Huang",
    role: "Quality Manager",
    company: "AbilityPlus Services",
    metric: "Instant compliance",
  },
  {
    quote: "The rostering system understands NDIS. It won't let us schedule a worker without current screening — that's priceless.",
    name: "Marcus Chen",
    role: "Director",
    company: "SupportHub Care",
    metric: "100% compliant shifts",
  },
];

function NdisTestimonials() {
  const constraintRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });

  return (
    <Section id="testimonials" className="overflow-hidden">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(59,130,246,0.005) 0%, transparent 70%)" }} />

      <FadeIn>
        <SectionHeader
          label="Testimonials"
          title="Trusted by care providers who demand compliance."
          description="Real results from NDIS and care organisations that switched to iWorkr."
          className="text-center mx-auto"
        />
      </FadeIn>

      <div ref={constraintRef} className="relative -mx-6 md:-mx-12">
        <div className="overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 88%, transparent 100%)" }}>
          <motion.div drag="x" dragConstraints={{ left: -((careTestimonials.length - 1) * 400), right: 0 }} style={{ x: springX }} className="flex cursor-grab gap-5 px-6 active:cursor-grabbing md:px-12">
            {careTestimonials.map((t, i) => (
              <div key={t.name} className={`relative flex h-full w-[320px] flex-shrink-0 flex-col rounded-xl border border-[var(--card-border)] bg-[var(--testimonial-bg)] p-6 backdrop-blur-sm transition-all duration-300 sm:w-[380px] ${i === 0 ? "opacity-100" : "opacity-50 scale-[0.97]"}`}>
                <span className="mb-3 block text-5xl font-medium leading-none" style={{ color: "var(--text-dim)", opacity: 0.3 }}>&ldquo;</span>
                <p className="relative z-10 flex-1 text-[15px] leading-relaxed tracking-[-0.01em] text-[var(--text-heading)]">{t.quote}</p>
                <div className="my-4">
                  <span className="inline-block rounded-full border px-3 py-1 text-[10px] font-medium text-blue-300/70" style={{ borderColor: "rgba(59,130,246,0.1)", backgroundColor: "rgba(59,130,246,0.04)" }}>{t.metric}</span>
                </div>
                <div className="flex items-center gap-3 border-t border-[var(--card-border)] pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-400">{t.name.split(" ").map(n => n[0]).join("")}</div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{t.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{t.role}, {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
        <FadeIn delay={0.5} className="mt-6 text-center">
          <span className="text-xs text-[var(--text-dim)]">Drag to explore<span className="ml-2 inline-block animate-pulse">←→</span></span>
        </FadeIn>
      </div>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════
 * PRICING — Care (reuse plans)
 * ════════════════════════════════════════════════════════ */

function NdisPricing() {
  const [isYearly, setIsYearly] = useState(false);
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  const displayPlans = PLANS.filter((p) => p.key !== "free");

  function getCheckoutHref(plan: (typeof displayPlans)[0]) {
    if (plan.ctaLabel === "Contact sales") return "mailto:sales@iworkr.com";
    const interval = isYearly ? "yearly" : "monthly";
    if (isAuthenticated) {
      return `/checkout?plan=${plan.key}&interval=${interval}`;
    }
    return `/auth?mode=signup&next=${encodeURIComponent(`/checkout?plan=${plan.key}&interval=${interval}`)}`;
  }

  return (
    <Section id="pricing" className="overflow-hidden">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(59,130,246,0.006) 0%, transparent 70%)" }} />

      <FadeIn>
        <SectionHeader
          label="Pricing"
          title="Transparent pricing. No surprises."
          description="All care features included in every paid plan. Compliance, eMAR, incidents, and rostering — no add-ons."
          className="text-center mx-auto"
        />
      </FadeIn>

      <FadeIn delay={0.1} className="mb-12 flex justify-center">
        <div className="flex items-center gap-3">
          <span className={`text-sm ${!isYearly ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Monthly</span>
          <button onClick={() => setIsYearly(!isYearly)} className="relative h-6 w-11 rounded-full border border-[var(--card-border)] bg-[var(--subtle-bg)] transition-colors" aria-label="Toggle billing">
            <motion.div animate={{ x: isYearly ? 20 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-[var(--text-primary)]" />
          </button>
          <span className={`text-sm ${isYearly ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>Yearly <span className="text-blue-400 text-xs">save 20%</span></span>
        </div>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 gap-4 md:grid-cols-3" staggerDelay={0.08}>
        {displayPlans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <StaggerItem key={plan.key}>
              <div className={`relative rounded-xl border p-6 ${plan.highlighted ? "border-blue-500/20 bg-blue-500/[0.02]" : "border-[var(--card-border)] bg-[var(--card-bg)]"}`}>
                {plan.highlighted && <BorderBeam size={60} duration={12} colorFrom="rgba(59,130,246,0.3)" colorTo="rgba(37,99,235,0.15)" borderWidth={1} />}
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-[var(--text-heading)]">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{plan.description}</p>
                </div>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-sm text-[var(--text-muted)]">$</span>
                  <AnimatePresence mode="wait">
                    <motion.span key={price} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="text-5xl font-medium tracking-tight text-[var(--text-primary)]">{price}</motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-[var(--text-muted)]">/mo</span>
                </div>
                <SpotlightButton size="md" className="mb-6 w-full" href={getCheckoutHref(plan)} variant={plan.highlighted ? "primary" : "secondary"}>
                  {plan.ctaLabel}
                  <ArrowRight size={14} />
                </SpotlightButton>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                      <Check size={14} className="mt-0.5 shrink-0 text-blue-400/60" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════
 * FAQ — Care
 * ════════════════════════════════════════════════════════ */

const ndisFaqs = [
  {
    q: "Does iWorkr support NDIS compliance requirements?",
    a: "Yes. iWorkr enforces workforce credential requirements at the scheduling level — NDIS Worker Screening, Working With Children Check, and First Aid certificates must be current before a worker can be assigned to a shift. Expired or missing credentials automatically block scheduling and trigger alerts.",
  },
  {
    q: "What clinical features are included?",
    a: "iWorkr includes electronic medication administration records (eMAR), incident and restrictive practice reporting, health observation tracking (vitals, mood, pain scales), GPS-verified progress notes with shift duration, and participant care profile management.",
  },
  {
    q: "How does rostering work for care organisations?",
    a: "Our drag-and-drop rostering system is built for care. It matches support workers to participants based on skills, availability, location, and credential validity. The system prevents non-compliant assignments and optimises travel routes between shifts.",
  },
  {
    q: "Can I manage NDIS service agreements and budgets?",
    a: "Yes. iWorkr tracks service agreements with NDIS line items, budget allocations, and utilisation rates. You can monitor spending against plan budgets in real-time and integrate with Xero for automated invoicing.",
  },
  {
    q: "Does the mobile app work offline?",
    a: "Yes. Support workers can clock in, record progress notes, log medication administration, and capture health observations without signal. Everything syncs automatically when connectivity returns.",
  },
  {
    q: "Is there a contract or commitment?",
    a: "No contracts. No setup fees. Cancel anytime. Start with a 14-day free trial — all care features included. No credit card required.",
  },
];

function NdisFAQ() {
  return (
    <Section id="faq" className="overflow-hidden">
      <div className="stealth-noise" />
      <FadeIn>
        <SectionHeader label="FAQ" title="Questions answered." className="text-center mx-auto" />
      </FadeIn>
      <div className="mx-auto max-w-2xl">
        {ndisFaqs.map((faq, i) => (
          <NdisFAQItem key={faq.q} faq={faq} index={i} />
        ))}
      </div>
    </Section>
  );
}

function NdisFAQItem({ faq, index }: { faq: (typeof ndisFaqs)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="border-b border-[var(--card-border)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-5 text-left">
        <span className="pr-4 text-sm font-medium text-[var(--text-primary)] md:text-base">{faq.q}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--card-border-hover)] bg-[var(--subtle-bg)]">
          {open ? <Minus size={12} className="text-[var(--text-muted)]" /> : <Plus size={12} className="text-[var(--text-muted)]" />}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <p className="pb-5 text-sm leading-relaxed text-[var(--text-muted)]">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════
 * FINAL CTA — Care
 * ════════════════════════════════════════════════════════ */

function NdisCTA() {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  return (
    <section className="relative overflow-hidden py-32 md:py-40">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-[280px] font-bold leading-none tracking-tighter select-none sm:text-[400px] md:text-[600px]" style={{ color: "var(--cta-bg-text)" }}>iW</div>
      </div>
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.008) 0%, transparent 60%)" }} />
      <Particles className="pointer-events-none absolute inset-0" quantity={25} staticity={50} ease={50} size={0.3} color="#3B82F6" />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 text-center md:px-12">
        <FadeIn>
          <h2 className="mx-auto max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            <span style={{ backgroundImage: "linear-gradient(to bottom, var(--hero-grad-from), var(--hero-grad-to))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Built for care providers.
            </span>
            <br />
            <span className="text-[var(--text-muted)]">Audit-ready today.</span>
          </h2>
        </FadeIn>
        <FadeIn delay={0.15}>
          <p className="mx-auto mt-6 max-w-lg text-base text-[var(--text-muted)]">
            {isAuthenticated
              ? "Your workspace is ready. Pick up where you left off."
              : "Join NDIS providers, aged care organisations, and allied health teams already running on iWorkr. 14-day free trial. No credit card required."}
          </p>
        </FadeIn>
        <FadeIn delay={0.25}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isAuthenticated ? (
              <SpotlightButton size="lg" href="/dashboard">
                <LayoutDashboard size={16} />
                Open Dashboard
              </SpotlightButton>
            ) : (
              <>
                <SpotlightButton size="lg" href="/auth?mode=signup" variant="primary">
                  Start free trial
                  <ArrowRight size={16} />
                </SpotlightButton>
                <SpotlightButton variant="secondary" size="lg" href="mailto:sales@iworkr.com">
                  Contact sales
                </SpotlightButton>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════
 * PAGE EXPORT
 * ════════════════════════════════════════════════════════ */

export default function NdisPage() {
  return (
    <>
      <NdisNavbar />
      <main>
        <NdisHero />
        <NdisSocialProof />
        <NdisFeatures />
        <NdisWorkflow />
        <NdisTestimonials />
        <NdisPricing />
        <NdisFAQ />
        <NdisCTA />
      </main>
      <Footer />
    </>
  );
}
