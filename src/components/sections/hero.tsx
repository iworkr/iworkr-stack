"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import {
  ArrowRight,
  Sparkles,
  Smartphone,
  LayoutDashboard,
  Search,
  Calendar,
  MessageSquare,
  Briefcase,
  Users,
  FileText,
  BarChart3,
  Map,
  Wrench,
  ClipboardList,
  Zap,
  Puzzle,
  Bot,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { useAuthStore } from "@/lib/auth-store";
import { useDashboardPath } from "@/lib/hooks/use-dashboard-path";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Meteors } from "@/components/magicui/meteors";
import { Particles } from "@/components/magicui/particles";

/* ────────────────────────────────────────────────────────
 * Small SVG icons for the download strip
 * ──────────────────────────────────────────────────────── */

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.341a.998.998 0 0 1-.997-.998c0-.55.447-.997.997-.997s.998.447.998.997-.448.998-.998.998m-11.046 0a.998.998 0 0 1-.998-.998c0-.55.448-.997.998-.997s.997.447.997.997-.447.998-.997.998m11.4-6.423 1.9-3.29a.399.399 0 0 0-.146-.543.399.399 0 0 0-.544.146l-1.925 3.332A11.741 11.741 0 0 0 12 7.122a11.741 11.741 0 0 0-5.162 1.441L4.913 5.231a.399.399 0 0 0-.544-.146.399.399 0 0 0-.146.543l1.9 3.29C2.815 11.068.5 14.831.5 19.107h23c0-4.276-2.315-8.039-5.623-10.189" />
    </svg>
  );
}

const downloadPlatforms = [
  { id: "macos", name: "macOS", iconType: "apple" as const },
  { id: "windows", name: "Windows", iconType: "windows" as const },
  { id: "ios", name: "iOS", iconType: "ios" as const },
  { id: "android", name: "Android", iconType: "android" as const },
];

function PlatformIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "h-[14px] w-[14px]";
  switch (type) {
    case "apple":
      return <AppleIcon className={cls} />;
    case "windows":
      return <WindowsIcon className={cls} />;
    case "ios":
      return <Smartphone size={14} strokeWidth={1.5} className={cls} />;
    case "android":
      return <AndroidIcon className={cls} />;
    default:
      return null;
  }
}

/* ────────────────────────────────────────────────────────
 * Detect user platform for the download button icon
 * ──────────────────────────────────────────────────────── */

type Platform = "apple" | "windows" | "ios" | "android";

function useDetectPlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("apple");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const uaPlatform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";

    if (/android/i.test(ua)) {
      setPlatform("android");
    } else if (/iPad|iPhone|iPod/.test(ua) || (/Mac/.test(uaPlatform) && "ontouchstart" in window)) {
      setPlatform("ios");
    } else if (/Win/.test(uaPlatform)) {
      setPlatform("windows");
    } else {
      setPlatform("apple"); // macOS default
    }
  }, []);

  return platform;
}

/* ────────────────────────────────────────────────────────
 * Word-stagger animation variants
 * ──────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────
 * Hero component
 * ──────────────────────────────────────────────────────── */

export function Hero() {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  const dashboardPath = useDashboardPath();
  const words = "The operating system for service work.".split(" ");
  const detectedPlatform = useDetectPlatform();

  /* ── Scroll-driven tilt for the scheduler mockup ── */
  const mockupRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: mockupRef,
    offset: ["start end", "end start"],
  });
  // Starts tilted at 12deg, flattens to 0 as it scrolls into the middle of the viewport
  const rotateX = useTransform(scrollYProgress, [0, 0.45], [12, 0]);
  const mockupScale = useTransform(scrollYProgress, [0, 0.45], [0.96, 1]);
  const mockupY = useTransform(scrollYProgress, [0, 0.45], [40, 0]);
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-6 pt-24 pb-16">

      {/* ─── BACKGROUND LAYER ─── */}
      <div className="stealth-noise" />

      <div className="pointer-events-none absolute top-0 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/4">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.008) 0%, transparent 70%)",
          }}
        />
      </div>

      <Particles className="pointer-events-none absolute inset-0" quantity={20} staticity={50} ease={50} size={0.2} color="#10B981" />
      <Meteors number={14} angle={0} minDuration={3} maxDuration={6} minDelay={0.2} maxDelay={2} className="opacity-50" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Announcement Pill */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge glow className="mb-8 cursor-pointer hover:border-white/10">
            <Sparkles size={14} className="text-zinc-400" />
            <AnimatedShinyText shimmerWidth={80}>New: AI Phone Agent for automatic dispatch</AnimatedShinyText>
            <ArrowRight size={12} className="text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-0.5" />
          </Badge>
        </motion.div>

        {/* H1 with staggered words */}
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
          Purpose-built for plumbers, electricians, and field teams. Manage
          jobs, scheduling, and payments with engineering precision.
        </motion.p>

        {/* CTA Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4"
        >
          {isAuthenticated ? (
            <SpotlightButton size="lg" href={dashboardPath} variant="primary">
              <LayoutDashboard size={16} />
              Open Dashboard
            </SpotlightButton>
          ) : (
            <>
              <SpotlightButton
                size="lg"
                href="/auth"
                variant="primary"
              >
                Start building free
                <ArrowRight size={16} />
              </SpotlightButton>
              <SpotlightButton
                size="lg"
                href="/download"
                variant="secondary"
              >
                <PlatformIcon type={detectedPlatform} className="h-4 w-4 opacity-70" />
                Download app
              </SpotlightButton>
            </>
          )}
        </motion.div>

        {/* Download Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-[var(--border-base)]" />
            <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--text-dim)]">
              Available on
            </span>
            <div className="h-px w-8 bg-[var(--border-base)]" />
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] p-1">
            {downloadPlatforms.map((p, i) => (
              <motion.a
                key={p.id}
                href="/download"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 1.25 + i * 0.06,
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all duration-200 hover:bg-[var(--subtle-bg-hover)]"
              >
                <div className="text-[var(--text-dim)] transition-colors duration-200 group-hover:text-[var(--text-primary)]">
                  <PlatformIcon type={p.iconType} />
                </div>
                <span className="text-[11px] text-[var(--text-dim)] transition-colors duration-200 group-hover:text-[var(--text-muted)]">
                  {p.name}
                </span>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Hero Visual: App Mockup — single flat card */}
      <motion.div
        ref={mockupRef}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 1.2,
          duration: 1,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 mt-20 w-full max-w-6xl overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--background)]"
        style={{
          rotateX,
          scale: mockupScale,
          y: mockupY,
          transformPerspective: 1200,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
          {/* ─── App Shell ─── */}
          <div className="flex min-h-[420px] md:min-h-[520px]">

            {/* ─── Sidebar ─── */}
            <div className="hidden w-[180px] flex-shrink-0 flex-col border-r border-[var(--card-border)] bg-[var(--surface-1)] md:flex">
              {/* Workspace logo */}
              <div className="flex items-center gap-2.5 border-b border-[var(--card-border)] px-3 py-2.5">
                <Image
                  src="/logos/logo-dark-full.png"
                  alt="iWorkr"
                  width={72}
                  height={18}
                  className="h-[14px] w-auto object-contain"
                />
              </div>

              {/* Nav section */}
              <div className="flex flex-1 flex-col px-2 pt-3">
                <span className="mb-1.5 px-2 font-mono text-[8px] font-semibold tracking-[0.1em] uppercase text-[var(--text-dim)]">Workspace</span>
                {[
                  { label: "Dashboard", icon: LayoutDashboard, active: false },
                  { label: "Messages", icon: MessageSquare, active: false, badge: "3" },
                  { label: "My Jobs", icon: Briefcase, active: false },
                  { label: "Schedule", icon: Calendar, active: true },
                  { label: "Dispatch", icon: Map, active: false },
                  { label: "Clients", icon: Users, active: false },
                  { label: "Sales Pipeline", icon: BarChart3, active: false },
                  { label: "Finance", icon: FileText, active: false },
                  { label: "Assets", icon: Wrench, active: false },
                  { label: "Forms", icon: ClipboardList, active: false },
                  { label: "Team", icon: Users, active: false },
                  { label: "Automations", icon: Zap, active: false },
                  { label: "Integrations", icon: Puzzle, active: false },
                  { label: "AI Agent", icon: Bot, active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-[5px] text-[10px] transition-colors ${
                      item.active
                        ? "bg-white/[0.06] font-medium text-[var(--text-heading)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                    }`}
                  >
                    <item.icon size={12} strokeWidth={1.5} className={item.active ? "text-[var(--text-heading)]" : "text-[var(--text-dim)]"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500/15 px-1 text-[8px] font-medium text-rose-400">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}

                {/* Team section at bottom */}
                <div className="mt-auto border-t border-[var(--card-border)] pt-2 pb-3">
                  <span className="mb-1 px-2 font-mono text-[8px] font-semibold tracking-[0.1em] uppercase text-[var(--text-dim)]">Your Team</span>
                  <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-1">
                    <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[var(--avatar-bg)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="https://api.dicebear.com/9.x/notionists/svg?seed=Jordan" alt="" className="h-full w-full" />
                      <div className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-[1.5px] border-[var(--surface-1)] bg-emerald-500" />
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-heading)]">Jordan Mitchell</div>
                      <div className="text-[8px] text-[var(--text-dim)]">Admin</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Main Content Area ─── */}
            <div className="flex flex-1 flex-col">
              {/* Topbar */}
              <div className="flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--surface-1)]/50 px-4 py-2">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Image
                    src="/logos/logo-mark.png"
                    alt="iWorkr"
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <ChevronRight size={10} className="text-[var(--text-dim)]" />
                  <span className="text-[var(--text-dim)]">Home</span>
                  <ChevronRight size={10} className="text-[var(--text-dim)]" />
                  <span className="text-[var(--text-dim)]">Dashboard</span>
                  <ChevronRight size={10} className="text-[var(--text-dim)]" />
                  <span className="text-[var(--text-heading)]">Schedule</span>
                </div>
                {/* Search + Avatar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--subtle-bg)] px-2 py-1">
                    <Search size={10} className="text-[var(--text-dim)]" />
                    <span className="text-[9px] text-[var(--text-dim)]">Search...</span>
                  </div>
                  <div className="h-5 w-5 overflow-hidden rounded-full bg-[var(--avatar-bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://api.dicebear.com/9.x/notionists/svg?seed=Jordan" alt="" className="h-full w-full" />
                  </div>
                </div>
              </div>

              {/* Schedule Header */}
              <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--text-dim)]">Tactical Timeline</div>
                    <div className="text-sm font-medium tracking-tight text-[var(--text-heading)]">Wed, March 11, 2026</div>
                  </div>
                  <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[9px] font-medium text-[var(--text-heading)]">Today</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Day/Week/Month toggle */}
                  <div className="flex rounded-md border border-[var(--card-border)] bg-[var(--subtle-bg)]">
                    {["Day", "Week", "Month"].map((v, i) => (
                      <button
                        key={v}
                        className={`px-2.5 py-1 text-[9px] font-medium transition-colors ${
                          i === 0
                            ? "bg-[var(--text-primary)] text-[var(--background)] rounded-l-md"
                            : "text-[var(--text-dim)]"
                        } ${i === 2 ? "rounded-r-md" : ""}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <button className="flex items-center gap-1 rounded-md border border-[var(--card-border)] px-2 py-1 text-[9px] text-[var(--text-muted)]">
                    <Map size={10} /> BackMap
                  </button>
                </div>
              </div>

              {/* ─── Timeline Grid ─── */}
              <div className="flex flex-1 overflow-hidden">
                {/* Timeline content area */}
                <div className="flex-1 overflow-hidden">
                  {/* Time column headers */}
                  <div className="flex border-b border-[var(--card-border)]">
                    {/* Tech name spacer */}
                    <div className="w-[100px] shrink-0 border-r border-[var(--card-border)]" />
                    {/* Time labels */}
                    <div className="flex flex-1">
                      {["6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"].map((t) => (
                        <div key={t} className="flex-1 border-r border-[var(--grid-line)] px-1 py-1.5 text-center font-mono text-[8px] text-[var(--text-dim)]">
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tech rows */}
                  {[
                    {
                      name: "Mike Thompson",
                      role: "Senior Plumber",
                      online: true,
                      avatar: "Mike",
                      jobs: [
                        { title: "Water heater install", client: "David Park", time: "8 AM — 10 AM", start: 2, span: 2, status: "in_progress" as const },
                        { title: "Boiler service", client: "Sarah Mitchell", time: "11 AM — 12 PM", start: 5, span: 1, status: "scheduled" as const },
                        { title: "Pipe repair", client: "James Wilson", time: "2 PM — 4 PM", start: 8, span: 2, status: "scheduled" as const },
                      ],
                    },
                    {
                      name: "Sarah Chen",
                      role: "Electrician",
                      online: true,
                      avatar: "Sarah",
                      jobs: [
                        { title: "Panel upgrade", client: "Lisa Chen", time: "7 AM — 9 AM", start: 1, span: 2, status: "complete" as const },
                        { title: "Outlet install", client: "Tom Harris", time: "10 AM — 11 AM", start: 4, span: 1, status: "en_route" as const },
                        { title: "Wiring inspection", client: "Amy Brooks", time: "1 PM — 3 PM", start: 7, span: 2, status: "scheduled" as const },
                      ],
                    },
                    {
                      name: "James O'Brien",
                      role: "HVAC Tech",
                      online: false,
                      avatar: "James",
                      jobs: [
                        { title: "AC maintenance", client: "Robert Kim", time: "9 AM — 11 AM", start: 3, span: 2, status: "on_site" as const },
                        { title: "Duct cleaning", client: "Karen Lee", time: "12 PM — 2 PM", start: 6, span: 2, status: "scheduled" as const },
                      ],
                    },
                    {
                      name: "Emma Davis",
                      role: "Plumber",
                      online: true,
                      avatar: "Emma",
                      jobs: [
                        { title: "Emergency callout", client: "David R.", time: "8 AM — 9 AM", start: 2, span: 1, status: "in_progress" as const },
                        { title: "Drain clearing", client: "N. Patterson", time: "10 AM — 12 PM", start: 4, span: 2, status: "scheduled" as const },
                        { title: "Fixture install", client: "C. Thompson", time: "3 PM — 5 PM", start: 9, span: 2, status: "scheduled" as const },
                      ],
                    },
                  ].map((tech, techIdx) => (
                    <div key={tech.name} className="flex border-b border-[var(--grid-line)]">
                      {/* Tech info */}
                      <div className="flex w-[100px] shrink-0 items-center gap-2 border-r border-[var(--card-border)] px-3 py-2">
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[var(--avatar-bg)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${tech.avatar}`} alt="" className="h-full w-full" />
                          <div className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-[1.5px] border-[var(--background)] ${tech.online ? "bg-emerald-500" : "bg-zinc-600"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[10px] font-medium text-[var(--text-heading)]">{tech.name}</div>
                          <div className="truncate text-[8px] text-[var(--text-dim)]">{tech.role}</div>
                        </div>
                      </div>
                      {/* Timeline row */}
                      <div className="relative flex flex-1" style={{ minHeight: 72 }}>
                        {/* Grid columns */}
                        {Array.from({ length: 12 }).map((_, ci) => (
                          <div key={ci} className="flex-1 border-r border-[var(--grid-line)]" />
                        ))}
                        {/* Job blocks */}
                        {tech.jobs.map((job, blockIdx) => {
                          const statusStyles = {
                            scheduled: "border-l-sky-500 bg-sky-500/[0.08] text-sky-100",
                            en_route: "border-l-amber-500 bg-amber-500/[0.08] text-amber-100",
                            on_site: "border-l-violet-500 bg-violet-500/[0.08] text-violet-100",
                            in_progress: "border-l-emerald-500 bg-emerald-500/[0.08] text-emerald-100",
                            complete: "border-l-zinc-600 bg-zinc-500/[0.05] text-zinc-400",
                          };
                          const dotStyles = {
                            scheduled: "bg-sky-400",
                            en_route: "bg-amber-400",
                            on_site: "bg-violet-400",
                            in_progress: "bg-emerald-400",
                            complete: "bg-zinc-500",
                          };
                          // Each column = 1/12 of width = 1 hour starting at 6 AM
                          const left = `${(job.start / 12) * 100}%`;
                          const width = `${(job.span / 12) * 100}%`;
                          return (
                            <motion.div
                              key={job.title}
                              initial={{ opacity: 0, scaleX: 0 }}
                              animate={{ opacity: 1, scaleX: 1 }}
                              transition={{
                                delay: 1.8 + techIdx * 0.08 + blockIdx * 0.06,
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className={`absolute top-2 origin-left rounded-lg border-l-2 backdrop-blur-sm px-2 py-1.5 flex flex-col justify-center ${statusStyles[job.status]}`}
                              style={{ left, width, height: "calc(100% - 16px)" }}
                            >
                              <div className="flex items-center gap-1">
                                <div className={`h-1.5 w-1.5 rounded-full ${dotStyles[job.status]}`} />
                                <span className="font-mono text-[7px] opacity-60">{job.time}</span>
                              </div>
                              <div className="mt-0.5 truncate text-[9px] font-medium leading-tight">{job.title}</div>
                              <div className="truncate text-[8px] opacity-50">{job.client}</div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ─── Unassigned Jobs Panel ─── */}
                <div className="hidden w-[180px] shrink-0 flex-col border-l border-[var(--card-border)] lg:flex">
                  <div className="flex items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
                    <div>
                      <div className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--text-dim)]">Backlog</div>
                      <div className="text-[10px] font-medium text-[var(--text-heading)]">Unassigned Jobs</div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 p-2">
                    {[
                      { title: "Tap replacement", client: "M. Brown", priority: "medium" },
                      { title: "Gas line check", client: "P. Jones", priority: "high" },
                      { title: "Toilet repair", client: "S. Williams", priority: "low" },
                    ].map((job, i) => (
                      <motion.div
                        key={job.title}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 2.2 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-lg border border-[var(--card-border)] bg-[var(--subtle-bg)] p-2 cursor-grab"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`h-1.5 w-1.5 rounded-full ${
                            job.priority === "high" ? "bg-rose-400" : job.priority === "medium" ? "bg-amber-400" : "bg-sky-400"
                          }`} />
                          <span className="text-[9px] font-medium text-[var(--text-heading)]">{job.title}</span>
                        </div>
                        <div className="mt-0.5 text-[8px] text-[var(--text-dim)]">{job.client}</div>
                      </motion.div>
                    ))}
                    <div className="mt-2 text-center text-[8px] text-[var(--text-dim)]">
                      Drag to assign to timeline
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Animated border beam */}
          <BorderBeam size={80} duration={14} colorFrom="rgba(16,185,129,0.25)" colorTo="rgba(5,150,105,0.1)" borderWidth={1} />
      </motion.div>
    </section>
  );
}
