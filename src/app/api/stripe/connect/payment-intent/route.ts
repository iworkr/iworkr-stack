/**
 * @route POST /api/stripe/connect/payment-intent
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Creates a Stripe Connect payment intent for invoice payments
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  // ── Aegis-Zero: Session Gate ──
  const supabaseAuth = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Valid authentication session required." },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { invoiceId, orgId, amountCents, currency } = body as {
    invoiceId?: string;
    orgId: string;
    amountCents: number;
    currency?: string;
  };

  if (!orgId || !amountCents || !invoiceId) {
    return NextResponse.json({ error: "Missing orgId, invoiceId, or amountCents" }, { status: 400 });
  }

  // Verify the authenticated user belongs to this organization
  const { data: membership } = await supabaseAuth
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Forbidden", message: "Not a member of this organization." },
      { status: 403 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: invoice } = await (supabase as any)
    .from("invoices")
    .select("id, organization_id, total, status")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!["sent", "overdue", "viewed"].includes(invoice.status)) {
    return NextResponse.json({ error: "Invoice is not payable" }, { status: 400 });
  }

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

      // Zenith-Launch: Explicit destination charge with platform fee
      // Stripe splits the payment at the gateway level:
      //   - (amount - applicationFee) → merchant's connected account
      //   - applicationFee → iWorkr platform account
      // Hyperion-Vanguard D-01: Destination Charge — DO NOT pass stripeAccount
      // as the 2nd arg. Stripe Connect destination charges route funds via
      // transfer_data.destination. Passing stripeAccount simultaneously causes
      // the "double-account" API crash (invalid_request_error).
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: cur,
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: stripeAccountId,
        },
        automatic_payment_methods: { enabled: true },
        metadata: {
          organization_id: orgId,
          invoice_id: invoiceId || "",
          platform_fee_cents: applicationFee.toString(),
          platform_fee_percent: feePercent.toString(),
        },
      });

      const { error: paymentRecordError } = await (supabase as any).from("payments").insert({
        organization_id: orgId,
        invoice_id: invoiceId || null,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: amountCents,
        currency: cur,
        platform_fee_cents: applicationFee,
        status: "pending",
      });
      if (paymentRecordError) {
        console.error("[Stripe] Payment record insert failed:", paymentRecordError.message, { paymentIntentId: paymentIntent.id, orgId });
      }

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
