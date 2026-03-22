/**
 * @hook useOrg
 * @status COMPLETE
 * @description Core org context hook — resolves orgId, userId, role, and membership
 * @lastAudit 2026-03-22
 */
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
 *   1. Auth store cache (rehydrated from localStorage) — always authoritative
 *   2. Module-level cache (fallback for first paint before store hydrates)
 *   3. Supabase network call (slow — only on cold start)
 *
 * The module cache auto-invalidates when the auth store's currentOrg changes
 * (e.g. workspace switch), fixing the old "sticky cache" bug.
 */
export function useOrg(): OrgData {
  // Auth store — always the source of truth
  const authOrg = useAuthStore((s) => s.currentOrg);
  const authUser = useAuthStore((s) => s.user);
  const authProfile = useAuthStore((s) => s.profile);

  // Best available cached orgId: auth store > module cache
  const authOrgId = authOrg?.id ?? null;
  const authUserId = authUser?.id ?? authProfile?.id ?? null;
  const cachedOrgId = authOrgId ?? cachedOrg?.orgId ?? null;
  const cachedUserId = authUserId ?? cachedOrg?.userId ?? null;

  const [state, setState] = useState<OrgData>({
    orgId: cachedOrgId,
    userId: cachedUserId,
    loading: !cachedOrgId,
  });

  // Keep state + module cache in sync when auth store updates
  // This is the critical fix: when org changes (workspace switch), the module
  // cache is updated immediately so all DataProvider consumers see the new orgId.
  useEffect(() => {
    const orgId = authOrg?.id ?? null;
    const userId = authUser?.id ?? authProfile?.id ?? null;

    if (orgId && userId) {
      // Always update module cache to match auth store (auth store wins)
      cachedOrg = { orgId, userId };
      setState((prev) => {
        if (prev.orgId === orgId && prev.userId === userId && !prev.loading) return prev;
        return { orgId, userId, loading: false };
      });
    } else if (cachedOrg) {
      // Auth store has data → keep module cache, just ensure loading=false
      setState((prev) => {
        if (prev.orgId === cachedOrg!.orgId && prev.userId === cachedOrg!.userId && !prev.loading) return prev;
        return { orgId: cachedOrg!.orgId, userId: cachedOrg!.userId, loading: false };
      });
    }
  }, [authOrg?.id, authUser?.id, authProfile?.id]);

  // Network fallback: only fires if we have no cached orgId at all
  useEffect(() => {
    if (cachedOrg) return;
    if (authOrg?.id) return; // auth store already provided it

    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
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

      if (cancelled) return;
      const orgId = membership?.organization_id ?? null;
      if (orgId) {
        cachedOrg = { orgId, userId: user.id };
      }
      setState({ orgId, userId: user.id, loading: false });
    }

    load();
    return () => { cancelled = true; };
  }, [authOrg?.id]);

  return state;
}

export function clearOrgCache() {
  cachedOrg = null;
}
