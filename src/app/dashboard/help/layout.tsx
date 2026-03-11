"use client";

import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";
import type { ReactNode } from "react";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 min-h-screen overflow-y-auto bg-[var(--background)] text-white selection:bg-white/10">
      {/* Atmospheric glow — neutral */}
      <div className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2">
        <div className="h-[400px] w-[800px] rounded-full bg-white/[0.02] blur-[140px]" />
      </div>

      {/* Noise grain — standardized */}
      <div className="stealth-noise fixed z-[60]" />

      {/* Minimal Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[13px] text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/help#tickets"
            className="flex items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--border-base)] bg-[var(--subtle-bg)] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-[var(--border-active)] hover:text-zinc-200"
          >
            <Ticket size={12} />
            My Tickets
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
