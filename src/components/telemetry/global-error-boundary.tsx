"use client";

/**
 * Project Panopticon — GlobalErrorBoundary
 *
 * Wraps the React tree to catch unhandled errors.
 * On fatal crash:
 *   1. Captures a PII-masked screenshot
 *   2. Dumps the console ring buffer
 *   3. Collects environment/network telemetry
 *   4. Fires the autopsy payload to the backend
 *   5. Renders a graceful fallback UI
 */

import React from "react";
import {
  buildAutopsyPayload,
  sendTelemetryPayload,
} from "@/lib/telemetry/capture-engine";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      // Augment the error with component stack
      const augmented = error as Error & { componentStack?: string; digest?: string };
      augmented.componentStack = errorInfo.componentStack || undefined;

      // Build and send the autopsy payload
      const payload = await buildAutopsyPayload(augmented, "fatal", {
        includeScreenshot: true,
      });

      this.setState({ eventId: payload.event_id });

      // Fire and forget — never block the fallback render
      sendTelemetryPayload(payload).catch(() => {});
    } catch {
      // Telemetry must never worsen a crash
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/15 bg-rose-500/5">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-rose-400"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <p className="mb-1 font-mono text-[9px] font-bold tracking-widest text-zinc-700 uppercase">
              PANOPTICON CAPTURED
            </p>
            <h3 className="text-[15px] font-semibold text-zinc-100">
              An error was captured
            </h3>
            <p className="mt-1.5 text-[12px] text-zinc-500">
              A forensic snapshot has been automatically sent to the engineering
              team. This includes a redacted screenshot and full system state.
            </p>
            {this.state.eventId && (
              <p className="mt-2 font-mono text-[9px] text-zinc-600">
                Event: {this.state.eventId}
              </p>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, eventId: null });
              }}
              className="mt-4 rounded-lg bg-white/[0.06] px-4 py-2 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
            >
              Dismiss & Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
