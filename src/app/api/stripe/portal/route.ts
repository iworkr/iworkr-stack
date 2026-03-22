/**
 * @route POST /api/stripe/portal
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org admin/owner role
 * @description Creates a Stripe Billing Portal session for payment management
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Billing Portal session so the customer can
 * manage payment methods, view invoices, and update billing info.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orgId } = body as { orgId: string };

  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
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

  // Get stripe_customer_id from the organizations table directly
  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found. Please subscribe to a plan first." }, { status: 404 });
  }

  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://iworkrapp.com"}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
