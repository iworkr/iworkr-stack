/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Argus-Panopticon — TelemetryAgent
 *
 * Lightweight, asynchronous client-side telemetry agent.
 * Captures Web Vitals, console errors, network latency, and React crashes.
 *
 * All events are batched in RAM and flushed every 10 seconds or via
 * navigator.sendBeacon() on page unload to prevent data loss.
 */

export type EventCategory =
  | "WEB_VITALS"
  | "CONSOLE_ERROR"
  | "NETWORK_LATENCY"
  | "REACT_CRASH"
  | "UNHANDLED_ERROR";

export type Severity = "INFO" | "WARN" | "ERROR" | "FATAL";

export interface TelemetryEvent {
  event_category: EventCategory;
  severity: Severity;
  url_path: string;
  payload: Record<string, unknown>;
  timestamp?: string;
}

interface AgentConfig {
  endpoint: string;
  apiKey: string;
  flushIntervalMs: number;
  maxBatchSize: number;
}

let _config: AgentConfig | null = null;
let _outbox: TelemetryEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _workspaceId: string | null = null;
let _userId: string | null = null;
let _initialized = false;

function getPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function initAgent(opts?: {
  workspaceId?: string;
  userId?: string;
}) {
  if (typeof window === "undefined") return;
  if (_initialized) return;
  _initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  _config = {
    endpoint: `${supabaseUrl}/functions/v1/ingest-telemetry`,
    apiKey: anonKey,
    flushIntervalMs: 10_000,
    maxBatchSize: 200,
  };

  if (opts?.workspaceId) _workspaceId = opts.workspaceId;
  if (opts?.userId) _userId = opts.userId;

  _flushTimer = setInterval(flush, _config.flushIntervalMs);

  window.addEventListener("beforeunload", beaconFlush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beaconFlush();
  });

  interceptConsoleErrors();
  interceptSlowFetches();
  trackWebVitals();
}

export function setAgentIdentity(workspaceId: string | null, userId: string | null) {
  _workspaceId = workspaceId;
  _userId = userId;
}

export function pushEvent(event: TelemetryEvent) {
  if (!_initialized) return;
  _outbox.push({
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    url_path: event.url_path || getPath(),
  });

  if (_outbox.length >= (_config?.maxBatchSize ?? 200)) {
    flush();
  }
}

async function flush() {
  if (_outbox.length === 0 || !_config) return;

  const batch = _outbox.splice(0, _config.maxBatchSize);
  const payload = {
    batch: true,
    workspace_id: _workspaceId,
    user_id: _userId,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "",
    events: batch,
  };

  try {
    await fetch(_config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_config.apiKey}`,
        apikey: _config.apiKey,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    _outbox.unshift(...batch);
  }
}

function beaconFlush() {
  if (_outbox.length === 0 || !_config) return;

  const batch = _outbox.splice(0, _config.maxBatchSize);
  const payload = JSON.stringify({
    batch: true,
    workspace_id: _workspaceId,
    user_id: _userId,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "",
    events: batch,
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(_config.endpoint, blob);
  }
}

export function destroyAgent() {
  if (_flushTimer) clearInterval(_flushTimer);
  beaconFlush();
  _initialized = false;
}

/* ── Console Error Interceptor ─────────────────────────────────── */

function interceptConsoleErrors() {
  if (typeof window === "undefined") return;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    try {
      const msg = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)?.slice(0, 500) ?? String(a)))
        .join(" ")
        .slice(0, 2000);

      if (msg.includes("Hydration") || msg.includes("Warning:")) return;

      pushEvent({
        event_category: "CONSOLE_ERROR",
        severity: "ERROR",
        url_path: getPath(),
        payload: { message: msg, stack: new Error().stack?.slice(0, 2000) },
      });
    } catch { /* never break console */ }
  };

  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    try {
      const msg = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)?.slice(0, 500) ?? String(a)))
        .join(" ")
        .slice(0, 2000);

      if (msg.includes("Warning:") || msg.includes("DevTools")) return;

      pushEvent({
        event_category: "CONSOLE_ERROR",
        severity: "WARN",
        url_path: getPath(),
        payload: { message: msg },
      });
    } catch { /* never break console */ }
  };
}

/* ── Network Latency Interceptor ───────────────────────────────── */

function interceptSlowFetches() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;
  const SLOW_THRESHOLD_MS = 2000;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);

    if (url.includes("ingest-telemetry")) {
      return originalFetch.apply(this, args);
    }

    const start = performance.now();

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Math.round(performance.now() - start);

      if (duration > SLOW_THRESHOLD_MS || response.status >= 400) {
        pushEvent({
          event_category: "NETWORK_LATENCY",
          severity: response.status >= 500 ? "ERROR" : duration > SLOW_THRESHOLD_MS ? "WARN" : "INFO",
          url_path: getPath(),
          payload: {
            request_url: url.slice(0, 300),
            method: (args[1] as RequestInit)?.method || "GET",
            status: response.status,
            duration_ms: duration,
          },
        });
      }

      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      pushEvent({
        event_category: "NETWORK_LATENCY",
        severity: "ERROR",
        url_path: getPath(),
        payload: {
          request_url: url.slice(0, 300),
          method: (args[1] as RequestInit)?.method || "GET",
          status: 0,
          duration_ms: duration,
          error: (err as Error).message?.slice(0, 500),
        },
      });
      throw err;
    }
  };
}

/* ── Web Vitals Tracking ───────────────────────────────────────── */

function trackWebVitals() {
  if (typeof window === "undefined") return;

  try {
    import("web-vitals").then(({ onLCP, onCLS, onTTFB, onINP }) => {
      const report = (name: string, value: number, rating: string) => {
        if (rating === "good") return;

        pushEvent({
          event_category: "WEB_VITALS",
          severity: rating === "poor" ? "WARN" : "INFO",
          url_path: getPath(),
          payload: { metric: name, value: Math.round(value), rating },
        });
      };

      onLCP((m) => report("LCP", m.value, m.rating));
      onCLS((m) => report("CLS", m.value * 1000, m.rating));
      onTTFB((m) => report("TTFB", m.value, m.rating));
      onINP((m) => report("INP", m.value, m.rating));
    }).catch(() => {});
  } catch { /* web-vitals not available */ }
}
