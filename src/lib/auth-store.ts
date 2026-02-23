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

      const orgs = (memberships || [])
        .map((m: any) => m.organizations as Organization)
        .filter(Boolean);

      // Default to first org or null
      const firstOrg = orgs[0] || null;
      const firstMembership = (memberships || []).find(
        (m: any) => m.organization_id === firstOrg?.id
      ) as any;

      set({
        user,
        profile,
        organizations: orgs,
        currentOrg: firstOrg,
        currentMembership: firstMembership
          ? {
              organization_id: firstMembership.organization_id,
              user_id: firstMembership.user_id,
              role: firstMembership.role,
              status: firstMembership.status,
              branch: firstMembership.branch,
              skills: firstMembership.skills,
              hourly_rate: firstMembership.hourly_rate,
              invited_by: firstMembership.invited_by,
              joined_at: firstMembership.joined_at,
            }
          : null,
        loading: false,
        initialized: true,
      });
    } catch {
      set({ loading: false, initialized: true });
    }
  },

  setCurrentOrg: (org) => {
    set({ currentOrg: org });
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

    const orgs = (memberships || [])
      .map((m: any) => m.organizations as Organization)
      .filter(Boolean);

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
