/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getPlanByKey, type PlanDefinition } from "@/lib/plans";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface BillingState {
  subscription: Subscription | null;
  plan: PlanDefinition;
  memberCount: number;
  loading: boolean;

  loadBilling: (orgId: string) => Promise<void>;
}

export const useBillingStore = create<BillingState>((set) => ({
  subscription: null,
  plan: getPlanByKey("free"),
  memberCount: 0,
  loading: true,

  loadBilling: async (orgId: string) => {
    set({ loading: true });
    const supabase = createClient();

    try {
      const { data: sub } = await (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("organization_id", orgId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await (supabase as any)
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active");

      const plan = getPlanByKey(sub?.plan_key);

      set({
        subscription: sub || null,
        plan,
        memberCount: count || 1,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));
