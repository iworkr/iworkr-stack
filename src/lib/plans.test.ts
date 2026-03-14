import { describe, it, expect } from "vitest";
import {
  PLANS,
  CARE_PLANS,
  ALL_PLANS,
  getPlanByKey,
  planHasFeature,
  isHigherTier,
  getPlanDisplayName,
  getBillingCycle,
  getStripePriceId,
} from "./plans";
import type { PlanDefinition } from "./plans";

/* ── Plan Arrays ──────────────────────────────────────── */

describe("PLANS", () => {
  it("has exactly 4 entries", () => {
    expect(PLANS).toHaveLength(4);
  });

  it("contains free, starter, pro, business keys", () => {
    const keys = PLANS.map((p) => p.key);
    expect(keys).toEqual(["free", "starter", "pro", "business"]);
  });

  it("every plan has a non-empty name", () => {
    PLANS.forEach((p) => {
      expect(p.name.length).toBeGreaterThan(0);
    });
  });

  it("every plan has monthlyPrice >= 0", () => {
    PLANS.forEach((p) => {
      expect(p.monthlyPrice).toBeGreaterThanOrEqual(0);
    });
  });

  it("every plan has a non-empty features array", () => {
    PLANS.forEach((p) => {
      expect(p.features.length).toBeGreaterThan(0);
    });
  });

  it("every plan has required fields", () => {
    PLANS.forEach((p) => {
      expect(p).toHaveProperty("key");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("monthlyPrice");
      expect(p).toHaveProperty("yearlyPrice");
      expect(p).toHaveProperty("limits");
      expect(p).toHaveProperty("features");
      expect(p).toHaveProperty("ctaLabel");
      expect(p).toHaveProperty("hasFreeTrial");
    });
  });

  it("free plan has $0 pricing", () => {
    const free = PLANS.find((p) => p.key === "free")!;
    expect(free.monthlyPrice).toBe(0);
    expect(free.yearlyPrice).toBe(0);
  });

  it("paid plans have positive pricing", () => {
    PLANS.filter((p) => p.key !== "free").forEach((p) => {
      expect(p.monthlyPrice).toBeGreaterThan(0);
      expect(p.yearlyPrice).toBeGreaterThan(0);
    });
  });

  it("yearly price is less than monthly price for paid plans", () => {
    PLANS.filter((p) => p.key !== "free").forEach((p) => {
      expect(p.yearlyPrice).toBeLessThan(p.monthlyPrice);
    });
  });
});

describe("CARE_PLANS", () => {
  it("has exactly 3 entries", () => {
    expect(CARE_PLANS).toHaveLength(3);
  });

  it("contains care_standard, care_premium, care_plan_manager keys", () => {
    const keys = CARE_PLANS.map((p) => p.key);
    expect(keys).toEqual(["care_standard", "care_premium", "care_plan_manager"]);
  });

  it("every care plan has a non-empty features array", () => {
    CARE_PLANS.forEach((p) => {
      expect(p.features.length).toBeGreaterThan(0);
    });
  });

  it("every care plan has monthlyPrice >= 0", () => {
    CARE_PLANS.forEach((p) => {
      expect(p.monthlyPrice).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("ALL_PLANS", () => {
  it("has exactly 7 entries", () => {
    expect(ALL_PLANS).toHaveLength(7);
  });

  it("combines PLANS and CARE_PLANS", () => {
    expect(ALL_PLANS).toEqual([...PLANS, ...CARE_PLANS]);
  });

  it("every plan has a unique key", () => {
    const keys = ALL_PLANS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* ── getPlanByKey ──────────────────────────────────────── */

describe("getPlanByKey", () => {
  it("finds plan by exact key", () => {
    expect(getPlanByKey("pro").key).toBe("pro");
  });

  it("finds starter plan", () => {
    expect(getPlanByKey("starter").key).toBe("starter");
  });

  it("finds business plan", () => {
    expect(getPlanByKey("business").key).toBe("business");
  });

  it("finds care_standard plan", () => {
    expect(getPlanByKey("care_standard").key).toBe("care_standard");
  });

  it("finds care_premium plan", () => {
    expect(getPlanByKey("care_premium").key).toBe("care_premium");
  });

  it("finds care_plan_manager plan", () => {
    expect(getPlanByKey("care_plan_manager").key).toBe("care_plan_manager");
  });

  it('strips "_monthly" suffix', () => {
    expect(getPlanByKey("pro_monthly").key).toBe("pro");
  });

  it('strips "_yearly" suffix', () => {
    expect(getPlanByKey("pro_yearly").key).toBe("pro");
  });

  it('strips "_annual" suffix', () => {
    expect(getPlanByKey("starter_annual").key).toBe("starter");
  });

  it("returns free plan for null", () => {
    expect(getPlanByKey(null).key).toBe("free");
  });

  it("returns free plan for undefined", () => {
    expect(getPlanByKey(undefined).key).toBe("free");
  });

  it("returns free plan for unknown key", () => {
    expect(getPlanByKey("nonexistent").key).toBe("free");
  });

  it("returns free plan for empty string", () => {
    // empty string is truthy for the function, but won't match any plan
    expect(getPlanByKey("").key).toBe("free");
  });
});

/* ── planHasFeature ───────────────────────────────────── */

describe("planHasFeature", () => {
  it("free plan does not have apiAccess", () => {
    expect(planHasFeature("free", "apiAccess")).toBe(false);
  });

  it("pro plan has apiAccess", () => {
    expect(planHasFeature("pro", "apiAccess")).toBe(true);
  });

  it("care_premium has prodaClaiming", () => {
    expect(planHasFeature("care_premium", "prodaClaiming")).toBe(true);
  });

  it("free plan does not have prodaClaiming", () => {
    expect(planHasFeature("free", "prodaClaiming")).toBe(false);
  });

  it("free plan has maxUsers > 0 (returns true for numeric > 0)", () => {
    expect(planHasFeature("free", "maxUsers")).toBe(true);
  });

  it("free plan does not have customForms", () => {
    expect(planHasFeature("free", "customForms")).toBe(false);
  });

  it("starter plan has customForms", () => {
    expect(planHasFeature("starter", "customForms")).toBe(true);
  });

  it("business plan has sso", () => {
    expect(planHasFeature("business", "sso")).toBe(true);
  });

  it("pro plan does not have sso", () => {
    expect(planHasFeature("pro", "sso")).toBe(false);
  });

  it("business plan has dedicatedManager", () => {
    expect(planHasFeature("business", "dedicatedManager")).toBe(true);
  });

  it("care_plan_manager has ocrProcessing", () => {
    expect(planHasFeature("care_plan_manager", "ocrProcessing")).toBe(true);
  });

  it("care_plan_manager has planManagerInbox", () => {
    expect(planHasFeature("care_plan_manager", "planManagerInbox")).toBe(true);
  });

  it("care_standard has sentinelAlerts", () => {
    expect(planHasFeature("care_standard", "sentinelAlerts")).toBe(true);
  });

  it("care_premium has schadsEngine", () => {
    expect(planHasFeature("care_premium", "schadsEngine")).toBe(true);
  });

  it("null plan falls back to free", () => {
    expect(planHasFeature(null, "apiAccess")).toBe(false);
  });

  it("care_plan_manager maxUsers is 0 (returns false)", () => {
    expect(planHasFeature("care_plan_manager", "maxUsers")).toBe(false);
  });
});

/* ── isHigherTier ─────────────────────────────────────── */

describe("isHigherTier", () => {
  it("pro is higher than starter", () => {
    expect(isHigherTier("pro", "starter")).toBe(true);
  });

  it("starter is NOT higher than pro", () => {
    expect(isHigherTier("starter", "pro")).toBe(false);
  });

  it("business is higher than free", () => {
    expect(isHigherTier("business", "free")).toBe(true);
  });

  it("free is NOT higher than free (same tier)", () => {
    expect(isHigherTier("free", "free")).toBe(false);
  });

  it("care_premium is higher than care_standard", () => {
    expect(isHigherTier("care_premium", "care_standard")).toBe(true);
  });

  it("care_standard is higher than business", () => {
    expect(isHigherTier("care_standard", "business")).toBe(true);
  });

  it("starter is higher than free", () => {
    expect(isHigherTier("starter", "free")).toBe(true);
  });

  it("free is NOT higher than starter", () => {
    expect(isHigherTier("free", "starter")).toBe(false);
  });

  it("care_premium is higher than free", () => {
    expect(isHigherTier("care_premium", "free")).toBe(true);
  });

  it("handles _monthly suffix", () => {
    expect(isHigherTier("pro_monthly", "starter_monthly")).toBe(true);
  });

  it("handles _yearly suffix", () => {
    expect(isHigherTier("business_yearly", "pro_yearly")).toBe(true);
  });

  it("handles _annual suffix", () => {
    expect(isHigherTier("pro_annual", "starter_annual")).toBe(true);
  });
});

/* ── getPlanDisplayName ───────────────────────────────── */

describe("getPlanDisplayName", () => {
  it('returns "Free" for null', () => {
    expect(getPlanDisplayName(null)).toBe("Free");
  });

  it('returns "Free" for undefined', () => {
    expect(getPlanDisplayName(undefined)).toBe("Free");
  });

  it('returns "Free" for "free"', () => {
    expect(getPlanDisplayName("free")).toBe("Free");
  });

  it('returns "Starter" for "starter"', () => {
    expect(getPlanDisplayName("starter")).toBe("Starter");
  });

  it('returns "Standard" for "pro"', () => {
    expect(getPlanDisplayName("pro")).toBe("Standard");
  });

  it('returns "Enterprise" for "business"', () => {
    expect(getPlanDisplayName("business")).toBe("Enterprise");
  });

  it('returns "iWorkr Care" for "care_standard"', () => {
    expect(getPlanDisplayName("care_standard")).toBe("iWorkr Care");
  });

  it('returns "iWorkr Care Premium" for "care_premium"', () => {
    expect(getPlanDisplayName("care_premium")).toBe("iWorkr Care Premium");
  });

  it('returns "Plan Manager Add-on" for "care_plan_manager"', () => {
    expect(getPlanDisplayName("care_plan_manager")).toBe("Plan Manager Add-on");
  });

  it('handles "_monthly" suffix', () => {
    expect(getPlanDisplayName("pro_monthly")).toBe("Standard");
  });

  it('returns "Free" for unknown key', () => {
    expect(getPlanDisplayName("unknown")).toBe("Free");
  });
});

/* ── getBillingCycle ──────────────────────────────────── */

describe("getBillingCycle", () => {
  it('returns "free" for null', () => {
    expect(getBillingCycle(null)).toBe("free");
  });

  it('returns "free" for undefined', () => {
    expect(getBillingCycle(undefined)).toBe("free");
  });

  it('returns "free" for "free"', () => {
    expect(getBillingCycle("free")).toBe("free");
  });

  it('returns "monthly" for "pro_monthly"', () => {
    expect(getBillingCycle("pro_monthly")).toBe("monthly");
  });

  it('returns "yearly" for "pro_yearly"', () => {
    expect(getBillingCycle("pro_yearly")).toBe("yearly");
  });

  it('returns "yearly" for "pro_annual"', () => {
    expect(getBillingCycle("pro_annual")).toBe("yearly");
  });

  it('returns "monthly" for bare plan key (no suffix)', () => {
    expect(getBillingCycle("pro")).toBe("monthly");
  });

  it('returns "monthly" for "starter"', () => {
    expect(getBillingCycle("starter")).toBe("monthly");
  });

  it('returns "yearly" for "business_yearly"', () => {
    expect(getBillingCycle("business_yearly")).toBe("yearly");
  });

  it('returns "yearly" for "care_premium_annual"', () => {
    expect(getBillingCycle("care_premium_annual")).toBe("yearly");
  });
});

/* ── getStripePriceId ─────────────────────────────────── */

describe("getStripePriceId", () => {
  const mockPlan: PlanDefinition = {
    key: "test",
    name: "Test Plan",
    description: "A test plan",
    monthlyPrice: 10,
    yearlyPrice: 8,
    stripePriceIdMonthly: "price_monthly_123",
    stripePriceIdYearly: "price_yearly_456",
    limits: {
      maxUsers: 5,
      maxJobsPerMonth: 100,
      maxAutomations: 10,
      apiAccess: false,
      customForms: false,
      multiBranch: false,
      aiPhoneAgent: false,
      integrations: false,
      sso: false,
      prioritySupport: false,
      dedicatedManager: false,
      prodaClaiming: false,
      schadsEngine: false,
      auditDossier: false,
      sentinelAlerts: false,
      planManagerInbox: false,
      ocrProcessing: false,
      budgetQuarantining: false,
      multiFunderSplitting: false,
    },
    highlighted: false,
    features: ["Feature A"],
    ctaLabel: "Subscribe",
    hasFreeTrial: false,
    trialDays: 0,
  };

  it("returns yearly price id when yearly=true", () => {
    expect(getStripePriceId(mockPlan, true)).toBe("price_yearly_456");
  });

  it("returns monthly price id when yearly=false", () => {
    expect(getStripePriceId(mockPlan, false)).toBe("price_monthly_123");
  });

  it("returns empty string for free plan (no Stripe price ids)", () => {
    const freePlan = PLANS[0];
    expect(getStripePriceId(freePlan, false)).toBe("");
    expect(getStripePriceId(freePlan, true)).toBe("");
  });
});

/* ── Plan structure integrity ─────────────────────────── */

describe("Plan structure integrity", () => {
  it("every plan in ALL_PLANS has all required limit keys", () => {
    const requiredLimitKeys: (keyof typeof ALL_PLANS[0]["limits"])[] = [
      "maxUsers",
      "maxJobsPerMonth",
      "maxAutomations",
      "apiAccess",
      "customForms",
      "multiBranch",
      "aiPhoneAgent",
      "integrations",
      "sso",
      "prioritySupport",
      "dedicatedManager",
      "prodaClaiming",
      "schadsEngine",
      "auditDossier",
      "sentinelAlerts",
      "planManagerInbox",
      "ocrProcessing",
      "budgetQuarantining",
      "multiFunderSplitting",
    ];

    ALL_PLANS.forEach((plan) => {
      requiredLimitKeys.forEach((key) => {
        expect(plan.limits).toHaveProperty(key);
      });
    });
  });

  it("pro plan is highlighted (most popular)", () => {
    const pro = ALL_PLANS.find((p) => p.key === "pro")!;
    expect(pro.highlighted).toBe(true);
    expect(pro.badge).toBe("Most popular");
  });

  it("care_premium is highlighted (recommended)", () => {
    const premium = ALL_PLANS.find((p) => p.key === "care_premium")!;
    expect(premium.highlighted).toBe(true);
    expect(premium.badge).toBe("Recommended");
  });

  it("all paid plans have free trial", () => {
    ALL_PLANS.filter((p) => p.key !== "free").forEach((p) => {
      expect(p.hasFreeTrial).toBe(true);
      expect(p.trialDays).toBe(14);
    });
  });

  it("free plan has no trial", () => {
    const free = ALL_PLANS.find((p) => p.key === "free")!;
    expect(free.hasFreeTrial).toBe(false);
    expect(free.trialDays).toBe(0);
  });
});
