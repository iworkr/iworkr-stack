"use client";

/**
 * Project Panopticon — TelemetryProvider
 *
 * Client component that:
 *   1. Initializes the console ring buffer capture
 *   2. Flushes any queued offline telemetry payloads
 *   3. Listens for global unhandled rejections (Promise rejections)
 *   4. Tracks window.onerror for non-React errors
 *   5. Wires up user identity from auth store
 *
 * Mount this inside the dashboard layout, wrapping {children}.
 */

import { useEffect, useCallback } from "react";
import {
  initConsoleCapture,
  flushTelemetryQueue,
  setTelemetryIdentity,
  captureAndSend,
  trackAction,
} from "@/lib/telemetry";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  // Initialize on mount (client only)
  useEffect(() => {
    // 1. Start console capture
    initConsoleCapture();

    // 2. Flush any offline-queued payloads
    flushTelemetryQueue();

    // 3. Global unhandled Promise rejection handler
    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      error.name = error.name || "UnhandledPromiseRejection";
      captureAndSend(error, "warning");
    };

    // 4. Global window.onerror for non-React errors
    const handleError = (event: ErrorEvent) => {
      if (event.error) {
        captureAndSend(event.error, "warning");
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);

    // 5. Track click actions for "last_action" in payloads
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      const tag = target.tagName;
      const text = target.textContent?.slice(0, 60) || "";
      const role = target.getAttribute("role") || "";
      const id = target.id ? `#${target.id}` : "";
      const className = target.className ? `.${String(target.className).split(" ")[0]}` : "";

      trackAction(`CLICK: ${tag}${id}${className}${role ? ` [${role}]` : ""} "${text}"`);
    };

    document.addEventListener("click", handleClick, { passive: true, capture: true });

    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return <>{children}</>;
}

/**
 * Hook to set telemetry identity from the auth store.
 * Call inside your auth-aware layout or provider.
 */
export function useTelemetryIdentity(identity: {
  userId?: string;
  email?: string;
  organizationId?: string;
  branchId?: string;
  industryMode?: string;
  role?: string;
}) {
  useEffect(() => {
    setTelemetryIdentity({
      user_id: identity.userId,
      email: identity.email,
      organization_id: identity.organizationId,
      branch_id: identity.branchId,
      industry_mode: identity.industryMode,
      role: identity.role,
    });
  }, [identity.userId, identity.email, identity.organizationId, identity.branchId, identity.industryMode, identity.role]);
}
