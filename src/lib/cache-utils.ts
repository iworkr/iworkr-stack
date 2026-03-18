/**
 * Shared caching utilities for Zustand stores.
 * Used by all data stores to implement stale-while-revalidate (SWR).
 */

/** Data older than this is considered stale and will be refetched in the background.
 *  5 minutes is aggressive enough to stay current but avoids
 *  hammering the server on every navigation / refresh.            */
export const STALE_MS = 5 * 60 * 1000; // 5 minutes

/** Returns true if the last fetch is recent enough to skip a refetch */
export function isFresh(lastFetchedAt: number | null): boolean {
  if (!lastFetchedAt) return false;
  return Date.now() - lastFetchedAt < STALE_MS;
}

/** Clear all iworkr-* keys from localStorage (call on sign-out) */
export function clearAllCaches(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith("iworkr-")) {
      localStorage.removeItem(key);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 * REQUEST DEDUPLICATION
 *
 * Multiple components may call the same server action simultaneously
 * (e.g. two tabs rendering at once, DataProvider + page component).
 * This ensures only ONE network request is made per unique key —
 * subsequent callers piggyback on the in-flight promise.
 * ═══════════════════════════════════════════════════════════════ */

const _inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate concurrent calls to the same async function.
 *
 * @example
 * const data = await dedupeRequest(`jobs:${orgId}`, () => getJobs(orgId));
 */
export async function dedupeRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = _inflightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    _inflightRequests.delete(key);
  });
  _inflightRequests.set(key, promise);
  return promise;
}

/* ═══════════════════════════════════════════════════════════════
 * IN-MEMORY CACHE (for page-level data that doesn't need Zustand)
 *
 * Perfect for pages like Timesheets, Care Hub, etc. that call
 * server actions directly without a store.
 * ═══════════════════════════════════════════════════════════════ */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const _memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Get-or-fetch with in-memory SWR cache.
 *
 * @example
 * const rows = await cachedFetch(`timesheets:${orgId}:${tab}`, () => fetchTimesheetTriageAction(orgId, { tab }), 3 * 60 * 1000);
 */
export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = STALE_MS
): Promise<{ data: T; fromCache: boolean }> {
  const entry = _memoryCache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    return { data: entry.data, fromCache: true };
  }

  const data = await dedupeRequest(key, fn);
  _memoryCache.set(key, { data, fetchedAt: Date.now() });
  return { data, fromCache: false };
}

/** Invalidate a specific cache key (call after mutations) */
export function invalidateCache(key: string): void {
  _memoryCache.delete(key);
}

/** Invalidate all cache keys matching a prefix */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of _memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      _memoryCache.delete(key);
    }
  }
}
