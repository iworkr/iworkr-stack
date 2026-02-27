/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getOrganization,
  updateOrganization,
  updateOrgSettings,
  getProfile,
  updateProfile,
  updateProfilePreferences,
  updateNotificationPreferences,
} from "@/app/actions/settings";

/* ── Types ───────────────────────────────────────────────── */

export interface OrgSettings {
  tax_id?: string;
  timezone?: string;
  currency?: string;
  date_format?: string;
  default_tax_rate?: number;
  fiscal_year_start?: number;
  default_payment_terms?: number;
  default_job_duration_mins?: number;
  travel_buffer_mins?: number;
  branches?: string[];
  address?: string;
  address_lat?: number;
  address_lng?: number;
  [key: string]: any;
}

export interface UserPreferences {
  theme?: "system" | "dark" | "light";
  home_view?: string;
  display_names?: string;
  first_day_of_week?: string;
  font_size?: string;
  emoticons?: boolean;
  pointer_cursors?: boolean;
  notification_badge?: string;
  spell_check?: boolean;
  auto_assign?: boolean;
  move_started?: boolean;
  assign_started?: boolean;
  [key: string]: any;
}

export interface NotificationPrefs {
  push_jobs?: boolean;
  push_inbox?: boolean;
  push_schedule?: boolean;
  email_digest?: boolean;
  email_job_assigned?: boolean;
  email_job_completed?: boolean;
  email_mentions?: boolean;
  push_mentions?: boolean;
  [key: string]: any;
}

interface SettingsState {
  // Organization data
  orgId: string | null;
  orgName: string;
  orgSlug: string;
  orgLogoUrl: string;
  orgTrade: string;
  orgSettings: OrgSettings;

  // Profile data
  userId: string | null;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  userTimezone: string;
  preferences: UserPreferences;
  notificationPrefs: NotificationPrefs;

  // UI state
  loading: boolean;
  saving: boolean;
  lastSaved: number | null;
  error: string | null;

  // Actions
  loadSettings: (orgId: string, userId: string) => Promise<void>;
  updateOrgField: (field: string, value: any) => Promise<void>;
  updateOrgSettingsField: (key: string, value: any) => Promise<void>;
  updateOrgSettingsBatch: (updates: Record<string, any>) => Promise<void>;
  updateProfileField: (field: string, value: any) => Promise<void>;
  updatePreference: (key: string, value: any) => Promise<void>;
  updateNotificationPref: (key: string, value: any) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      orgId: null,
      orgName: "",
      orgSlug: "",
      orgLogoUrl: "",
      orgTrade: "",
      orgSettings: {},
      userId: null,
      fullName: "",
      email: "",
      phone: "",
      avatarUrl: "",
      userTimezone: "Australia/Brisbane",
      preferences: {},
      notificationPrefs: {},
      loading: false,
      saving: false,
      lastSaved: null,
      error: null,

      loadSettings: async (orgId: string, userId: string) => {
        set({ loading: true, error: null, orgId, userId });

        const [orgResult, profileResult] = await Promise.all([
          getOrganization(orgId),
          getProfile(userId),
        ]);

        if (orgResult.error || profileResult.error) {
          set({ loading: false, error: orgResult.error || profileResult.error || "Load failed" });
          return;
        }

        const org = orgResult.data;
        const profile = profileResult.data;

        set({
          orgName: org?.name || "",
          orgSlug: org?.slug || "",
          orgLogoUrl: org?.logo_url || "",
          orgTrade: org?.trade || "",
          orgSettings: (org?.settings || {}) as OrgSettings,
          fullName: profile?.full_name || "",
          email: profile?.email || "",
          phone: profile?.phone || "",
          avatarUrl: profile?.avatar_url || "",
          userTimezone: profile?.timezone || "Australia/Brisbane",
          preferences: (profile?.preferences || {}) as UserPreferences,
          notificationPrefs: (profile?.notification_preferences || {}) as NotificationPrefs,
          loading: false,
        });
      },

      updateOrgField: async (field: string, value: any) => {
        const { orgId } = get();
        if (!orgId) return;

        // Optimistic update
        set({ saving: true, [field === "name" ? "orgName" : field === "slug" ? "orgSlug" : field === "logo_url" ? "orgLogoUrl" : field === "trade" ? "orgTrade" : field]: value });

        const result = await updateOrganization(orgId, { [field]: value });

        if (result.error) {
          set({ error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },

      updateOrgSettingsField: async (key: string, value: any) => {
        const { orgId, orgSettings } = get();
        if (!orgId) return;

        // Optimistic update
        set({ saving: true, orgSettings: { ...orgSettings, [key]: value } });

        const result = await updateOrgSettings(orgId, { [key]: value });

        if (result.error) {
          set({ orgSettings, error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },

      updateOrgSettingsBatch: async (updates: Record<string, any>) => {
        const { orgId, orgSettings } = get();
        if (!orgId) return;

        set({ saving: true, orgSettings: { ...orgSettings, ...updates } });

        const result = await updateOrgSettings(orgId, updates);

        if (result.error) {
          set({ orgSettings, error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },

      updateProfileField: async (field: string, value: any) => {
        const { userId } = get();
        if (!userId) return;

        const fieldMap: Record<string, string> = {
          full_name: "fullName",
          phone: "phone",
          avatar_url: "avatarUrl",
          timezone: "userTimezone",
        };

        set({ saving: true, [fieldMap[field] || field]: value });

        const result = await updateProfile(userId, { [field]: value });

        if (result.error) {
          set({ error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },

      updatePreference: async (key: string, value: any) => {
        const { userId, preferences } = get();
        if (!userId) return;

        set({ saving: true, preferences: { ...preferences, [key]: value } });

        const result = await updateProfilePreferences(userId, { [key]: value });

        if (result.error) {
          set({ preferences, error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },

      updateNotificationPref: async (key: string, value: any) => {
        const { userId, notificationPrefs } = get();
        if (!userId) return;

        set({ saving: true, notificationPrefs: { ...notificationPrefs, [key]: value } });

        const result = await updateNotificationPreferences(userId, { [key]: value });

        if (result.error) {
          set({ notificationPrefs, error: result.error, saving: false });
          return;
        }

        set({ saving: false, lastSaved: Date.now(), error: null });
      },
    }),
    {
      name: "iworkr-settings",
      partialize: (state) => ({
        orgId: state.orgId,
        orgName: state.orgName,
        orgSlug: state.orgSlug,
        orgLogoUrl: state.orgLogoUrl,
        orgTrade: state.orgTrade,
        orgSettings: state.orgSettings,
        userId: state.userId,
        fullName: state.fullName,
        email: state.email,
        phone: state.phone,
        avatarUrl: state.avatarUrl,
        userTimezone: state.userTimezone,
        preferences: state.preferences,
        notificationPrefs: state.notificationPrefs,
      }),
    }
  )
);
