"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, ArrowLeft, Trash2 } from "lucide-react";
import { useDashboardPath } from "@/lib/hooks/use-dashboard-path";

/**
 * Dashboard Settings Error Boundary (Project Aegis-Resolution)
 *
 * Catches crashes from ALL dashboard/settings sub-pages (integrations,
 * communications, compliance-engine, ndis-pricing, etc.) while preserving
 * the dashboard shell — sidebar, header, and command palette remain fully
 * operational. Only the settings content area is replaced with this
 * localized error state.
 *
 * Includes a "Clear Local Cache" panic button that wipes all Zustand
 * persisted storage and forces a clean login, covering the case where
 * corrupted localStorage is the root cause.
 */

const ZUSTAND_STORAGE_KEYS = [
  "iworkr-settings",
  "iworkr-auth",
  "iworkr-branding",
  "iworkr-billing",
  "iworkr-shell",
  "iworkr-dashboard",
  "iworkr-onboarding",
  "iworkr-integrations",
  "iworkr-jobs",
  "iworkr-clients",
  "iworkr-finance",
  "iworkr-schedule",
  "iworkr-inbox",
  "iworkr-team",
  "iworkr-assets",
  "iworkr-forms",
  "iworkr-automations",
  "iworkr-care-command",
  "iworkr-medications",
  "iworkr-intake-draft",
];

export default function DashboardSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dashboardPath = useDashboardPath();

  useEffect(() => {
    console.error("[Dashboard Settings Error Boundary]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.href : "",
    });

    // Sentry capture when available
    if (
      typeof window !== "undefined" &&
      (window as unknown as Record<string, unknown>).Sentry
    ) {
      const Sentry = (window as unknown as Record<string, unknown>)
        .Sentry as {
        captureException: (err: Error, ctx?: unknown) => void;
      };
      Sentry.captureException(error, {
        tags: { module: "dashboard-settings", digest: error.digest },
        extra: { url: window.location.href },
      });
    }
  }, [error]);

  function handleHardReset() {
    ZUSTAND_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    window.location.href = "/auth/login";
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm text-center"
      >
        {/* Animated icon with orbital rings */}
        <div className="relative mx-auto mb-6 h-20 w-20">
          <div className="absolute inset-0 animate-orbit-reverse rounded-full border border-rose-500/[0.06]" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/15 bg-rose-500/5">
              <AlertTriangle size={20} className="text-rose-400" />
            </div>
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 animate-signal-pulse rounded-2xl border border-rose-500/20" />
          </div>
        </div>

        <p className="mb-1 font-mono text-[10px] tracking-widest text-zinc-700 uppercase">
          Settings Error
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Settings module hit a snag
        </h2>
        <p className="mt-2 text-[13px] text-zinc-500">
          Your data is safe. This section failed to load. Try refreshing,
          or clear the local cache if the problem persists.
        </p>

        {/* Error digest for support */}
        {error.digest && (
          <p className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-[10px] text-zinc-600">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {/* Primary row */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="btn-micro inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200"
            >
              <RotateCcw size={13} />
              Retry
            </button>
            <a
              href={dashboardPath}
              className="btn-micro inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/[0.12] hover:text-white"
            >
              <ArrowLeft size={13} />
              Dashboard
            </a>
          </div>

          {/* Panic button — Clear Local Cache */}
          <button
            onClick={handleHardReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-zinc-600 transition-colors hover:bg-rose-500/5 hover:text-rose-400"
          >
            <Trash2 size={11} />
            Clear Local Cache &amp; Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
