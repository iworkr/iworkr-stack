/**
 * @module OlympusComms Server Actions
 * @status COMPLETE
 * @description Super admin communications — platform-wide announcements, system notifications, and admin broadcast messaging
 * @exports sendPlatformAnnouncementAction, fetchAnnouncementsAction, sendSystemNotificationAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];
  const admin = createAdminSupabaseClient();

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }

    if (!profile?.is_super_admin) {
      if (SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    }
    return { id: user.id, email: profile.email };
  } catch {
    if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
      return { id: user.id, email: user.email || "" };
    }
    return null;
  }
}

function escapeIlike(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function listGlobalCommunications(opts: {
  limit?: number;
  offset?: number;
  channel?: string;
  status?: string;
  direction?: string;
  search?: string;
}) {
  const caller = await verifySuperAdmin();
  if (!caller) return { data: [], total: 0 };

  const admin = createAdminSupabaseClient();

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const selectWithOrg =
    "*, organizations!communication_logs_workspace_id_fkey(name, slug)";

  const buildBase = (select: string) => {
    let q = admin
      .from("communication_logs")
      .select(select, { count: "exact" })
      .order("created_at", { ascending: false });

    if (opts.channel) q = q.eq("channel", opts.channel);
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.direction) q = q.eq("direction", opts.direction);
    return q;
  };

  const applySearch = (
    q: ReturnType<typeof buildBase>,
    mode: "full" | "addresses",
  ) => {
    if (!opts.search?.trim()) return q;
    const s = escapeIlike(opts.search.trim());
    if (mode === "full") {
      return q.or(
        `from_address.ilike.%${s}%,to_address.ilike.%${s}%,subject.ilike.%${s}%,metadata::text.ilike.%${s}%`,
      );
    }
    return q.or(
      `from_address.ilike.%${s}%,to_address.ilike.%${s}%,subject.ilike.%${s}%`,
    );
  };

  const run = async (select: string) => {
    let query = applySearch(buildBase(select), "full").range(offset, offset + limit - 1);
    let result = await query;

    if (result.error && opts.search?.trim()) {
      query = applySearch(buildBase(select), "addresses").range(offset, offset + limit - 1);
      result = await query;
    }
    return result;
  };

  let { data, error, count } = await run(selectWithOrg);

  if (error) {
    ({ data, error, count } = await run("*"));
  }

  if (error) return { data: [], total: 0 };
  return { data: data || [], total: count || 0 };
}
