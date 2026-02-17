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
