"use client";

import { useAuthStore } from "@/lib/auth-store";
import { ShieldX, ArrowLeft } from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════
// ── Project Aegis — Unauthorized Page ────────────────────────
// Obsidian design. Shown when RBAC middleware blocks a route.
// ═══════════════════════════════════════════════════════════════

export default function UnauthorizedPage() {
  const role = useAuthStore((s) => s.currentMembership?.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]">
      {/* Subtle radial glow behind the icon */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[480px] h-[480px] rounded-full bg-red-500/[0.03] blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6 max-w-md text-center px-6">
        {/* Shield icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-red-400/80" />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Access Restricted
          </h1>
          <p className="text-sm leading-relaxed text-zinc-500">
            You don&apos;t have permission to view this page. Contact your
            workspace admin if you believe this is an error.
          </p>
        </div>

        {/* Back to dashboard */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 hover:bg-emerald-500/[0.14] hover:border-emerald-500/30 transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Dashboard
        </Link>

        {/* Current role badge */}
        {role && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-zinc-600 font-medium">
              Your role
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
              {role}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
