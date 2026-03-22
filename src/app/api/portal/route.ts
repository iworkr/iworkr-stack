/**
 * @route GET /api/portal
 * @status COMPLETE
 * @auth PUBLIC — Redirect endpoint
 * @description Legacy Polar.sh portal redirect to Stripe billing settings
 * @lastAudit 2026-03-22
 */
import { NextResponse } from "next/server";

/**
 * Legacy Polar.sh portal route — deprecated.
 * Billing management now goes through Stripe's billing portal.
 * See /api/stripe/portal instead.
 */
export async function GET() {
  return NextResponse.redirect(new URL("/settings/billing", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
