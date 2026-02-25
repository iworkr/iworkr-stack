/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
  });
}

/**
 * Creates a PaymentIntent on behalf of a connected Stripe account.
 * Used by both the public invoice page and the mobile Tap-to-Pay flow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { invoiceId, orgId, amountCents, currency } = body as {
    invoiceId?: string;
    orgId: string;
    amountCents: number;
    currency?: string;
  };

  if (!orgId || !amountCents) {
    return NextResponse.json({ error: "Missing orgId or amountCents" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("settings, name")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const stripeAccountId = settings.stripe_account_id as string | undefined;
  const chargesEnabled = settings.charges_enabled as boolean | undefined;

  if (!stripeAccountId || !chargesEnabled) {
    return NextResponse.json({ error: "Payments not enabled for this workspace" }, { status: 400 });
  }

  const stripe = getStripe();
  const feePercent = parseFloat((settings.platform_fee_percent as string) || "0") || 1.0;
  const applicationFee = Math.round(amountCents * (feePercent / 100));

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: currency || "usd",
      application_fee_amount: applicationFee,
      metadata: {
        organization_id: orgId,
        invoice_id: invoiceId || "",
      },
    },
    { stripeAccount: stripeAccountId }
  );

  await (supabase as any).from("payments").insert({
    organization_id: orgId,
    invoice_id: invoiceId || null,
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: amountCents,
    currency: currency || "usd",
    platform_fee_cents: applicationFee,
    status: "pending",
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    stripeAccountId,
    paymentIntentId: paymentIntent.id,
  });
}
