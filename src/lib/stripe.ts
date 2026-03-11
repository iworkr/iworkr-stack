import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
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
