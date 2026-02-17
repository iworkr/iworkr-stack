"use client";

import { useState, useCallback } from "react";
import { useBillingStore } from "@/lib/billing-store";
import { FEATURE_CONFIG, type GatedFeature } from "./feature-gate";
import { ModalPaywall } from "./paywall";

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

/**
 * Hook for feature intercepts — use when an action (not a page)
 * should be gated behind a plan.
 *
 * Usage:
 *   const { guard, PaywallOverlay } = usePaywall("export");
 *   function handleExport() {
 *     if (!guard()) return; // Shows paywall if on free plan
 *     // ... actual export logic
 *   }
 *   return <><button onClick={handleExport}>Export</button><PaywallOverlay /></>;
 */
export function usePaywall(feature: GatedFeature) {
  const [showPaywall, setShowPaywall] = useState(false);
  const { subscription } = useBillingStore();
  const config = FEATURE_CONFIG[feature];

  const currentPlan = subscription?.plan_key
    ?.replace(/_monthly$/, "")
    .replace(/_annual$/, "")
    .replace(/_yearly$/, "") || "free";

  const allowed = (PLAN_TIERS[currentPlan] ?? 0) >= (PLAN_TIERS[config.requiredPlan] ?? 0);

  const guard = useCallback(() => {
    if (allowed) return true;
    setShowPaywall(true);
    return false;
  }, [allowed]);

  const PaywallOverlay = useCallback(() => {
    if (!showPaywall) return null;
    return (
      <ModalPaywall
        feature={feature}
        config={config}
        onClose={() => setShowPaywall(false)}
      />
    );
  }, [showPaywall, feature, config]);

  return { allowed, guard, PaywallOverlay, showPaywall };
}
