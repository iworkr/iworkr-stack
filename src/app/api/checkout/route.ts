/**
 * @route GET /api/checkout
 * @status COMPLETE
 * @auth PUBLIC — Redirect endpoint
 * @description Legacy Polar.sh checkout redirect to new pricing page
 * @lastAudit 2026-03-22
 */
import { NextResponse } from "next/server";

/**
 * Legacy Polar.sh checkout route — deprecated.
 * All checkout now goes through /checkout (self-hosted Stripe Checkout).
 * This redirect ensures any old links still work.
 */
export async function GET() {
  return NextResponse.redirect(new URL("/#pricing", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
