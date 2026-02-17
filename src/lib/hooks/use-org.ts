"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";

interface OrgData {
  orgId: string | null;
  userId: string | null;
  loading: boolean;
}

let cachedOrg: { orgId: string; userId: string } | null = null;

/**
 * Returns the current user's orgId and userId.
 *
 * Priority chain (fast → slow):
 *   1. Module-level cache (instant — set on first successful load)
 *   2. Auth store cache (instant — rehydrated from localStorage)
 *   3. Supabase network call (slow — only on cold start)
 *
 * This means returning users get orgId in <1ms instead of 500ms–2s.
 */
export function useOrg(): OrgData {
  // Try auth store cache (rehydrated from localStorage) for instant orgId
  const authOrg = useAuthStore((s) => s.currentOrg);
  const authUser = useAuthStore((s) => s.user);
  const authProfile = useAuthStore((s) => s.profile);

  // Best available cached orgId: module cache > auth store
  const cachedOrgId = cachedOrg?.orgId ?? authOrg?.id ?? null;
  const cachedUserId = cachedOrg?.userId ?? authUser?.id ?? authProfile?.id ?? null;

  const [state, setState] = useState<OrgData>({
    orgId: cachedOrgId,
    userId: cachedUserId,
    loading: !cachedOrgId,
  });

  // Keep state in sync if auth store updates (e.g. after full initialize)
  useEffect(() => {
    if (cachedOrg) return; // module cache is authoritative
    const orgId = authOrg?.id ?? null;
    const userId = authUser?.id ?? authProfile?.id ?? null;
    if (orgId && userId) {
      cachedOrg = { orgId, userId };
      setState({ orgId, userId, loading: false });
    }
  }, [authOrg?.id, authUser?.id, authProfile?.id]);

  // Network fallback: only fires if we have no cached orgId at all
  useEffect(() => {
    if (cachedOrg) return;
    if (authOrg?.id) return; // auth store already provided it

    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ orgId: null, userId: null, loading: false });
        return;
      }

      const { data: membership } = await (supabase as any)
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const orgId = membership?.organization_id ?? null;
      if (orgId) {
        cachedOrg = { orgId, userId: user.id };
      }
      setState({ orgId, userId: user.id, loading: false });
    }

    load();
  }, [authOrg?.id]);

  return state;
}

export function clearOrgCache() {
  cachedOrg = null;
}
