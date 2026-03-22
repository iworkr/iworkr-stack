/**
 * @hook useData
 * @status COMPLETE
 * @description Generic data-fetching hook with SWR caching and mutation helpers
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cachedFetch, invalidateCache } from "@/lib/cache-utils";

/**
 * Generic hook for fetching data from server actions.
 * Handles loading, error, refetch, and optional in-memory SWR caching.
 *
 * @param cacheKey — Optional cache key. When provided, results are cached
 *                   in memory and subsequent mounts with the same key
 *                   return cached data instantly (stale-while-revalidate).
 *                   When omitted, behaves like before (fresh fetch on every mount).
 */
export function useData<T>(
  fetcher: () => Promise<{ data: T | null; error: string | null }>,
  deps: unknown[] = [],
  options?: { cacheKey?: string; ttlMs?: number }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (options?.cacheKey) {
        // Use in-memory SWR cache — returns cached data instantly if available
        const { data: cached } = await cachedFetch(
          options.cacheKey,
          async () => {
            const result = await fetcher();
            if (result.error) throw new Error(result.error);
            return result.data;
          },
          options.ttlMs
        );
        if (!mountedRef.current) return;
        setData(cached);
      } else {
        // No caching — direct fetch
        const result = await fetcher();
        if (!mountedRef.current) return;
        if (result.error) {
          setError(result.error);
          setData(null);
        } else {
          setData(result.data);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  const refetch = useCallback(async () => {
    if (options?.cacheKey) invalidateCache(options.cacheKey);
    return fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, options?.cacheKey]);

  return { data, loading, error, refetch, setData };
}

/**
 * Hook for performing mutations with optimistic updates.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<{ data: TResult | null; error: string | null }>,
  options?: {
    onSuccess?: (data: TResult) => void;
    onError?: (error: string) => void;
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      setError(null);
      try {
        const result = await action(...args);
        if (result.error) {
          setError(result.error);
          options?.onError?.(result.error);
          return { data: null, error: result.error };
        }
        options?.onSuccess?.(result.data!);
        return { data: result.data, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        options?.onError?.(message);
        return { data: null, error: message };
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action]
  );

  return { mutate, loading, error };
}
