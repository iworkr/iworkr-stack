"use client";

import { useOrg } from "./use-org";
import { useData } from "./use-data";

/**
 * Fetches data that requires an organization context.
 * Automatically waits for org to be loaded before fetching.
 */
export function useOrgData<T>(
  fetcher: (orgId: string) => Promise<{ data: T | null; error: string | null }>,
  deps: unknown[] = []
) {
  const { orgId, loading: orgLoading } = useOrg();

  const result = useData<T>(
    async () => {
      if (!orgId) return { data: null, error: orgLoading ? null : "No organization" };
      return fetcher(orgId);
    },
    [orgId, orgLoading, ...deps]
  );

  return {
    ...result,
    loading: orgLoading || result.loading,
    orgId,
  };
}
