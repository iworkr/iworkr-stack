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
    return NextResponse.json({ error: "Only owners and admins can setup payments" }, { status: 403 });
  }

  const stripe = getStripe();

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("id, name, settings")
    .eq("id", orgId)
    .single();

  if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const settings = (org.settings as Record<string, unknown>) ?? {};
  let accountId = (settings.stripe_account_id as string) || null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { organization_id: orgId },
      business_profile: {
        name: org.name || undefined,
      },
    });
    accountId = account.id;

    await (supabase as any)
      .from("organizations")
      .update({ settings: { ...settings, stripe_account_id: accountId } })
      .eq("id", orgId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/finance?setup=refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/finance?setup=success`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
