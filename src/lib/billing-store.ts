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

  loadBilling: (orgId: string) => Promise<void>;
}

export const useBillingStore = create<BillingState>((set) => ({
  subscription: null,
  plan: getPlanByKey("free"),
  planTier: "free",
  memberCount: 0,
  loading: true,

  loadBilling: async (orgId: string) => {
    set({ loading: true });
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
        (supabase as any)
          .from("organizations")
          .select("plan_tier")
          .eq("id", orgId)
          .single(),
      ]);

      const tier = (org?.plan_tier as string) || sub?.plan_key || "free";
      const plan = getPlanByKey(tier);

      set({
        subscription: sub || null,
        plan,
        planTier: tier,
        memberCount: count || 1,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));
