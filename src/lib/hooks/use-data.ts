"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic hook for fetching data from server actions.
 * Handles loading, error, and refetch states.
 */
export function useData<T>(
  fetcher: () => Promise<{ data: T | null; error: string | null }>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (!mountedRef.current) return;
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
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

  return { data, loading, error, refetch: fetch, setData };
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
