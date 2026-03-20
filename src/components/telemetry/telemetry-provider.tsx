"use client";

/**
 * Project Panopticon + Argus — TelemetryProvider
 *
 * Dual telemetry pipeline:
 *   1. Crash capture engine (autopsy payloads with screenshots)
 *   2. Continuous telemetry agent (web vitals, console errors, network profiling)
 *
 * Both share the same ingest-telemetry Edge Function endpoint.
 */

import { useEffect } from "react";
import {
  initConsoleCapture,
  flushTelemetryQueue,
  setTelemetryIdentity,
  captureAndSend,
  trackAction,
} from "@/lib/telemetry";
import { initAgent, setAgentIdentity, destroyAgent } from "@/lib/telemetry/telemetry-agent";
import { useOrg } from "@/lib/hooks/use-org";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { orgId, userId } = useOrg();

  useEffect(() => {
    initConsoleCapture();
    flushTelemetryQueue();

    initAgent({ workspaceId: orgId ?? undefined, userId: userId ?? undefined });

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      error.name = error.name || "UnhandledPromiseRejection";
      captureAndSend(error, "warning");
    };

    const handleError = (event: ErrorEvent) => {
      if (event.error) {
        captureAndSend(event.error, "warning");
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);

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
      destroyAgent();
    };
  }, []);

  useEffect(() => {
    setAgentIdentity(orgId, userId);
  }, [orgId, userId]);

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
