/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearAllCaches } from "./cache-utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type OrgMember = Database["public"]["Tables"]["organization_members"]["Row"];

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  currentMembership: OrgMember | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  setCurrentOrg: (org: Organization) => void;
  /** Full workspace switch: updates cookie, purges caches, sets membership. */
  switchOrg: (newOrgId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
  user: null,
  profile: null,
  organizations: [],
  currentOrg: null,
  currentMembership: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    const supabase = createClient();

    try {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ user: null, profile: null, loading: false, initialized: true });
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      // Get organizations the user belongs to
      const { data: memberships } = await (supabase as any)
        .from("organization_members")
        .select("*, organizations(*)")
        .eq("user_id", user.id)
        .eq("status", "active");

      // Deduplicate orgs by ID (prevents duplicate entries in switcher)
      const orgMap = new Map<string, Organization>();
      for (const m of (memberships || [])) {
        const org = m.organizations as Organization;
        if (org && org.id && !orgMap.has(org.id)) {
          orgMap.set(org.id, org);
        }
      }
      const orgs = Array.from(orgMap.values());

      // Determine which org to select:
      // Priority: 1) HTTP-only cookie (server truth) → 2) Zustand persisted → 3) first org
      const persistedOrg = get().currentOrg;
      let targetOrgId: string | null = null;

      // Try reading the active workspace cookie from the switch-context API
      try {
        const res = await fetch("/api/auth/switch-context", { cache: "no-store" });
        if (res.ok) {
          const cookie = await res.json();
          if (cookie.workspaceId && orgs.find((o) => o.id === cookie.workspaceId)) {
            targetOrgId = cookie.workspaceId;
          }
        }
      } catch {
        // Cookie read is non-fatal
      }

      // Fallback to persisted org if cookie didn't resolve
      if (!targetOrgId && persistedOrg?.id && orgs.find((o) => o.id === persistedOrg.id)) {
        targetOrgId = persistedOrg.id;
      }

      // Final fallback to first org
      if (!targetOrgId) {
        targetOrgId = orgs[0]?.id || null;
      }

      const selectedOrg = orgs.find((o) => o.id === targetOrgId) || orgs[0] || null;
      const selectedMembership = (memberships || []).find(
        (m: any) => m.organization_id === selectedOrg?.id
      ) as any;

      set({
        user,
        profile,
        organizations: orgs,
        currentOrg: selectedOrg,
        currentMembership: selectedMembership
          ? {
              organization_id: selectedMembership.organization_id,
              user_id: selectedMembership.user_id,
              role: selectedMembership.role,
              status: selectedMembership.status,
              branch: selectedMembership.branch,
              skills: selectedMembership.skills,
              hourly_rate: selectedMembership.hourly_rate,
              invited_by: selectedMembership.invited_by,
              joined_at: selectedMembership.joined_at,
              last_active_at: selectedMembership.last_active_at ?? null,
              role_id: selectedMembership.role_id ?? null,
            }
          : null,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      console.error("Auth store initialization failed:", error);
      set({ loading: false, initialized: true });
    }
  },

  setCurrentOrg: (org) => {
    set({ currentOrg: org });
  },

  switchOrg: async (newOrgId) => {
    const { user, organizations } = get();
    if (!user) return { ok: false, error: "Not authenticated" };

    // Check if already on this org
    if (get().currentOrg?.id === newOrgId) return { ok: true };

    try {
      // 1. Validate membership via API route (sets HTTP-only cookie)
      const res = await fetch("/api/auth/switch-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: newOrgId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.error ?? "Switch failed" };
      }

      // 2. Find the new org in the local store (fast path, no network)
      const targetOrg = organizations.find((o) => o.id === newOrgId) ?? null;

      // 3. Fetch the new membership record to update role
      const supabase = createClient();
      const { data: newMembership } = await (supabase as any)
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", newOrgId)
        .eq("status", "active")
        .maybeSingle();

      // 4. Update store with new context
      set({
        currentOrg: targetOrg,
        currentMembership: newMembership
          ? {
              organization_id: newMembership.organization_id,
              user_id: newMembership.user_id,
              role: newMembership.role,
              status: newMembership.status,
              branch: newMembership.branch,
              skills: newMembership.skills,
              hourly_rate: newMembership.hourly_rate,
              invited_by: newMembership.invited_by,
              joined_at: newMembership.joined_at,
              last_active_at: newMembership.last_active_at ?? null,
              role_id: newMembership.role_id ?? null,
            }
          : null,
      });

      // 5. Purge all module-level caches to prevent stale data bleed
      clearAllCaches();

      return { ok: true };
    } catch (err) {
      console.error("[switchOrg] error:", err);
      return { ok: false, error: "Unexpected error during workspace switch" };
    }
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) set({ profile });
  },

  refreshOrganizations: async () => {
    const { user } = get();
    if (!user) return;

    const supabase = createClient();
    const { data: memberships } = await (supabase as any)
      .from("organization_members")
      .select("*, organizations(*)")
      .eq("user_id", user.id)
      .eq("status", "active");

    // Deduplicate orgs by ID
    const orgMap = new Map<string, Organization>();
    for (const m of (memberships || [])) {
      const org = m.organizations as Organization;
      if (org && org.id && !orgMap.has(org.id)) {
        orgMap.set(org.id, org);
      }
    }
    const orgs = Array.from(orgMap.values());

    set({ organizations: orgs });

    // Update currentOrg if it no longer exists
    const { currentOrg } = get();
    if (currentOrg && !orgs.find((o: Organization) => o.id === currentOrg.id)) {
      set({ currentOrg: orgs[0] || null });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAllCaches();
    get().reset();
  },

  reset: () => {
    clearAllCaches();
    set({
      user: null,
      profile: null,
      organizations: [],
      currentOrg: null,
      currentMembership: null,
      loading: false,
      initialized: false,
    });
  },
    }),
    {
      name: "iworkr-auth",
      partialize: (state) => ({
        profile: state.profile,
        organizations: state.organizations,
        currentOrg: state.currentOrg,
        currentMembership: state.currentMembership,
      }),
    }
  )
);

// ── Project Aegis: Role Selectors ────────────────────────────
// Prefer membership role (authoritative, from DB).
// Fall back to JWT app_metadata.role for edge/middleware parity.

/** Returns the user's resolved role string. Safe to call outside React. */
export function getUserRole(): string {
  const state = useAuthStore.getState();
  const membershipRole = state.currentMembership?.role as string | undefined;
  if (membershipRole) return membershipRole;
  const jwtRole = state.user?.app_metadata?.role as string | undefined;
  return jwtRole ?? "technician";
}

/** React hook selector — use inside components: `useUserRole()` */
export function useUserRole(): string {
  return useAuthStore((s) => {
    const membershipRole = s.currentMembership?.role as string | undefined;
    if (membershipRole) return membershipRole;
    const jwtRole = s.user?.app_metadata?.role as string | undefined;
    return jwtRole ?? "technician";
  });
}
