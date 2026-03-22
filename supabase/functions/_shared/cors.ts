/**
 * @module CORS — Centralized CORS Headers
 * @status COMPLETE
 * @description Project Hyperion-Vanguard: Eliminates wildcard CORS (*) across
 *   all 95 Edge Functions. Origin is restricted to the production domain by
 *   default, with env var override for staging/dev.
 * @lastAudit 2026-03-22
 */

/**
 * Production-safe CORS headers.
 * Set ALLOWED_ORIGIN env var for staging/dev environments.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":
    Deno.env.get("ALLOWED_ORIGIN") || "https://app.iworkr.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Returns a 204 No Content OPTIONS response for CORS preflight.
 */
export function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
