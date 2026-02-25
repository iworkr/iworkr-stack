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
 * Generates a Stripe Terminal ConnectionToken for the mobile Tap-to-Pay flow.
 * Called by Flutter to initialize the Stripe Terminal SDK.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = (await req.json()) as { orgId: string };
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const stripeAccountId = settings.stripe_account_id as string | undefined;
  const chargesEnabled = settings.charges_enabled as boolean | undefined;

  if (!stripeAccountId || !chargesEnabled) {
    return NextResponse.json({ error: "Payments not enabled" }, { status: 400 });
  }

  const stripe = getStripe();
  const token = await stripe.terminal.connectionTokens.create(
    {},
    { stripeAccount: stripeAccountId }
  );

  return NextResponse.json({ secret: token.secret });
}
