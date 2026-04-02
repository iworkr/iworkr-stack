/**
 * @module components/monetization/index.ts
 * @status STABLE
 * @description Monetization barrel — index
 * @lastReview 2026-03-28
 */
export { FeatureGate, useFeatureAccess, FEATURE_CONFIG, type GatedFeature } from "./feature-gate";
export { Paywall, ModalPaywall } from "./paywall";
export { UpgradeCelebration } from "./upgrade-celebration";
export { ProBadge, LockIndicator } from "./pro-badge";
export { usePaywall } from "./use-paywall";
