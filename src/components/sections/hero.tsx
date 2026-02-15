"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SpotlightButton } from "@/components/ui/spotlight-button";

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
          <SpotlightButton size="lg" href="#pricing">
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
