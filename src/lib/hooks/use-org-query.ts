/**
 * @hook useOrgQuery
 * @status COMPLETE
 * @description Universal org-scoped React Query hook with automatic orgId gating
 * @lastAudit 2026-03-22
 */
"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useOrg } from "./use-org";

/**
 * Universal org-scoped query hook.
 * Replaces the useState + useEffect + useCallback anti-pattern.
 * Automatically gates on orgId and provides typed return.
 */
export function useOrgQuery<T>(
  keyFactory: (orgId: string) => readonly unknown[],
  fetcher: (orgId: string) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn" | "enabled">
) {
  const { orgId } = useOrg();

  return useQuery<T, Error>({
    queryKey: keyFactory(orgId ?? ""),
    queryFn: () => fetcher(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Query hook that takes orgId explicitly (for components that already have it).
 */
export function useTypedQuery<T>(
  queryKey: readonly unknown[],
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery<T, Error>({
    queryKey: queryKey as unknown[],
    queryFn: fetcher,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 60_000,
  });
}

/**
 * Universal mutation hook with cache invalidation.
 */
export function useOrgMutation<TInput, TOutput = unknown>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  invalidateKeys?: readonly unknown[][]
) {
  const queryClient = useQueryClient();

  return useMutation<TOutput, Error, TInput>({
    mutationFn,
    onSuccess: () => {
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key as unknown[] });
        }
      }
    },
  });
}
