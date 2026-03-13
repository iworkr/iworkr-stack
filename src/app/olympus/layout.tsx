"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Super Admin Layout
   Obsidian Absolute: #000 background, crimson accents, high-density
   Completely isolated from the standard dashboard layout.
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  CreditCard,
  Database,
  Activity,
  Shield,
  ChevronRight,
  Search,
  LogOut,
  AlertTriangle,
  Zap,
  Radar,
} from "lucide-react";

/* ── Nav Items ────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: "workspaces", label: "Workspaces", icon: Building2, href: "/olympus/workspaces" },
  { id: "users", label: "Users", icon: Users, href: "/olympus/users" },
  { id: "billing", label: "Billing", icon: CreditCard, href: "/olympus/billing" },
  { id: "database", label: "Database", icon: Database, href: "/olympus/database" },
  { id: "health", label: "Health", icon: Radar, href: "/olympus/health" },
  { id: "system", label: "System", icon: Activity, href: "/olympus/system" },
];

/* ── Sidebar ──────────────────────────────────────────────────── */

function OlympusSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[220px] min-w-[220px] flex-col border-r border-red-500/[0.08] bg-black">
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 ring-1 ring-red-500/20">
          <Shield size={15} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-[13px] font-bold text-white tracking-tight">Olympus</h1>
          <span className="text-[9px] font-mono font-bold tracking-widest text-red-500/60 uppercase">GOD MODE</span>
        </div>
      </div>

      {/* ── Warning Banner ── */}
      <div className="mx-3 mb-3 flex items-center gap-1.5 rounded-md border border-red-500/15 bg-red-500/[0.04] px-2.5 py-1.5">
        <AlertTriangle size={10} className="flex-shrink-0 text-red-400" />
        <span className="text-[8px] font-medium text-red-400/70">PRODUCTION DATA</span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="olympus-nav"
                  className="absolute inset-0 rounded-lg bg-red-500/[0.08] ring-1 ring-inset ring-red-500/10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon size={14} className={`relative z-10 ${isActive ? "text-red-400" : ""}`} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-red-500/[0.06] px-3 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-300 hover:bg-white/[0.02]"
        >
          <LogOut size={13} />
          Exit to Dashboard
        </Link>
      </div>
    </div>
  );
}

/* ── Layout ───────────────────────────────────────────────────── */

export default function OlympusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      <OlympusSidebar />
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={usePathname()}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
