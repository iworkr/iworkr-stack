"use client";

import { useAuthStore } from "@/lib/auth-store";
import { useBillingStore } from "@/lib/billing-store";
import {
  planHasFeature,
  getPlanByKey,
  type PlanLimits,
} from "@/lib/plans";

/**
 * Hook to gate features based on the current org's subscription plan.
 *
 * Usage:
 *   const { canAccess, plan, currentLimit } = useFeatureGate("aiPhoneAgent");
 *   if (!canAccess) return <UpgradePrompt />;
 */
export function useFeatureGate(feature: keyof PlanLimits) {
  const { currentOrg } = useAuthStore();
  const { subscription, plan } = useBillingStore();

  const planKey = subscription?.plan_key || "free";
  const canAccess = planHasFeature(planKey, feature);
  const currentLimit = plan.limits[feature];

  return {
    canAccess,
    plan,
    planKey,
    currentLimit,
    orgId: currentOrg?.id,
  };
}

/**
 * Hook to check if the org can add more of a counted resource.
 *
 * Usage:
 *   const { canAdd, remaining } = useQuotaCheck("maxUsers", currentMemberCount);
 */
export function useQuotaCheck(
  limitKey: keyof PlanLimits,
  currentCount: number
) {
  const { subscription, plan } = useBillingStore();

  const planKey = subscription?.plan_key || "free";
  const resolvedPlan = getPlanByKey(planKey);
  const limit = resolvedPlan.limits[limitKey];

  if (typeof limit !== "number") {
    return { canAdd: limit === true, remaining: Infinity, limit };
  }

  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - currentCount);

  return {
    canAdd: remaining > 0,
    remaining,
    limit,
  };
}
