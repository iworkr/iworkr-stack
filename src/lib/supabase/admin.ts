/**
 * @module SupabaseAdmin
 * @status COMPLETE
 * @description Service-role Supabase client that bypasses RLS — super-admin only
 * @lastAudit 2026-03-22
 *
 * DANGER: This client operates with full database access, bypassing all
 * Row Level Security policies. Only use in Super Admin server actions
 * that have already verified the caller has is_super_admin === true.
 *
 * Never import this in client components or standard server actions.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

/**
 * Creates a Supabase client with the service_role key.
 * Bypasses all RLS policies — use with extreme caution.
 */
export function createAdminSupabaseClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
