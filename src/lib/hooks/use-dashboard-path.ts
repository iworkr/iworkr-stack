/**
 * useDashboardPath — Sector-aware dashboard routing
 *
 * Returns the correct dashboard home path based on the current org's
 * industry_type. Trades orgs → "/dashboard", Care orgs → "/dashboard/care".
 *
 * Usage:
 *   const dashboardPath = useDashboardPath();
 *   router.push(dashboardPath);
 *   <Link href={dashboardPath}>Home</Link>
 */

import { useAuthStore } from "@/lib/auth-store";

/** React hook — reads the current org's industry_type from the auth store. */
export function useDashboardPath(): string {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const isCare =
    (currentOrg as Record<string, unknown> | null)?.industry_type === "care";
  return isCare ? "/dashboard/care" : "/dashboard";
}

/**
 * Non-hook utility — reads the auth store imperatively.
 * Use in event handlers, callbacks, or non-React contexts.
 */
export function getDashboardPath(): string {
  const currentOrg = useAuthStore.getState().currentOrg;
  const isCare =
    (currentOrg as Record<string, unknown> | null)?.industry_type === "care";
  return isCare ? "/dashboard/care" : "/dashboard";
}
