import { NextResponse } from "next/server";

/**
 * Legacy Polar.sh checkout route — deprecated.
 * All checkout now goes through /checkout (self-hosted Stripe Checkout).
 * This redirect ensures any old links still work.
 */
export async function GET() {
  return NextResponse.redirect(new URL("/#pricing", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
