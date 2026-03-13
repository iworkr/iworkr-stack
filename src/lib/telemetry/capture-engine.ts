/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Panopticon — Client-Side Capture Engine (The "Black Box")
 *
 * Captures forensic telemetry payloads when errors occur:
 *   - DOM screenshot via html2canvas (with PII masking)
 *   - Console ring buffer (last 50 logs)
 *   - Route, state, environment details
 *   - Network conditions & device info
 *
 * Two modes:
 *   1. FATAL — Unhandled exception breaks the UI. Auto-captures + fallback screen.
 *   2. SILENT — API failure or manual "Report Bug". Background capture, no interruption.
 */

/* ── Types ──────────────────────────────────────────────────────── */

export type TelemetrySeverity = "info" | "warning" | "fatal";

export interface TelemetryIdentity {
  user_id?: string;
  email?: string;
  organization_id?: string;
  branch_id?: string;
  industry_mode?: string;
  role?: string;
}

export interface TelemetryPayload {
  event_id: string;
  timestamp_utc: string;
  timestamp_local: string;
  severity: TelemetrySeverity;
  identity: TelemetryIdentity;
  environment: {
    platform: string;
    os_version: string;
    app_version: string;
    device_model: string;
    user_agent: string;
    viewport: { width: number; height: number };
    language: string;
  };
  telemetry: {
    network_type: string;
    effective_bandwidth: string;
    is_offline_mode: boolean;
    memory_usage_mb: number | null;
    battery_level: number | null;
  };
  context: {
    current_route: string;
    last_action: string;
    console_buffer: ConsoleEntry[];
    active_state?: Record<string, any>;
    local_storage_snapshot?: Record<string, string>;
  };
  error_details: {
    name: string;
    message: string;
    stack_trace: string;
    component_stack?: string;
    digest?: string;
  };
  visual_evidence?: {
    screenshot_base64?: string;
  };
}

export interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info" | "debug";
  message: string;
  timestamp: string;
}

/* ── Console Ring Buffer ────────────────────────────────────────── */

const RING_BUFFER_SIZE = 50;
const consoleBuffer: ConsoleEntry[] = [];
let isConsoleHijacked = false;

/**
 * Proxies console.log/warn/error/info into an in-memory ring buffer.
 * Call once at app startup. Idempotent.
 */
export function initConsoleCapture() {
  if (typeof window === "undefined" || isConsoleHijacked) return;
  isConsoleHijacked = true;

  const levels = ["log", "warn", "error", "info", "debug"] as const;

  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = (...args: any[]) => {
      original(...args);
      try {
        const message = args
          .map((a) => {
            if (typeof a === "string") return a;
            try { return JSON.stringify(a).slice(0, 500); }
            catch { return String(a); }
          })
          .join(" ")
          .slice(0, 1000);

        consoleBuffer.push({
          level,
          message,
          timestamp: new Date().toISOString(),
        });

        // Ring buffer: drop oldest entries
        while (consoleBuffer.length > RING_BUFFER_SIZE) {
          consoleBuffer.shift();
        }
      } catch {
        // Never break console itself
      }
    };
  }
}

/** Get the current console buffer (cloned) */
export function getConsoleBuffer(): ConsoleEntry[] {
  return [...consoleBuffer];
}

/* ── Action Tracker ─────────────────────────────────────────────── */

let lastUserAction = "";

/**
 * Records the last user action for inclusion in crash reports.
 * Called from click handlers, navigation events, etc.
 */
export function trackAction(action: string) {
  lastUserAction = `${new Date().toISOString()} | ${action}`;
}

/* ── PII Masking ────────────────────────────────────────────────── */

/**
 * Masks elements with .pii-sensitive or [data-pii] before screenshot.
 * Returns a cleanup function that restores original content.
 */
function maskPII(): () => void {
  if (typeof document === "undefined") return () => {};

  const elements = document.querySelectorAll(".pii-sensitive, [data-pii]");
  const originals: { el: HTMLElement; html: string; style: string }[] = [];

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    originals.push({
      el: htmlEl,
      html: htmlEl.innerHTML,
      style: htmlEl.style.cssText,
    });
    htmlEl.innerHTML = "[REDACTED]";
    htmlEl.style.filter = "blur(6px)";
    htmlEl.style.userSelect = "none";
  });

  return () => {
    originals.forEach(({ el, html, style }) => {
      el.innerHTML = html;
      el.style.cssText = style;
    });
  };
}

/* ── Screenshot Capture ─────────────────────────────────────────── */

/**
 * Captures a screenshot of the current viewport via html2canvas.
 * PII elements are redacted before capture and restored after.
 * Returns base64 PNG string, or null if capture fails.
 */
async function captureScreenshot(): Promise<string | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    // Dynamically import html2canvas only when needed
    const { default: html2canvas } = await import("html2canvas");

    // Mask PII before capture
    const restorePII = maskPII();

    const canvas = await html2canvas(document.body, {
      backgroundColor: "#050505",
      scale: 0.5, // Half resolution to reduce payload size
      logging: false,
      useCORS: true,
      allowTaint: false,
      width: Math.min(window.innerWidth, 1920),
      height: Math.min(window.innerHeight, 1080),
      windowWidth: Math.min(window.innerWidth, 1920),
      windowHeight: Math.min(window.innerHeight, 1080),
    });

    // Restore PII
    restorePII();

    // Convert to base64 PNG (with compression)
    return canvas.toDataURL("image/png", 0.6).split(",")[1] || null;
  } catch (e) {
    console.error("[Panopticon] Screenshot capture failed:", e);
    return null;
  }
}

/* ── Environment Collection ─────────────────────────────────────── */

function getEnvironment() {
  if (typeof window === "undefined") {
    return {
      platform: "web",
      os_version: "unknown",
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      device_model: "server",
      user_agent: "",
      viewport: { width: 0, height: 0 },
      language: "en",
    };
  }

  const ua = navigator.userAgent;
  let os = "unknown";
  if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

  return {
    platform: "web",
    os_version: os,
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
    device_model: /Mobile/.test(ua) ? "Mobile Browser" : "Desktop Browser",
    user_agent: ua.slice(0, 300),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    language: navigator.language || "en",
  };
}

function getTelemetry() {
  if (typeof navigator === "undefined") {
    return {
      network_type: "unknown",
      effective_bandwidth: "unknown",
      is_offline_mode: false,
      memory_usage_mb: null,
      battery_level: null,
    };
  }

  const conn = (navigator as any).connection;
  const memory = (performance as any).memory;

  return {
    network_type: conn?.type || (navigator.onLine ? "online" : "offline"),
    effective_bandwidth: conn?.effectiveType || "unknown",
    is_offline_mode: !navigator.onLine,
    memory_usage_mb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    battery_level: null, // Battery API requires async, not worth blocking
  };
}

function getLocalStorageSnapshot(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const snapshot: Record<string, string> = {};
  const SKIP_KEYS = ["sb-", "supabase", "token", "auth", "session", "cookie"];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (SKIP_KEYS.some((skip) => key.toLowerCase().includes(skip))) continue;
      const val = localStorage.getItem(key);
      if (val && val.length < 500) {
        snapshot[key] = val;
      }
    }
  } catch {
    // Safari private mode etc.
  }

  return snapshot;
}

/* ── Generate Event ID ──────────────────────────────────────────── */

function generateEventId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `err_${rand}`;
}

/* ── Identity Store ─────────────────────────────────────────────── */

let _identity: TelemetryIdentity = {};

/**
 * Set the current user identity for telemetry payloads.
 * Call this after auth completes.
 */
export function setTelemetryIdentity(identity: TelemetryIdentity) {
  _identity = { ..._identity, ...identity };
}

/* ── Main Capture Functions ─────────────────────────────────────── */

/**
 * Build a full autopsy payload for a fatal or silent error.
 * Captures screenshot (if fatal), console buffer, environment, etc.
 */
export async function buildAutopsyPayload(
  error: Error & { digest?: string; componentStack?: string },
  severity: TelemetrySeverity = "fatal",
  options?: { includeScreenshot?: boolean; route?: string }
): Promise<TelemetryPayload> {
  const now = new Date();
  const includeScreenshot = options?.includeScreenshot ?? (severity === "fatal");

  // Capture screenshot (with PII masking)
  let screenshotBase64: string | null = null;
  if (includeScreenshot) {
    screenshotBase64 = await captureScreenshot();
  }

  const payload: TelemetryPayload = {
    event_id: generateEventId(),
    timestamp_utc: now.toISOString(),
    timestamp_local: now.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }),
    severity,
    identity: _identity,
    environment: getEnvironment(),
    telemetry: getTelemetry(),
    context: {
      current_route: options?.route || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
      last_action: lastUserAction,
      console_buffer: getConsoleBuffer(),
      local_storage_snapshot: getLocalStorageSnapshot(),
    },
    error_details: {
      name: error.name || "UnknownError",
      message: error.message || "No message",
      stack_trace: (error.stack || "").slice(0, 5000),
      component_stack: error.componentStack?.slice(0, 3000),
      digest: error.digest,
    },
  };

  if (screenshotBase64) {
    payload.visual_evidence = { screenshot_base64: screenshotBase64 };
  }

  return payload;
}

/**
 * Send an autopsy payload to the ingest-telemetry Edge Function.
 * Falls back to local storage queue if offline.
 */
export async function sendTelemetryPayload(payload: TelemetryPayload): Promise<boolean> {
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-telemetry`;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey || "",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return true;
    }

    // If failed, queue locally
    queueLocally(payload);
    return false;
  } catch {
    // Network failure — queue locally
    queueLocally(payload);
    return false;
  }
}

/* ── Offline Queue ──────────────────────────────────────────────── */

const QUEUE_KEY = "panopticon_telemetry_queue";
const MAX_QUEUE = 20;

function queueLocally(payload: TelemetryPayload) {
  if (typeof localStorage === "undefined") return;
  try {
    // Remove screenshot to save space in localStorage
    const lean = { ...payload, visual_evidence: undefined };
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    queue.push(lean);
    while (queue.length > MAX_QUEUE) queue.shift();
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or disabled
  }
}

/**
 * Flush any queued telemetry payloads (call on app startup).
 */
export async function flushTelemetryQueue() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue: TelemetryPayload[] = JSON.parse(raw);
    if (!queue.length) return;

    localStorage.removeItem(QUEUE_KEY);

    // Send them all in parallel (fire and forget)
    await Promise.allSettled(queue.map((p) => sendTelemetryPayload(p)));
  } catch {
    // Best effort
  }
}

/* ── Convenience: Capture & Send ────────────────────────────────── */

/**
 * One-shot: build autopsy + send to backend.
 * Use for silent/manual error reports.
 */
export async function captureAndSend(
  error: Error,
  severity: TelemetrySeverity = "warning",
  options?: { includeScreenshot?: boolean; route?: string }
): Promise<void> {
  try {
    const payload = await buildAutopsyPayload(error, severity, options);
    await sendTelemetryPayload(payload);
  } catch {
    // Never let telemetry break the app
  }
}

/**
 * Manual bug report trigger (user-initiated).
 */
export async function reportBug(description?: string): Promise<void> {
  const error = new Error(description || "User-initiated bug report");
  error.name = "ManualBugReport";
  await captureAndSend(error, "info", { includeScreenshot: true });
}
