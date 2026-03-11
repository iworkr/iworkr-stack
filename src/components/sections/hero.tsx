"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Smartphone, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SpotlightButton } from "@/components/ui/spotlight-button";
import { useAuthStore } from "@/lib/auth-store";
import { AnimatedShinyText } from "@/components/magicui/animated-shiny-text";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Particles } from "@/components/magicui/particles";
import createGlobe, { type COBEOptions } from "cobe";
import { useEffect, useRef, useCallback } from "react";

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

function PlatformIcon({ type }: { type: string }) {
  const cls = "h-[14px] w-[14px]";
  switch (type) {
    case "apple":
      return <AppleIcon className={cls} />;
    case "windows":
      return <WindowsIcon className={cls} />;
    case "ios":
      return <Smartphone size={14} strokeWidth={1.5} />;
    case "android":
      return <AndroidIcon className={cls} />;
    default:
      return null;
  }
}

/* ── Hero Globe ──────────────────────────────────────── */

function HeroGlobe({ config }: { config: COBEOptions }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);

  const onRender = useCallback((state: Record<string, unknown>) => {
    phiRef.current += 0.005;
    state.phi = phiRef.current;
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      ...config,
      width: 1200,
      height: 1200,
      onRender,
    });

    // Fade in
    requestAnimationFrame(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    });

    return () => globe.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[6%] z-[1] -translate-x-1/2 opacity-40"
      style={{
        width: "min(1000px, 95vw)",
        height: "min(1000px, 95vw)",
        maskImage: "radial-gradient(circle at 50% 40%, black 20%, transparent 65%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 20%, transparent 65%)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full opacity-0 transition-opacity duration-1000"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [0.05, 0.05, 0.05],
  markerColor: [16 / 255, 185 / 255, 129 / 255],
  glowColor: [0.04, 0.04, 0.04],
  markers: [
    // Major cities where field service operates
    { location: [-27.4698, 153.0251], size: 0.08 }, // Brisbane (HQ)
    { location: [-33.8688, 151.2093], size: 0.06 }, // Sydney
    { location: [-37.8136, 144.9631], size: 0.06 }, // Melbourne
    { location: [51.5074, -0.1278], size: 0.05 },   // London
    { location: [40.7128, -74.006], size: 0.07 },    // New York
    { location: [34.0522, -118.2437], size: 0.05 },  // Los Angeles
    { location: [49.2827, -123.1207], size: 0.04 },  // Vancouver
    { location: [1.3521, 103.8198], size: 0.04 },    // Singapore
    { location: [35.6762, 139.6503], size: 0.04 },   // Tokyo
    { location: [-36.8485, 174.7633], size: 0.05 },  // Auckland
  ],
};

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

export function Hero() {
  const { user, initialized } = useAuthStore();
  const isAuthenticated = initialized && !!user;
  const words = "The operating system for service work.".split(" ");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-6 pt-24 pb-16">
      {/* Subtle noise texture */}
      <div className="stealth-noise" />

      {/* Soft emerald radial glow — very subtle, atmospheric */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/4">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, rgba(16,185,129,0.015) 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Floating particles */}
      <Particles className="pointer-events-none absolute inset-0" quantity={40} staticity={40} ease={40} size={0.3} color="#10B981" />

      {/* Globe — large, dark, behind text and mockup */}
      <HeroGlobe config={GLOBE_CONFIG} />

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
                backgroundImage: `linear-gradient(to bottom, var(--hero-grad-from), var(--hero-grad-to))`,
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
            <SpotlightButton size="lg" href="/dashboard" className="bg-[var(--brand)] text-white border-transparent hover:bg-[var(--brand-hover)]">
              <LayoutDashboard size={16} />
              Open Dashboard
            </SpotlightButton>
          ) : (
            <>
              <SpotlightButton
                size="lg"
                href="/auth"
                className="bg-[var(--brand)] text-white border-transparent hover:bg-[var(--brand-hover)]"
              >
                Start building free
                <ArrowRight size={16} />
              </SpotlightButton>
              <SpotlightButton
                size="lg"
                href="/download"
                variant="secondary"
                className="border-[var(--border-base)] text-[var(--text-muted)] hover:border-[var(--border-active)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]"
              >
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

      {/* Hero Visual: App Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{
          delay: 1.2,
          duration: 1,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative mt-20 w-full max-w-5xl"
        style={{ perspective: "1200px" }}
      >
        {/* The UI mockup */}
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--surface-1)] shadow-2xl"
          style={{
            transform: "perspective(1200px) rotateX(2deg)",
            boxShadow: "0 25px 60px -12px rgba(0,0,0,0.6)",
          }}
        >
          {/* Window Chrome */}
          <div className="flex items-center gap-2 border-b border-[var(--card-border)] px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-[var(--subtle-bg-hover)]" />
            <div className="h-3 w-3 rounded-full bg-[var(--subtle-bg-hover)]" />
            <div className="h-3 w-3 rounded-full bg-[var(--subtle-bg-hover)]" />
            <div className="ml-4 flex-1 rounded-md bg-[var(--subtle-bg)] px-3 py-1 text-center">
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                app.iworkr.com/scheduler
              </span>
            </div>
          </div>

          {/* App Content Mockup */}
          <div className="flex min-h-[400px] md:min-h-[500px]">
            {/* Sidebar */}
            <div className="hidden w-52 flex-shrink-0 border-r border-[var(--card-border)] p-4 md:block">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-[var(--subtle-bg-hover)]" />
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  Apex Plumbing
                </span>
              </div>
              {["Dashboard", "Scheduler", "Jobs", "Clients", "Invoices", "Reports"].map(
                (item, i) => (
                  <div
                    key={item}
                    className={`mb-1 rounded-md px-3 py-2 text-xs ${
                      i === 1
                        ? "bg-[var(--subtle-bg-hover)] font-medium text-[var(--text-heading)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {item}
                  </div>
                )
              )}
            </div>

            {/* Main Content - Calendar */}
            <div className="flex-1 p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-heading)]">
                  February 2026
                </span>
                <div className="flex gap-1">
                  <div className="rounded-md bg-[var(--subtle-bg-hover)] px-3 py-1 text-xs text-[var(--text-muted)]">
                    Day
                  </div>
                  <div className="rounded-md px-3 py-1 text-xs text-[var(--text-dim)]">
                    Week
                  </div>
                </div>
              </div>

              {/* Time Grid */}
              <div className="space-y-0">
                {["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM"].map(
                  (time, i) => (
                    <div
                      key={time}
                      className="flex border-t border-[var(--grid-line)]"
                    >
                      <span className="w-16 shrink-0 py-3 pr-3 text-right font-mono text-[10px] text-[var(--text-dim)]">
                        {time}
                      </span>
                      <div className="relative flex-1 py-1">
                        {i === 0 && (
                          <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="origin-left rounded-md border border-emerald-500/10 bg-emerald-500/[0.04] px-2 py-1.5"
                          >
                            <div className="text-[10px] font-medium text-zinc-200">
                              Water heater install
                            </div>
                            <div className="text-[9px] text-zinc-500">
                              Mike T. — 42 Oak Ave
                            </div>
                          </motion.div>
                        )}
                        {i === 1 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            transition={{ delay: 2.3, duration: 0.5 }}
                            className="rounded-md bg-[var(--subtle-bg)] px-2 py-1 text-[9px] italic text-[var(--text-muted)]"
                          >
                            Travel time · 22 min
                          </motion.div>
                        )}
                        {i === 2 && (
                          <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 2.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="origin-left rounded-md border border-emerald-500/10 bg-emerald-500/[0.04] px-2 py-1.5"
                          >
                            <div className="text-[10px] font-medium text-zinc-200">
                              Boiler service
                            </div>
                            <div className="text-[9px] text-zinc-500">
                              Sarah L. — 17 Pine Rd
                            </div>
                          </motion.div>
                        )}
                        {i === 4 && (
                          <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 2.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="origin-left rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5"
                          >
                            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Emergency callout
                            </div>
                            <div className="text-[9px] text-amber-600/60 dark:text-amber-400/60">
                              David R. — 8 Elm St
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="hidden w-56 flex-shrink-0 border-l border-[var(--card-border)] p-4 lg:block">
              <span className="mb-3 block text-xs font-medium text-[var(--text-muted)]">
                Team
              </span>
              {[
                { name: "Mike Thompson", status: "On job", color: "bg-emerald-500" },
                { name: "Sarah Chen", status: "En route", color: "bg-emerald-500/60" },
                { name: "James O'Brien", status: "Available", color: "bg-zinc-500" },
              ].map((person) => (
                <div
                  key={person.name}
                  className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <div className="relative h-6 w-6 rounded-full bg-[var(--avatar-bg)]">
                    <div
                      className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] ${person.color}`}
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--text-heading)]">
                      {person.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-dim)]">
                      {person.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Animated border beam */}
          <BorderBeam size={120} duration={8} colorFrom="#10B981" colorTo="#059669" borderWidth={1} />
        </div>

        {/* Bottom gradient fade */}
        <div
          className="absolute inset-x-0 -bottom-1 h-32"
          style={{
            background: `linear-gradient(to top, var(--section-fade), transparent)`,
          }}
        />
      </motion.div>
    </section>
  );
}
