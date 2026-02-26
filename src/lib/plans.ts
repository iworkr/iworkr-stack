/**
 * Plan configuration — the single source of truth for pricing,
 * feature limits, and Polar price IDs.
 *
 * When Polar Products/Prices are created, replace the placeholder
 * `price_xxx` values with real Polar Price IDs.
 */

export interface PlanLimits {
  maxUsers: number;
  maxJobsPerMonth: number;
  maxAutomations: number;
  apiAccess: boolean;
  customForms: boolean;
  multiBranch: boolean;
  aiPhoneAgent: boolean;
  integrations: boolean;
  sso: boolean;
  prioritySupport: boolean;
  dedicatedManager: boolean;
}

export interface PlanDefinition {
  key: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  /** Polar Product ID (the product itself) */
  polarProductId: string;
  /** Polar Price ID for monthly billing */
  polarPriceIdMonthly: string;
  /** Polar Price ID for yearly billing (empty if not available yet) */
  polarPriceIdYearly: string;
  /** Stripe Price ID for monthly billing */
  stripePriceIdMonthly: string;
  /** Stripe Price ID for yearly billing */
  stripePriceIdYearly: string;
  limits: PlanLimits;
  highlighted: boolean;
  badge?: string;
  features: string[];
  ctaLabel: string;
  /** Whether this plan has a free trial */
  hasFreeTrial: boolean;
  trialDays: number;
}

/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  POLAR.SH PRODUCT MAPPING (Live)                               │
 * │                                                                 │
 * │  Starter   → Product: 95b33e16-0141-4359-8d6c-464b5f08a254    │
 * │              Price:   a70530fd-5055-4477-9bf6-291428d08856     │
 * │                                                                 │
 * │  Standard  → Product: 7673fa11-335c-4e37-a5cf-106f17202e58    │
 * │              Price:   5ed03136-ef53-4795-8512-fcae419212a6     │
 * │                                                                 │
 * │  Enterprise → Product: e5ac6ca6-8dfa-4be8-85aa-87c2eac2633e   │
 * │               Price:   72baea92-875b-4ed1-9ae3-fed6f349f7ad   │
 * │                                                                 │
 * │  All plans include 14-day free trial.                          │
 * │  To change pricing, update both here AND in Polar Dashboard.   │
 * └─────────────────────────────────────────────────────────────────┘
 */
export const PLANS: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    description: "Get started with the basics.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    polarProductId: "",
    polarPriceIdMonthly: "",
    polarPriceIdYearly: "",
    stripePriceIdMonthly: "",
    stripePriceIdYearly: "",
    limits: {
      maxUsers: 1,
      maxJobsPerMonth: 10,
      maxAutomations: 0,
      apiAccess: false,
      customForms: false,
      multiBranch: false,
      aiPhoneAgent: false,
      integrations: false,
      sso: false,
      prioritySupport: false,
      dedicatedManager: false,
    },
    highlighted: false,
    features: [
      "1 user",
      "10 jobs per month",
      "Basic scheduling",
      "Client database",
      "Mobile app",
    ],
    ctaLabel: "Current plan",
    hasFreeTrial: false,
    trialDays: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For solo operators getting organized.",
    monthlyPrice: 47,
    yearlyPrice: 38,
    polarProductId: "95b33e16-0141-4359-8d6c-464b5f08a254",
    polarPriceIdMonthly: "a70530fd-5055-4477-9bf6-291428d08856",
    polarPriceIdYearly: process.env.NEXT_PUBLIC_POLAR_PRICE_STARTER_YEARLY || "",
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY || "",
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY || "",
    limits: {
      maxUsers: 5,
      maxJobsPerMonth: Infinity,
      maxAutomations: 5,
      apiAccess: false,
      customForms: true,
      multiBranch: false,
      aiPhoneAgent: false,
      integrations: true,
      sso: false,
      prioritySupport: false,
      dedicatedManager: false,
    },
    highlighted: false,
    features: [
      "Up to 5 users",
      "Unlimited jobs",
      "Job scheduling",
      "Basic invoicing",
      "Mobile app (iOS + Android)",
      "Client database",
      "5 automations",
      "Email support",
    ],
    ctaLabel: "Start free trial",
    hasFreeTrial: true,
    trialDays: 14,
  },
  {
    key: "pro",
    name: "Standard",
    description: "For growing teams that need automation.",
    monthlyPrice: 97,
    yearlyPrice: 78,
    polarProductId: "7673fa11-335c-4e37-a5cf-106f17202e58",
    polarPriceIdMonthly: "5ed03136-ef53-4795-8512-fcae419212a6",
    polarPriceIdYearly: process.env.NEXT_PUBLIC_POLAR_PRICE_PRO_YEARLY || "",
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || "",
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || "",
    limits: {
      maxUsers: 25,
      maxJobsPerMonth: Infinity,
      maxAutomations: Infinity,
      apiAccess: true,
      customForms: true,
      multiBranch: true,
      aiPhoneAgent: true,
      integrations: true,
      sso: false,
      prioritySupport: true,
      dedicatedManager: false,
    },
    highlighted: true,
    badge: "Most popular",
    features: [
      "Up to 25 users",
      "Unlimited jobs & automations",
      "AI Phone Agent",
      "Smart routing",
      "Stripe + Xero integration",
      "Custom forms & quotes",
      "Priority support",
      "Multi-branch",
      "API access",
    ],
    ctaLabel: "Start free trial",
    hasFreeTrial: true,
    trialDays: 14,
  },
  {
    key: "business",
    name: "Enterprise",
    description: "For operations at scale.",
    monthlyPrice: 247,
    yearlyPrice: 198,
    polarProductId: "e5ac6ca6-8dfa-4be8-85aa-87c2eac2633e",
    polarPriceIdMonthly: "72baea92-875b-4ed1-9ae3-fed6f349f7ad",
    polarPriceIdYearly: process.env.NEXT_PUBLIC_POLAR_PRICE_BUSINESS_YEARLY || "",
    stripePriceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY || "",
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY || "",
    limits: {
      maxUsers: Infinity,
      maxJobsPerMonth: Infinity,
      maxAutomations: Infinity,
      apiAccess: true,
      customForms: true,
      multiBranch: true,
      aiPhoneAgent: true,
      integrations: true,
      sso: true,
      prioritySupport: true,
      dedicatedManager: true,
    },
    highlighted: false,
    features: [
      "Unlimited users",
      "Everything in Standard",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "Advanced analytics",
      "SSO / SAML",
      "Training & onboarding",
    ],
    ctaLabel: "Contact sales",
    hasFreeTrial: true,
    trialDays: 14,
  },
];

/** Helper: look up a plan by its key (handles monthly/annual suffixes) */
export function getPlanByKey(planKey: string | null | undefined): PlanDefinition {
  if (!planKey) return PLANS[0]; // free
  const baseKey = planKey
    .replace(/_monthly$/, "")
    .replace(/_annual$/, "")
    .replace(/_yearly$/, "");
  return PLANS.find((p) => p.key === baseKey) || PLANS[0];
}

/** Helper: determine if a given plan key has a specific feature */
export function planHasFeature(
  planKey: string | null | undefined,
  feature: keyof PlanLimits
): boolean {
  const plan = getPlanByKey(planKey);
  const val = plan.limits[feature];
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val > 0;
  return false;
}

/** Plan tier ordering for comparisons */
const PLAN_ORDER = ["free", "starter", "pro", "business"];

/** Is plan A strictly higher tier than plan B? */
export function isHigherTier(planA: string, planB: string): boolean {
  const a = planA.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "");
  const b = planB.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "");
  return PLAN_ORDER.indexOf(a) > PLAN_ORDER.indexOf(b);
}

/** Get the user-visible plan name from a plan key */
export function getPlanDisplayName(planKey: string | null | undefined): string {
  return getPlanByKey(planKey).name;
}

/** Get billing cycle from plan key */
export function getBillingCycle(planKey: string | null | undefined): "monthly" | "yearly" | "free" {
  if (!planKey || planKey === "free") return "free";
  if (planKey.includes("annual") || planKey.includes("yearly")) return "yearly";
  return "monthly";
}
