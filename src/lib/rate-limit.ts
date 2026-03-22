/**
 * @module RateLimit
 * @status COMPLETE
 * @description Hybrid rate limiter: uses Upstash Redis when available (production),
 *   falls back to in-memory for local development. Provides centralized rate limit
 *   checking for API routes and auth endpoints.
 * @lastAudit 2026-03-22
 */

// ═══════════════════════════════════════════════════════════════════════════════
// UPSTASH REDIS RATE LIMITER (Production)
// ═══════════════════════════════════════════════════════════════════════════════
// In production (Vercel), each serverless instance gets fresh memory.
// An in-memory rate limiter is useless — Upstash Redis provides a shared store.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your Vercel env.
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

// ── Upstash Redis Integration ────────────────────────────────────────────
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

async function redisIncr(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
  const pipeline = [
    ["INCR", key],
    ["PTTL", key],
  ];

  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipeline),
  });

  const results = await res.json() as Array<{ result: number }>;
  const count = results[0].result;
  const ttl = results[1].result;

  // First request — set expiry
  if (count === 1 || ttl < 0) {
    await fetch(`${UPSTASH_URL}/PEXPIRE/${encodeURIComponent(key)}/${windowMs}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  }

  return { count, ttl: ttl > 0 ? ttl : windowMs };
}

// ── In-memory fallback (local dev only) ──────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

function inMemoryRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const key = `rl:${identifier}`;
  const windowMs = config.windowSeconds * 1000;

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, config.limit - entry.count);
  return {
    success: entry.count <= config.limit,
    limit: config.limit,
    remaining,
    reset: entry.resetAt,
  };
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Check if a request should be rate limited.
 * Uses Upstash Redis in production, in-memory Map locally.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 }
): Promise<RateLimitResult> {
  if (!USE_REDIS) {
    return inMemoryRateLimit(identifier, config);
  }

  const key = `rl:${identifier}`;
  const windowMs = config.windowSeconds * 1000;

  try {
    const { count, ttl } = await redisIncr(key, windowMs);
    const remaining = Math.max(0, config.limit - count);
    return {
      success: count <= config.limit,
      limit: config.limit,
      remaining,
      reset: Date.now() + ttl,
    };
  } catch (err) {
    // If Redis is down, fail open (allow the request) but log
    console.error("[rate-limit] Redis error, falling back to allow:", err);
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Date.now() + config.windowSeconds * 1000,
    };
  }
}

/**
 * Extract identifier from request for rate limiting.
 * Uses IP address from x-forwarded-for or x-real-ip headers.
 */
export function getIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
}

/**
 * Rate limit presets for different endpoint types.
 */
export const RateLimits = {
  /** Public API: 30 req/min */
  api: { limit: 30, windowSeconds: 60 },
  /** Auth endpoints: 10 req/15min (brute-force protection) */
  auth: { limit: 10, windowSeconds: 900 },
  /** Webhook receivers: 100 req/min */
  webhook: { limit: 100, windowSeconds: 60 },
  /** Cron jobs: 5 req/min */
  cron: { limit: 5, windowSeconds: 60 },
  /** Heavy operations: 5 req/min */
  heavy: { limit: 5, windowSeconds: 60 },
  /** Password reset: 3 req/15min per IP */
  passwordReset: { limit: 3, windowSeconds: 900 },
} as const;
