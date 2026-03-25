/**
 * @route POST /api/stripe/setup-intent
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Project Revenue-Net: Creates a Stripe SetupIntent for off-session
 *   payment method tokenization. Supports credit cards and AU BECS Direct Debit.
 * @lastAudit 2026-03-24
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { clientId, orgId, paymentMethodTypes } = body as {
    clientId: string;
    orgId: string;
    paymentMethodTypes?: string[];
  };

  if (!clientId || !orgId) {
    return NextResponse.json(
      { error: "Missing clientId or orgId" },
      { status: 400 }
    );
  }

  const { data: membership } = await supabaseAuth
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (supabase as any)
    .from("clients")
    .select("id, stripe_customer_id, display_name, email, phone")
    .eq("id", clientId)
    .eq("organization_id", orgId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const stripe = getStripe();
  const c = client as Record<string, unknown>;
  let stripeCustomerId = c.stripe_customer_id as string;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: (c.display_name as string) || undefined,
      email: (c.email as string) || undefined,
      phone: (c.phone as string) || undefined,
      metadata: {
        iworkr_client_id: clientId,
        iworkr_org_id: orgId,
      },
    });
    stripeCustomerId = customer.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("clients")
      .update({ stripe_customer_id: customer.id })
      .eq("id", clientId);
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: paymentMethodTypes || ["card", "au_becs_debit"],
      usage: "off_session",
      metadata: {
        mandate_flow: "revenue_net",
        client_id: clientId,
        organization_id: orgId,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      stripeCustomerId,
      setupIntentId: setupIntent.id,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[setup-intent] Stripe error:", e.message);
    return NextResponse.json(
      { error: e.message || "Failed to create SetupIntent" },
      { status: 500 }
    );
  }
}
