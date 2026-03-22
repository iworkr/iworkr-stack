/**
 * @page /signup
 * @status COMPLETE
 * @description Signup redirect stub that forwards to /auth?mode=signup
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth?mode=signup");
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)]">
      {/* Noise — standardized */}
      <div className="stealth-noise fixed" />

      {/* Atmospheric glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-[var(--brand)] opacity-[0.02] blur-[160px]" />
      </div>

      <div className="relative z-10 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
    </div>
  );
}
