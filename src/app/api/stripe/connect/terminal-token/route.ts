/**
 * @route POST /api/stripe/connect/terminal-token
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Generates Stripe Terminal ConnectionToken for mobile tap-to-pay
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
