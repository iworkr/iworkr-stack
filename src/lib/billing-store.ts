/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getPlanByKey, type PlanDefinition } from "@/lib/plans";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface BillingState {
  subscription: Subscription | null;
  plan: PlanDefinition;
  planTier: string;
  memberCount: number;
  loading: boolean;
  /** The org currently loaded — used for refresh */
  _orgId: string | null;

  loadBilling: (orgId: string) => Promise<void>;
  /** Re-fetch billing for the current org (call after checkout, webhook, etc.) */
  refreshBilling: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  plan: getPlanByKey("free"),
  planTier: "free",
  memberCount: 0,
  loading: true,
  _orgId: null,

  loadBilling: async (orgId: string) => {
    set({ loading: true, _orgId: orgId });
    const supabase = createClient();

    try {
      const [{ data: sub }, { count }, { data: org }] = await Promise.all([
        (supabase as any)
          .from("subscriptions")
          .select("*")
          .eq("organization_id", orgId)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "active"),
        // Fallback: also read the org's plan_tier directly
        (supabase as any)
          .from("organizations")
          .select("plan_tier")
          .eq("id", orgId)
          .single(),
      ]);

      // Use subscription plan_key first, then org plan_tier as fallback
      const tier = sub?.plan_key || org?.plan_tier || "free";
      const plan = getPlanByKey(tier);

      set({
        subscription: sub || null,
        plan,
        planTier: tier,
        memberCount: count || 1,
        loading: false,
      });
    } catch (error) {
      console.error("Billing store load failed:", error);
      set({ loading: false });
    }
  },

  refreshBilling: async () => {
    const orgId = get()._orgId;
    if (orgId) await get().loadBilling(orgId);
  },
}));
