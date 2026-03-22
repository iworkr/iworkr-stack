/**
 * @module SafeAction — Iron Gate Auth Wrapper
 * @status COMPLETE
 * @description Project Hyperion-Vanguard: Server action authentication wrapper.
 *   Enforces `supabase.auth.getUser()` on every server action call. If the
 *   caller has no valid session, the action throws immediately with 'Unauthorized'.
 * @exports withAuth
 * @lastAudit 2026-03-22
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Wraps a server action to enforce authentication.
 *
 * Usage:
 *   export async function myAction(orgId: string) {
 *     return withAuth(async (user) => {
 *       // user is guaranteed authenticated
 *       const supabase = await createServerSupabaseClient();
 *       // ... action logic
 *     });
 *   }
 *
 * @param action Function receiving the authenticated User
 * @returns The action's return value
 * @throws Error('Unauthorized: Active session required.') if no valid session
 */
export async function withAuth<T>(
  action: (user: User) => Promise<T>,
): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: Active session required.");
  }

  return action(user);
}

/**
 * Wraps a server action to enforce authentication AND org membership.
 *
 * Usage:
 *   export async function myAction(orgId: string) {
 *     return withAuthAndOrg(orgId, async (user) => {
 *       // user is authenticated AND confirmed member of orgId
 *       // ... action logic
 *     });
 *   }
 */
export async function withAuthAndOrg<T>(
  orgId: string,
  action: (user: User) => Promise<T>,
): Promise<T> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized: Active session required.");
  }

  // Verify org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    throw new Error("Forbidden: Not a member of this organization.");
  }

  return action(user);
}
