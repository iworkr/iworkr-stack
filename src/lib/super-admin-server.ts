/**
 * @module lib/super-admin-server
 * @status STABLE
 * @description Server-only: resolves current user as super admin via `profiles.is_super_admin` with `isSuperAdminEmail` bootstrap fallback.
 * @lastReview 2026-03-28
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";

export type SuperAdminUser = { id: string; email: string };

/**
 * Returns the authenticated user if they are a super admin (DB flag or bootstrap email allowlist).
 * Does not throw — returns null on any failure or unauthorized user.
 */
export async function verifySuperAdminServer(): Promise<SuperAdminUser | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminSupabaseClient();

    try {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, email, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (isSuperAdminEmail(user.email)) {
          return { id: user.id, email: user.email || "" };
        }
        return null;
      }

      if (profile?.is_super_admin || isSuperAdminEmail(profile?.email || user.email)) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    } catch {
      if (isSuperAdminEmail(user.email)) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }
  } catch {
    return null;
  }
}
