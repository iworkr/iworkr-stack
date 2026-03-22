/**
 * @route POST /api/webhook/polar
 * @status COMPLETE
 * @auth WEBHOOK — Deprecated, returns 200 unconditionally
 * @description Legacy Polar.sh webhook stub to prevent retry storms
 * @lastAudit 2026-03-22
 */
import { NextResponse } from "next/server";

/**
 * Legacy Polar.sh webhook route — deprecated.
 * All billing events are now handled by /api/stripe/webhook.
 * This endpoint returns 200 to prevent Polar retry storms if still configured.
 */
export async function POST() {
  console.log("[Polar Webhook] Deprecated — billing moved to Stripe. Returning 200.");
  return NextResponse.json({ received: true, deprecated: true });
}
