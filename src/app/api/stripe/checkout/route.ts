/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { priceId, orgId } = body as { priceId: string; orgId: string };

  if (!priceId || !orgId) {
    return NextResponse.json({ error: "Missing priceId or orgId" }, { status: 400 });
  }

  const stripe = getStripe();

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("id, name, settings")
    .eq("id", orgId)
    .single();

  if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const settings = (org.settings as Record<string, unknown>) ?? {};
  let customerId = (settings.stripe_customer_id as string) || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { organization_id: orgId, supabase_user_id: user.id },
    });
    customerId = customer.id;

    await (supabase as any)
      .from("organizations")
      .update({ settings: { ...settings, stripe_customer_id: customerId } })
      .eq("id", orgId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { organization_id: orgId },
    },
    metadata: { organization_id: orgId },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
