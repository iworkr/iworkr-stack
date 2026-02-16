"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface OrgData {
  orgId: string | null;
  userId: string | null;
  loading: boolean;
}

let cachedOrg: { orgId: string; userId: string } | null = null;

export function useOrg(): OrgData {
  const [state, setState] = useState<OrgData>({
    orgId: cachedOrg?.orgId ?? null,
    userId: cachedOrg?.userId ?? null,
    loading: !cachedOrg,
  });

  useEffect(() => {
    if (cachedOrg) return;

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
        .eq("status", "active")
        .limit(1)
        .single();

      const orgId = membership?.organization_id ?? null;
      if (orgId) {
        cachedOrg = { orgId, userId: user.id };
      }
      setState({ orgId, userId: user.id, loading: false });
    }

    load();
  }, []);

  return state;
}

export function clearOrgCache() {
  cachedOrg = null;
}
