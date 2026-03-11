/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/manage
 *
 * Actions: cancel, reactivate, change-plan
 * All subscription management happens server-side.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, orgId, newPriceId } = body as {
    action: "cancel" | "reactivate" | "change-plan";
    orgId: string;
    newPriceId?: string;
  };

  if (!orgId || !action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify admin role
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  // Get active subscription
  const { data: sub } = await (supabase as any)
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("organization_id", orgId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const stripe = getStripe();

  try {
    switch (action) {
      case "cancel": {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        return NextResponse.json({ success: true, message: "Subscription will cancel at period end" });
      }

      case "reactivate": {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: false,
        });
        return NextResponse.json({ success: true, message: "Subscription reactivated" });
      }

      case "change-plan": {
        if (!newPriceId) {
          return NextResponse.json({ error: "Missing newPriceId" }, { status: 400 });
        }

        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        const currentItem = stripeSub.items.data[0];

        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          items: [{ id: currentItem.id, price: newPriceId }],
          proration_behavior: "create_prorations",
        });

        return NextResponse.json({ success: true, message: "Plan updated" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Stripe Manage]", err.message);
    return NextResponse.json({ error: err.message || "Stripe error" }, { status: 500 });
  }
}
