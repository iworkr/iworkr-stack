"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SpotlightButton } from "@/components/ui/spotlight-button";

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
  const words = "The operating system for service work.".split(" ");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-16">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[800px] w-[1200px] -translate-x-1/2 -translate-y-1/4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
      </div>

      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Announcement Pill */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge glow className="mb-8 cursor-pointer">
            <Sparkles size={14} className="text-zinc-500" />
            <span>New: AI Phone Agent for automatic dispatch</span>
            <ArrowRight size={12} className="text-zinc-500" />
          </Badge>
        </motion.div>

        {/* H1 with staggered words */}
        <h1 className="mb-6 text-5xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-6xl md:text-7xl lg:text-[76px]">
          {words.map((word, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={wordVariants}
              initial="hidden"
              animate="visible"
              className="mr-[0.25em] inline-block bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent"
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
          className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-zinc-400"
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
          <SpotlightButton size="lg" href="/auth">
            Start building free
            <ArrowRight size={16} />
          </SpotlightButton>
          <span className="hidden items-center gap-1.5 rounded border border-[rgba(255,255,255,0.08)] px-2 py-1 font-mono text-[11px] text-zinc-500 sm:flex">
            <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px]">
              C
            </kbd>
            to get started
          </span>
        </motion.div>

        {/* Download Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <span className="text-[11px] tracking-widest uppercase text-zinc-600">
            Download
          </span>
          <div className="flex items-center gap-1">
            {downloadPlatforms.map((p, i) => (
              <motion.a
                key={p.id}
                href="/auth"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 1.25 + i * 0.06,
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-zinc-500 transition-all duration-200 group-hover:border-[rgba(255,255,255,0.15)] group-hover:bg-[rgba(255,255,255,0.06)] group-hover:text-zinc-300">
                  <PlatformIcon type={p.iconType} />
                </div>
                <span className="text-[10px] text-zinc-600 transition-colors duration-200 group-hover:text-zinc-400">
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
        {/* Glow beneath */}
        <div className="absolute inset-x-0 -bottom-20 h-40 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />

        {/* The UI mockup */}
        <div
          className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] shadow-2xl"
          style={{
            transform: "perspective(1200px) rotateX(2deg)",
          }}
        >
          {/* Window Chrome */}
          <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-[rgba(255,255,255,0.1)]" />
            <div className="h-3 w-3 rounded-full bg-[rgba(255,255,255,0.1)]" />
            <div className="h-3 w-3 rounded-full bg-[rgba(255,255,255,0.1)]" />
            <div className="ml-4 flex-1 rounded-md bg-[rgba(255,255,255,0.04)] px-3 py-1 text-center">
              <span className="font-mono text-[11px] text-zinc-600">
                app.iworkr.com/scheduler
              </span>
            </div>
          </div>

          {/* App Content Mockup */}
          <div className="flex min-h-[400px] md:min-h-[500px]">
            {/* Sidebar */}
            <div className="hidden w-52 flex-shrink-0 border-r border-[rgba(255,255,255,0.06)] p-4 md:block">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-white/10" />
                <span className="text-xs font-medium text-zinc-400">
                  Apex Plumbing
                </span>
              </div>
              {["Dashboard", "Scheduler", "Jobs", "Clients", "Invoices", "Reports"].map(
                (item, i) => (
                  <div
                    key={item}
                    className={`mb-1 rounded-md px-3 py-2 text-xs ${
                      i === 1
                        ? "bg-[rgba(255,255,255,0.06)] font-medium text-zinc-200"
                        : "text-zinc-500"
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
                <span className="text-sm font-medium text-zinc-300">
                  February 2026
                </span>
                <div className="flex gap-1">
                  <div className="rounded-md bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs text-zinc-400">
                    Day
                  </div>
                  <div className="rounded-md px-3 py-1 text-xs text-zinc-600">
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
                      className="flex border-t border-[rgba(255,255,255,0.04)]"
                    >
                      <span className="w-16 shrink-0 py-3 pr-3 text-right font-mono text-[10px] text-zinc-600">
                        {time}
                      </span>
                      <div className="relative flex-1 py-1">
                        {i === 0 && (
                          <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="origin-left rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5"
                          >
                            <div className="text-[10px] font-medium text-blue-300">
                              Water heater install
                            </div>
                            <div className="text-[9px] text-blue-400/60">
                              Mike T. — 42 Oak Ave
                            </div>
                          </motion.div>
                        )}
                        {i === 1 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            transition={{ delay: 2.3, duration: 0.5 }}
                            className="rounded-md bg-zinc-800/50 px-2 py-1 text-[9px] italic text-zinc-500"
                          >
                            Travel time · 22 min
                          </motion.div>
                        )}
                        {i === 2 && (
                          <motion.div
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            transition={{ delay: 2.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="origin-left rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5"
                          >
                            <div className="text-[10px] font-medium text-emerald-300">
                              Boiler service
                            </div>
                            <div className="text-[9px] text-emerald-400/60">
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
                            <div className="text-[10px] font-medium text-amber-300">
                              Emergency callout
                            </div>
                            <div className="text-[9px] text-amber-400/60">
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
            <div className="hidden w-56 flex-shrink-0 border-l border-[rgba(255,255,255,0.06)] p-4 lg:block">
              <span className="mb-3 block text-xs font-medium text-zinc-400">
                Team
              </span>
              {[
                { name: "Mike Thompson", status: "On job", color: "bg-emerald-500" },
                { name: "Sarah Chen", status: "En route", color: "bg-blue-500" },
                { name: "James O'Brien", status: "Available", color: "bg-zinc-500" },
              ].map((person) => (
                <div
                  key={person.name}
                  className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <div className="relative h-6 w-6 rounded-full bg-zinc-800">
                    <div
                      className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-black ${person.color}`}
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-zinc-300">
                      {person.name}
                    </div>
                    <div className="text-[9px] text-zinc-600">
                      {person.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute inset-x-0 -bottom-1 h-32 bg-gradient-to-t from-black to-transparent" />
      </motion.div>
    </section>
  );
}
