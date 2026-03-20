/**
 * ingest-telemetry — Project Panopticon
 *
 * Edge Function: Receives autopsy payloads from client-side capture engines
 * (Next.js GlobalErrorBoundary + Flutter RepaintBoundary).
 *
 * Features:
 *   - Rate limiting (max 10 events/min per device)
 *   - Screenshot upload to telemetry_snapshots storage bucket
 *   - Structured insert into partitioned telemetry_events table
 *   - Crash-loop detection (drops payloads if flooding)
 *
 * POST body: The full Autopsy Report JSON (see PRD §4)
 * Optional: Base64 screenshot in payload.visual_evidence.screenshot_base64
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as base64Decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-active-workspace-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

const corsHeaders = getCorsHeaders();

/* ── Rate Limiter (in-memory, per-instance) ───────────────────── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;       // Max events per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

// Clean stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 30000);

/* ── Main Handler ─────────────────────────────────────────────── */

serve(async (req: Request) => {
  const reqCors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: reqCors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // ── Batch mode: Argus-Panopticon continuous telemetry ───────
    if (body.batch === true && Array.isArray(body.events)) {
      const rows = body.events.map((evt: Record<string, unknown>) => ({
        workspace_id: body.workspace_id || null,
        user_id: body.user_id || null,
        event_category: evt.event_category || "UNKNOWN",
        severity: evt.severity || "INFO",
        url_path: evt.url_path || null,
        user_agent: (body.user_agent || "").slice(0, 300),
        payload: scrubPII(evt.payload as Record<string, unknown> || {}),
        created_at: evt.timestamp || new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error: batchErr } = await supabase
          .from("system_telemetry")
          .insert(rows);

        if (batchErr) {
          console.error("Batch telemetry insert failed:", batchErr.message);
          return new Response(
            JSON.stringify({ error: "Batch insert failed", detail: batchErr.message }),
            { status: 500, headers: { ...reqCors, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, ingested: rows.length }),
        { headers: { ...reqCors, "Content-Type": "application/json" } }
      );
    }

    // ── Extract identity for rate limiting ───────────────────
    const userId = body.identity?.user_id || "anonymous";
    const deviceKey = `${userId}_${body.environment?.device_model || "web"}`;

    if (!checkRateLimit(deviceKey)) {
      return new Response(
        JSON.stringify({
          error: "Rate limited: crash loop detected",
          message: "Too many telemetry events from this device. Payloads dropped to protect the database.",
        }),
        { status: 429, headers: { ...reqCors, "Content-Type": "application/json" } }
      );
    }

    // ── Handle screenshot upload ─────────────────────────────
    let screenshotPath: string | null = null;
    const screenshotBase64 = body.visual_evidence?.screenshot_base64;

    if (screenshotBase64) {
      try {
        const eventId = body.event_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const orgId = body.identity?.organization_id || "unknown";
        const fileName = `${orgId}/${eventId}_snapshot.png`;
        const imageBytes = base64Decode(screenshotBase64);

        const { error: uploadError } = await supabase.storage
          .from("telemetry_snapshots")
          .upload(fileName, imageBytes, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          screenshotPath = `telemetry_snapshots/${fileName}`;
        } else {
          console.error("Screenshot upload failed:", uploadError.message);
        }
      } catch (screenshotErr) {
        console.error("Screenshot processing error:", screenshotErr);
      }
    }

    // ── Build telemetry record ───────────────────────────────
    const fallbackTimestamp = typeof body.timestamp_utc === "string"
      ? body.timestamp_utc
      : new Date().toISOString();
    const normalizedConsoleBuffer = normalizeConsoleBufferInput(
      body.context?.console_buffer,
      fallbackTimestamp,
    );

    const record = {
      severity: body.error_details?.name?.includes("Fatal") ? "fatal" :
        body.severity || (body.error_details ? "warning" : "info"),
      status: "unresolved",

      // Identity
      organization_id: body.identity?.organization_id || null,
      user_id: body.identity?.user_id || null,
      user_email: body.identity?.email || null,
      branch_id: body.identity?.branch_id || null,
      industry_mode: body.identity?.industry_mode || null,
      user_role: body.identity?.role || null,

      // Environment
      platform: normalizePlatform(body.environment?.platform),
      os_version: body.environment?.os_version || null,
      app_version: body.environment?.app_version || null,
      device_model: body.environment?.device_model || null,

      // Telemetry
      network_type: body.telemetry?.network_type || null,
      effective_bandwidth: body.telemetry?.effective_bandwidth || null,
      is_offline_mode: body.telemetry?.is_offline_mode || false,
      gps_lat: body.telemetry?.gps_location?.lat || null,
      gps_lng: body.telemetry?.gps_location?.lng || null,
      memory_usage_mb: body.telemetry?.memory_usage_mb || null,
      battery_level: body.telemetry?.battery_level || null,

      // Context
      route: body.context?.current_route || null,
      last_action: body.context?.last_action || null,
      error_name: body.error_details?.name || null,
      error_message: body.error_details?.message || null,
      stack_trace: body.error_details?.stack_trace || null,

      // Full payload (strip screenshot base64 to save DB space)
      payload: sanitizePayload(body),

      // Visual evidence
      has_screenshot: !!screenshotPath,
      screenshot_path: screenshotPath,

      // Console buffer
      console_buffer: normalizedConsoleBuffer,
    };

    const sanitizedPayload = sanitizePayload(body);

    const mobileRecord = {
      organization_id: body.identity?.organization_id || null,
      worker_id: body.identity?.user_id || null,
      error_type: body.error_details?.name || "UnknownError",
      error_message: body.error_details?.message || "No message",
      stack_trace: body.error_details?.stack_trace || null,
      breadcrumbs:
        body.context?.breadcrumbs ||
        normalizedConsoleBuffer.map((entry) => entry.message),
      device_metrics: {
        platform: normalizePlatform(body.environment?.platform),
        os_version: body.environment?.os_version || null,
        app_version: body.environment?.app_version || null,
        device_model: body.environment?.device_model || null,
        network_type: body.telemetry?.network_type || null,
        effective_bandwidth: body.telemetry?.effective_bandwidth || null,
        battery_level: body.telemetry?.battery_level || null,
        memory_usage_mb: body.telemetry?.memory_usage_mb || null,
        gps_lat: body.telemetry?.gps_location?.lat || null,
        gps_lng: body.telemetry?.gps_location?.lng || null,
      },
      screenshot_url: screenshotPath,
      status: "unresolved",
      app_version: body.environment?.app_version || "unknown",
      payload: sanitizedPayload,
    };

    try {
      await supabase.from("mobile_telemetry_events").insert(mobileRecord);
    } catch (mobileInsertError) {
      console.warn("mobile_telemetry_events insert skipped:", mobileInsertError);
    }

    const { data, error } = await supabase
      .from("telemetry_events")
      .insert({
        ...record,
        payload: sanitizedPayload,
      })
      .select("id, event_timestamp")
      .single();

    if (error) {
      console.error("Telemetry insert failed:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to store telemetry event", detail: error.message }),
        { status: 500, headers: { ...reqCors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: data.id,
        timestamp: data.event_timestamp,
        screenshot_stored: !!screenshotPath,
      }),
      { headers: { ...reqCors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Telemetry ingestion error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...reqCors, "Content-Type": "application/json" } }
    );
  }
});

/* ── Helpers ───────────────────────────────────────────────────── */

function normalizePlatform(raw?: string): string {
  if (!raw) return "web";
  const lower = raw.toLowerCase();
  if (lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad")) return "mobile_ios";
  if (lower.includes("android")) return "mobile_android";
  if (lower.includes("electron") || lower.includes("desktop")) return "desktop";
  if (lower.includes("edge") || lower.includes("function") || lower.includes("deno")) return "edge_function";
  return "web";
}

/* ── PII Scrubbing Matrix ─────────────────────────────────────── */

const PII_PATTERNS: [RegExp, string][] = [
  // Credit card numbers (13-16 digits with optional spaces/dashes)
  [/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CC]"],
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]"],
  // Bearer tokens
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]"],
  // JWT-like tokens (3 base64 segments separated by dots)
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]"],
  // Australian phone numbers
  [/\b(?:\+?61|0)[2-478](?:[ -]?\d){8}\b/g, "[REDACTED_PHONE]"],
  // NDIS numbers (9 digits)
  [/\b4\d{8}\b/g, "[REDACTED_NDIS]"],
];

function scrubPII(obj: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(obj);
  let scrubbed = json;
  for (const [pattern, replacement] of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  try { return JSON.parse(scrubbed); }
  catch { return obj; }
}

function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...body };
  if (cleaned.visual_evidence && typeof cleaned.visual_evidence === "object") {
    const ve = { ...(cleaned.visual_evidence as Record<string, unknown>) };
    delete ve.screenshot_base64;
    cleaned.visual_evidence = ve;
  }
  if (cleaned.context && typeof cleaned.context === "object") {
    const ctx = { ...(cleaned.context as Record<string, unknown>) };
    delete (ctx as Record<string, unknown>).auth_token;
    delete (ctx as Record<string, unknown>).session_token;
    cleaned.context = ctx;
  }
  return scrubPII(cleaned);
}

function normalizeConsoleBufferInput(
  input: unknown,
  fallbackTimestamp: string,
): Array<{ level: string; message: string; timestamp: string }> {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          level: "log",
          message: entry,
          timestamp: fallbackTimestamp,
        };
      }

      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        return {
          level:
            typeof obj.level === "string" && obj.level.trim().length > 0
              ? obj.level
              : "log",
          message:
            typeof obj.message === "string"
              ? obj.message
              : JSON.stringify(obj),
          timestamp:
            typeof obj.timestamp === "string" && obj.timestamp.length > 0
              ? obj.timestamp
              : fallbackTimestamp,
        };
      }

      return {
        level: "log",
        message: String(entry),
        timestamp: fallbackTimestamp,
      };
    })
    .slice(0, 200);
}
