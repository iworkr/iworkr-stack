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

  const { orgId } = (await req.json()) as { orgId: string };
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();

  const stripeAccountId = (org?.settings as Record<string, unknown>)?.stripe_account_id as string | undefined;

  if (!stripeAccountId) {
    return NextResponse.json({ error: "Payments not set up" }, { status: 404 });
  }

  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(stripeAccountId);

  return NextResponse.json({ url: link.url });
}
