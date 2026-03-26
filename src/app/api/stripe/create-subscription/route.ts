/**
 * @route POST /api/stripe/create-subscription
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org admin/owner role
 * @description Creates a Stripe subscription with client secret for embedded checkout
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RecoveredIntent =
  | { clientSecret: string; type: "setup" }
  | { clientSecret: string; type: "payment" }
  | null;

function extractRecoveredIntent(subscription: any): RecoveredIntent {
  const setupIntent = subscription?.pending_setup_intent as any;
  const paymentIntent = subscription?.latest_invoice?.payment_intent as any;

  if (setupIntent?.client_secret) {
    return {
      clientSecret: setupIntent.client_secret as string,
      type: "setup",
    };
  }

  if (paymentIntent?.client_secret) {
    return {
      clientSecret: paymentIntent.client_secret as string,
      type: "payment",
    };
  }

  return null;
}

/**
 * POST /api/stripe/create-subscription
 *
 * Creates a Stripe Subscription with a client_secret for embedded checkout.
 * Returns the client secret so the frontend can confirm payment with
 * Stripe Elements — fully self-hosted, no Stripe-hosted pages.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { priceId, orgId } = body as { priceId: string; orgId: string };

  if (!priceId || !orgId) {
    return NextResponse.json({ error: "Missing priceId or orgId" }, { status: 400 });
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

  const stripe = getStripe();

  // Get or create Stripe customer
  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", orgId)
    .single();

  if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { organization_id: orgId, supabase_user_id: user.id },
    });
    customerId = customer.id;

    await (supabase as any)
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", orgId);
  }

  // Midas-Touch hardening:
  // Guard against duplicate subscriptions and recover abandoned incomplete flows.
  const { data: existingSubscription } = await (supabase as any)
    .from("subscriptions")
    .select("id, status, stripe_subscription_id, created_at")
    .eq("organization_id", orgId)
    .in("status", ["active", "trialing", "incomplete"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSubscription?.status === "active" || existingSubscription?.status === "trialing") {
    return NextResponse.json(
      {
        error: "You already have an active subscription.",
        code: "already_subscribed",
      },
      { status: 409 }
    );
  }

  if (existingSubscription?.status === "incomplete" && existingSubscription?.stripe_subscription_id) {
    try {
      const existingStripeSubscription = await stripe.subscriptions.retrieve(
        existingSubscription.stripe_subscription_id,
        {
          expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
        }
      );

      if (existingStripeSubscription.status === "active" || existingStripeSubscription.status === "trialing") {
        return NextResponse.json(
          {
            error: "You already have an active subscription.",
            code: "already_subscribed",
          },
          { status: 409 }
        );
      }

      if (existingStripeSubscription.status === "incomplete") {
        const recoveredIntent = extractRecoveredIntent(existingStripeSubscription);
        if (recoveredIntent) {
          return NextResponse.json({
            subscriptionId: existingStripeSubscription.id,
            clientSecret: recoveredIntent.clientSecret,
            type: recoveredIntent.type,
            recovered: true,
          });
        }
      }
    } catch (recoveryError: any) {
      // Recovery is best-effort. If Stripe says the old sub is unusable, create a fresh one.
      console.warn(
        `[Stripe] Unable to recover incomplete subscription:`,
        recoveryError?.message,
        `stripeSubscriptionId=${existingSubscription.stripe_subscription_id}`
      );
    }
  }

  // Create subscription with payment_behavior: default_incomplete
  // This gives us a PaymentIntent client_secret to confirm on frontend
  try {
    console.log(`[Stripe] Creating subscription: customer=${customerId}, price=${priceId}, org=${orgId}`);

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      trial_period_days: 14,
      metadata: { organization_id: orgId },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    });

    // For trials, we get a SetupIntent (no charge yet)
    // For immediate charges, we get a PaymentIntent
    const latestInvoice = subscription.latest_invoice as any;
    const setupIntent = subscription.pending_setup_intent as any;

    let clientSecret: string;
    let type: "setup" | "payment";

    if (setupIntent?.client_secret) {
      // Trial — needs card for future charges
      clientSecret = setupIntent.client_secret;
      type = "setup";
    } else if (latestInvoice?.payment_intent?.client_secret) {
      // Immediate payment
      clientSecret = latestInvoice.payment_intent.client_secret;
      type = "payment";
    } else {
      return NextResponse.json(
        { error: "Could not create subscription payment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret,
      type,
    });
  } catch (err: any) {
    // Hyperion-Vanguard S-05: NEVER log Stripe secret key (even prefix)
    console.error(`[Stripe] Subscription creation failed:`, err.message, `priceId=${priceId}`);
    return NextResponse.json(
      { error: err.message || "Stripe subscription creation failed" },
      { status: 500 }
    );
  }
}
