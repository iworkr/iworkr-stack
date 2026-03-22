/**
 * @module Stripe
 * @status COMPLETE
 * @description Stripe SDK singleton initialization with lazy loading and env validation
 * @lastAudit 2026-03-22
 */

import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment variables."
      );
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

/**
 * Map a Stripe Price ID back to a plan key.
 * Falls back to checking env vars for dynamic configuration.
 */
export function stripePriceToPlanKey(priceId: string): string {
  const priceMap: Record<string, string> = {};

  // Build map from env vars
  const envPairs = [
    ["NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY", "starter"],
    ["NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY", "starter"],
    ["NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY", "pro"],
    ["NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY", "pro"],
    ["NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY", "business"],
    ["NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY", "business"],
  ] as const;

  for (const [envKey, planKey] of envPairs) {
    const val = process.env[envKey];
    if (val) priceMap[val] = planKey;
  }

  return priceMap[priceId] || "free";
}
