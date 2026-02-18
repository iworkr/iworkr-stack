"use client";

import { type ReactNode } from "react";
import { useBillingStore } from "@/lib/billing-store";
import { Paywall } from "./paywall";

/* ── Feature definitions mapped to plan limits ─────────── */

export type GatedFeature =
  | "automations"
  | "integrations"
  | "custom_forms"
  | "ai_phone_agent"
  | "multi_branch"
  | "api_access"
  | "sso"
  | "analytics"
  | "unlimited_seats"
  | "export";

export interface FeatureConfig {
  label: string;
  description: string;
  requiredPlan: string;
  benefits: string[];
  paywallVariant: "full_page" | "modal" | "banner";
}

export const FEATURE_CONFIG: Record<GatedFeature, FeatureConfig> = {
  automations: {
    label: "Automations",
    description: "Put your business on autopilot. Save 20+ hours a week.",
    requiredPlan: "starter",
    benefits: [
      "Unlimited automation workflows",
      "SMS & email triggers",
      "Scheduled job creation",
    ],
    paywallVariant: "full_page",
  },
  integrations: {
    label: "Integrations",
    description: "Connect your workspace to your favourite tools — Stripe, Xero, and more.",
    requiredPlan: "starter",
    benefits: [
      "Stripe payment sync",
      "Xero accounting integration",
      "Zapier connections",
    ],
    paywallVariant: "full_page",
  },
  custom_forms: {
    label: "Custom Forms",
    description: "Build branded inspection forms, safety checklists, and quotes.",
    requiredPlan: "starter",
    benefits: [
      "Drag-and-drop form builder",
      "Digital signatures",
      "PDF export & archival",
    ],
    paywallVariant: "full_page",
  },
  ai_phone_agent: {
    label: "AI Phone Agent",
    description: "Let AI handle your inbound calls and book jobs automatically.",
    requiredPlan: "pro",
    benefits: [
      "24/7 AI call answering",
      "Automatic job booking",
      "Smart call routing",
    ],
    paywallVariant: "modal",
  },
  multi_branch: {
    label: "Multi-Branch",
    description: "Manage multiple locations from a single workspace.",
    requiredPlan: "pro",
    benefits: [
      "Unlimited branches",
      "Per-branch reporting",
      "Centralized team view",
    ],
    paywallVariant: "modal",
  },
  api_access: {
    label: "API Access",
    description: "Build custom integrations with the REST API.",
    requiredPlan: "pro",
    benefits: [
      "Full REST API",
      "Webhook subscriptions",
      "Rate limit: 10,000/min",
    ],
    paywallVariant: "modal",
  },
  sso: {
    label: "SSO / SAML",
    description: "Enterprise-grade single sign-on for your organization.",
    requiredPlan: "business",
    benefits: [
      "SAML 2.0 support",
      "Google Workspace SSO",
      "Active Directory sync",
    ],
    paywallVariant: "modal",
  },
  analytics: {
    label: "Advanced Analytics",
    description: "Deep insights into your operations — revenue, efficiency, and more.",
    requiredPlan: "pro",
    benefits: [
      "Revenue forecasting",
      "Technician productivity",
      "Client lifetime value",
    ],
    paywallVariant: "full_page",
  },
  unlimited_seats: {
    label: "Unlimited Seats",
    description: "Add your entire team without worrying about limits.",
    requiredPlan: "starter",
    benefits: [
      "Up to 25 team members (Standard)",
      "Unlimited with Enterprise",
      "Role-based access control",
    ],
    paywallVariant: "banner",
  },
  export: {
    label: "Data Export",
    description: "Export your jobs, clients, and invoices to CSV or PDF.",
    requiredPlan: "starter",
    benefits: [
      "CSV & PDF exports",
      "Scheduled reports",
      "Custom date ranges",
    ],
    paywallVariant: "modal",
  },
};

/* ── Plan tier ordering ────────────────────────────────── */

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

function meetsRequirement(currentPlan: string, requiredPlan: string): boolean {
  const current = PLAN_TIERS[currentPlan] ?? 0;
  const required = PLAN_TIERS[requiredPlan] ?? 0;
  return current >= required;
}

/* ── Hook: check feature access ────────────────────────── */

export function useFeatureAccess(feature: GatedFeature): {
  allowed: boolean;
  config: FeatureConfig;
  currentPlan: string;
} {
  const { plan, subscription } = useBillingStore();
  const config = FEATURE_CONFIG[feature];
  const currentPlan = subscription?.plan_key?.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "") || "free";
  const allowed = meetsRequirement(currentPlan, config.requiredPlan);
  return { allowed, config, currentPlan };
}

/* ── FeatureGate component ─────────────────────────────── */

interface FeatureGateProps {
  feature: GatedFeature;
  children: ReactNode;
  /** Override the default paywall variant */
  variant?: "full_page" | "modal" | "banner";
}

export function FeatureGate({ feature, children, variant }: FeatureGateProps) {
  const { allowed, config, currentPlan } = useFeatureAccess(feature);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <Paywall
      feature={feature}
      config={config}
      currentPlan={currentPlan}
      variant={variant || config.paywallVariant}
    />
  );
}
