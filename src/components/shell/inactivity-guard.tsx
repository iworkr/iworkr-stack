/**
 * @component InactivityGuard
 * @status COMPLETE
 * @description Auto-locks session after inactivity timeout with countdown warning modal
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Aegis-Citadel: Inactivity Guard
 *
 * Tracks user activity (mouse, keyboard, touch, scroll).
 * After 15 minutes of inactivity, shows a warning modal with 60-second countdown.
 * If not dismissed, wipes local storage, deletes cookies, and redirects to /auth/login.
 *
 * Mount inside the authenticated dashboard layout.
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_COUNTDOWN_S = 60; // 60 seconds

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_COUNTDOWN_S);

  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Reset activity timer ────────────────────────────────────────────

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      setCountdown(WARNING_COUNTDOWN_S);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  }, [showWarning]);

  // ── Force logout ────────────────────────────────────────────────────

  const forceLogout = useCallback(async () => {
    try {
      // Clear all local storage
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();

        // Delete all cookies
        document.cookie.split(";").forEach((c) => {
          const name = c.split("=")[0].trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      }

      // Sign out from Supabase
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
    } catch {
      // Best effort
    }

    // Hard redirect — bypass Next.js router
    window.location.href = "/auth?reason=inactivity";
  }, []);

  // ── Check for inactivity ────────────────────────────────────────────

  useEffect(() => {
    // Check every 30 seconds if user has been inactive
    checkIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS && !showWarning) {
        setShowWarning(true);
        setCountdown(WARNING_COUNTDOWN_S);
      }
    }, 30_000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [showWarning]);

  // ── Countdown when warning is showing ───────────────────────────────

  useEffect(() => {
    if (!showWarning) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          forceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showWarning, forceLogout]);

  // ── Activity event listeners ────────────────────────────────────────

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];

    const handler = () => {
      lastActivityRef.current = Date.now();
    };

    events.forEach((event) => window.addEventListener(event, handler, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
    };
  }, []);

  return (
    <>
      {children}

      {/* Inactivity Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
            {/* Shield icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <svg
                className="h-8 w-8 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h2 className="mb-2 text-lg font-semibold text-white">
              Session Timeout Warning
            </h2>

            <p className="mb-1 text-sm text-zinc-400">
              You&apos;ve been inactive for 15 minutes.
            </p>
            <p className="mb-6 text-sm text-zinc-400">
              Your session will be terminated in{" "}
              <span className="font-mono text-amber-500">{countdown}s</span>{" "}
              for security.
            </p>

            <div className="flex gap-3">
              <button
                onClick={forceLogout}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Log Out Now
              </button>
              <button
                onClick={resetActivity}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                I&apos;m Still Here
              </button>
            </div>

            {/* Countdown progress bar */}
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-1000 ease-linear"
                style={{
                  width: `${(countdown / WARNING_COUNTDOWN_S) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
