/**
 * @module SessionGeometry
 * @status COMPLETE
 * @description Aegis-Citadel velocity anomaly detection — impossible travel detection via geolocation headers
 * @lastAudit 2026-03-22
 */

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────

interface SessionGeometryCheck {
  anomaly: boolean;
  reason: string;
  minutes_elapsed?: number;
}

// ── IP & Location Extraction ──────────────────────────────────────────────

/** Extract real client IP from request headers */
export function extractClientIP(request: NextRequest): string | null {
  // Vercel provides the real IP
  const vercelIp = request.headers.get("x-real-ip");
  if (vercelIp) return vercelIp;

  // Fallback to x-forwarded-for (first IP in chain)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return null;
}

/** Extract country code from Vercel geolocation headers */
export function extractCountryCode(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-country") ?? null;
}

/** Extract city from Vercel geolocation headers */
export function extractCity(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-city") ?? null;
}

/** Generate a hash of the User-Agent for fingerprinting */
export function hashUserAgent(request: NextRequest): string {
  const ua = request.headers.get("user-agent") ?? "unknown";
  return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16);
}

// ── Velocity Anomaly Check ────────────────────────────────────────────────

/**
 * Check for velocity anomalies (impossible travel).
 * Uses the Supabase RPC `check_velocity_anomaly` which is more reliable
 * than in-memory checks since it persists across serverless invocations.
 *
 * Returns { anomaly: boolean, reason: string }
 */
export async function checkVelocityAnomaly(
  userId: string,
  request: NextRequest
): Promise<SessionGeometryCheck> {
  const ip = extractClientIP(request);
  const country = extractCountryCode(request);
  const uaHash = hashUserAgent(request);

  // If we can't determine location, skip the check
  if (!ip || !country) {
    return { anomaly: false, reason: "no_location_data" };
  }

  // Skip check for localhost/development
  if (ip === "127.0.0.1" || ip === "::1" || country === "XX") {
    return { anomaly: false, reason: "localhost" };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return { anomaly: false, reason: "missing_config" };
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc("check_velocity_anomaly", {
      p_user_id: userId,
      p_current_country: country,
      p_current_ip: ip,
      p_user_agent_hash: uaHash,
    });

    if (error) {
      console.error("[Citadel] Velocity check RPC error:", error.message);
      return { anomaly: false, reason: "rpc_error" };
    }

    return data as SessionGeometryCheck;
  } catch (err) {
    console.error("[Citadel] Velocity check failed:", err);
    return { anomaly: false, reason: "check_failed" };
  }
}

/**
 * Revoke a user's session via the admin API.
 * Called when a velocity anomaly is detected.
 */
export async function revokeUserSession(userId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) return false;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.auth.admin.signOut(userId, "global");

    if (error) {
      console.error("[Citadel] Session revocation failed:", error.message);
      return false;
    }

    console.warn(`[Citadel] Session revoked for user ${userId} due to velocity anomaly`);
    return true;
  } catch (err) {
    console.error("[Citadel] Session revocation error:", err);
    return false;
  }
}
