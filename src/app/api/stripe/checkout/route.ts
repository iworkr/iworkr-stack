/**
 * @route POST /api/stripe/checkout
 * @status COMPLETE
 * @auth PUBLIC — Legacy redirect endpoint
 * @description Legacy Stripe Checkout redirect to self-hosted checkout page
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy Stripe Checkout Session route — deprecated.
 * All checkout now goes through /checkout (self-hosted Stripe Elements).
 * Redirects to the new checkout page.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { priceId, orgId } = body as { priceId?: string; orgId?: string };

    // Redirect to self-hosted checkout
    const url = new URL("/checkout", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    if (priceId) url.searchParams.set("priceId", priceId);
    if (orgId) url.searchParams.set("orgId", orgId);

    return NextResponse.json({ url: url.toString() });
  } catch {
    return NextResponse.json({ url: "/checkout" });
  }
}
