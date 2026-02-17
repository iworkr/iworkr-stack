"use client";

import Link from "next/link";
import { ArrowLeft, Ticket } from "lucide-react";
import type { ReactNode } from "react";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 min-h-screen overflow-y-auto bg-black text-white selection:bg-[#00E676]/30">
      {/* Ambient Green Glow — PRD: Spotlight Effect */}
      <div className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2">
        <div className="h-[500px] w-[1000px] rounded-full bg-[#00E676]/[0.07] blur-[140px]" />
      </div>

      {/* Noise grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

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
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/[0.1] hover:text-zinc-200"
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
