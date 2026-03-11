/**
 * Plan configuration — the single source of truth for pricing,
 * feature limits, and Stripe Price IDs.
 *
 * All billing flows through self-hosted Stripe Checkout (Embedded).
 * Stripe Price IDs are loaded from env vars so they can differ
 * between staging and production.
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

export const PLANS: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    description: "Get started with the basics.",
    monthlyPrice: 0,
    yearlyPrice: 0,
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

/** Get the Stripe Price ID for a plan based on billing interval */
export function getStripePriceId(plan: PlanDefinition, yearly: boolean): string {
  return yearly ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
}
