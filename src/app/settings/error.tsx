"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";

/**
 * Settings Module Error Boundary
 *
 * When a settings tab crashes (e.g., React Error #310), this boundary
 * catches the exception and renders a localized error state INSIDE the
 * settings layout. The sidebar, command bar, and dashboard remain
 * fully operational — only the content area is replaced.
 *
 * Recovery: The "Reload Interface" button calls reset() which
 * re-renders the route segment, attempting a clean remount.
 */
export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log error to telemetry (Sentry/Datadog) when available
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Settings Error Boundary]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.href : "",
    });

    // If Sentry is available, capture with context
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).Sentry) {
      const Sentry = (window as unknown as Record<string, unknown>).Sentry as {
        captureException: (err: Error, ctx?: unknown) => void;
      };
      Sentry.captureException(error, {
        tags: { module: "settings", digest: error.digest },
        extra: { url: window.location.href },
      });
    }
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-w-md flex-col items-center text-center"
      >
        {/* Icon with pulse ring */}
        <div className="relative mb-6">
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl bg-red-500/10"
            style={{ margin: "-12px" }}
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/[0.06] ring-1 ring-red-500/15">
            <AlertTriangle size={28} strokeWidth={1.5} className="text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-medium tracking-tight text-zinc-100">
          Module Unavailable
        </h2>

        {/* Description */}
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-500">
          The settings interface encountered an unexpected error. Our engineering team has been notified.
        </p>

        {/* Error digest (for support) */}
        {error.digest && (
          <p className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 font-mono text-[10px] text-zinc-600">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-[#00E676] px-5 py-2.5 text-[13px] font-medium text-black shadow-[0_0_20px_-6px_rgba(0,230,118,0.3)] transition-all hover:bg-[#00C853] hover:shadow-[0_0_30px_-6px_rgba(0,230,118,0.4)]"
          >
            <RefreshCw size={14} strokeWidth={2} />
            Reload Interface
          </button>

          <a
            href="mailto:support@iworkr.app"
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:border-white/[0.15] hover:text-zinc-200"
          >
            <LifeBuoy size={14} strokeWidth={1.5} />
            Contact Support
          </a>
        </div>
      </motion.div>
    </div>
  );
}
