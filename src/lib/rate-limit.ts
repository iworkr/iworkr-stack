/**
 * iWorkr Rate Limiter
 *
 * In-memory sliding window rate limiter for API routes.
 * For production at scale, replace with Redis/Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if a request should be rate limited.
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 60, windowSeconds: 60 }
): RateLimitResult {
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
  const success = entry.count <= config.limit;

  return {
    success,
    limit: config.limit,
    remaining,
    reset: entry.resetAt,
  };
}

/**
 * Extract identifier from request for rate limiting.
 * Uses IP address + optional user agent hash.
 */
export function getIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return ip;
}

/**
 * Rate limit presets for different endpoint types.
 */
export const RateLimits = {
  /** Public API: 30 req/min */
  api: { limit: 30, windowSeconds: 60 },
  /** Auth endpoints: 10 req/min */
  auth: { limit: 10, windowSeconds: 60 },
  /** Webhook receivers: 100 req/min */
  webhook: { limit: 100, windowSeconds: 60 },
  /** Cron jobs: 5 req/min */
  cron: { limit: 5, windowSeconds: 60 },
  /** Heavy operations: 5 req/min */
  heavy: { limit: 5, windowSeconds: 60 },
} as const;
