/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

/**
 * Creates a PaymentIntent for invoice payments.
 * Supports both Stripe Connect (connected accounts) and direct charges.
 * Public endpoint — uses anon key since callers may not be authenticated.
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("settings, name")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const stripeAccountId = settings.stripe_account_id as string | undefined;
  const chargesEnabled = settings.charges_enabled as boolean | undefined;

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e: any) {
    console.error("[payment-intent]", e.message);
    return NextResponse.json({ error: "Payment processing not configured" }, { status: 500 });
  }

  const cur = currency || "aud";

  try {
    if (stripeAccountId && chargesEnabled) {
      const feePercent = parseFloat((settings.platform_fee_percent as string) || "0") || 1.0;
      const applicationFee = Math.round(amountCents * (feePercent / 100));

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: cur,
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
        currency: cur,
        platform_fee_cents: applicationFee,
        status: "pending",
      }).then(() => {}).catch(() => {});

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        stripeAccountId,
        paymentIntentId: paymentIntent.id,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: cur,
      automatic_payment_methods: { enabled: true },
      metadata: {
        organization_id: orgId,
        invoice_id: invoiceId || "",
      },
    });

    await (supabase as any).from("payments").insert({
      organization_id: orgId,
      invoice_id: invoiceId || null,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      currency: cur,
      platform_fee_cents: 0,
      status: "pending",
    }).then(() => {}).catch(() => {});

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      stripeAccountId: "",
      paymentIntentId: paymentIntent.id,
    });
  } catch (e: any) {
    console.error("[payment-intent] Stripe error:", e.message || e);
    return NextResponse.json(
      { error: e.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
