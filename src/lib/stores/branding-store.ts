/**
 * @store BrandingStore
 * @status COMPLETE
 * @description Workspace branding state — colors, logos, portal theme, and Supabase persistence
 * @resetSafe YES — Has reset() method for workspace switching
 * @lastAudit 2026-03-22
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

export interface WorkspaceBranding {
  id: string;
  workspace_id: string;
  primary_color_hex: string;
  text_on_primary_hex: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  custom_email_domain: string | null;
  resend_domain_id: string | null;
  dns_status: "unconfigured" | "pending" | "verified" | "failed";
  dns_records: DnsRecord[];
  updated_at: string;
  // Project Chameleon — White-Label fields
  app_name: string | null;
  app_icon_url: string | null;
  accent_color_hex: string | null;
  build_status: "none" | "queued" | "building" | "deployed" | "awaiting_store_review" | "failed";
  build_log_url: string | null;
  enterprise_bundle_id: string | null;
  last_build_at: string | null;
  build_requested_by: string | null;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  status?: string;
}

interface BrandingState {
  branding: WorkspaceBranding | null;
  loading: boolean;
  error: string | null;
  _lastFetchedAt: number | null;

  loadFromServer: (orgId: string) => Promise<void>;
  forceRefresh: (orgId: string) => Promise<void>;
  updateBranding: (orgId: string, updates: Partial<WorkspaceBranding>) => Promise<{ error?: string }>;
  updateColor: (orgId: string, hex: string) => Promise<{ error?: string }>;
  uploadLogo: (orgId: string, file: File, variant: "light" | "dark") => Promise<{ url?: string; error?: string }>;
  reset: () => void;
}

const FRESHNESS_MS = 60_000; // 60s SWR — but invalidated on writes

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set, get) => ({
      branding: null,
      loading: false,
      error: null,
      _lastFetchedAt: null,

      loadFromServer: async (orgId: string) => {
        const now = Date.now();
        const lastFetch = get()._lastFetchedAt;
        if (lastFetch && now - lastFetch < FRESHNESS_MS) return;

        set({ loading: true, error: null });

        try {
          const supabase = createClient();
          const { data, error } = await (supabase as any)
            .from("workspace_branding")
            .select("*")
            .eq("workspace_id", orgId)
            .maybeSingle();

          if (error) {
            set({ loading: false, error: error.message });
            return;
          }

          set({
            branding: data || null,
            loading: false,
            _lastFetchedAt: now,
          });
        } catch (err: any) {
          set({ loading: false, error: err.message || "Failed to load branding" });
        }
      },

      forceRefresh: async (orgId: string) => {
        // Bypass SWR — always fetch fresh from server
        set({ _lastFetchedAt: null });
        return get().loadFromServer(orgId);
      },

      updateBranding: async (orgId: string, updates: Partial<WorkspaceBranding>) => {
        try {
          const supabase = createClient();
          const { data, error } = await (supabase as any)
            .from("workspace_branding")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("workspace_id", orgId)
            .select()
            .single();

          if (error) return { error: error.message };

          set({ branding: data, _lastFetchedAt: Date.now() });
          return {};
        } catch (err: any) {
          return { error: err.message || "Update failed" };
        }
      },

      updateColor: async (orgId: string, hex: string) => {
        // Validate hex
        const clean = hex.replace("#", "");
        if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
          return { error: "Invalid hex color code" };
        }

        const normalizedHex = `#${clean.toUpperCase()}`;

        // Calculate contrast text color locally (YIQ formula)
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = yiq >= 128 ? "#000000" : "#FFFFFF";

        return get().updateBranding(orgId, {
          primary_color_hex: normalizedHex,
          text_on_primary_hex: textColor,
        });
      },

      uploadLogo: async (orgId: string, file: File, variant: "light" | "dark") => {
        try {
          const supabase = createClient();

          // Generate unique filename
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";
          const allowedExts = ["png", "jpg", "jpeg", "webp", "svg"];
          if (!allowedExts.includes(ext)) {
            return { error: "Unsupported file type. Use PNG, JPG, WebP, or SVG." };
          }

          // Max 5MB
          if (file.size > 5 * 1024 * 1024) {
            return { error: "Logo must be under 5MB" };
          }

          const path = `${orgId}/logo-${variant}-${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("brand-assets")
            .upload(path, file, { upsert: true, contentType: file.type });

          if (uploadError) return { error: uploadError.message };

          const { data: urlData } = supabase.storage
            .from("brand-assets")
            .getPublicUrl(path);

          const url = urlData?.publicUrl;
          if (!url) return { error: "Failed to get public URL" };

          // Update branding record
          const fieldName = variant === "light" ? "logo_light_url" : "logo_dark_url";
          const result = await get().updateBranding(orgId, { [fieldName]: url } as any);

          if (result.error) return { error: result.error };
          return { url };
        } catch (err: any) {
          return { error: err.message || "Upload failed" };
        }
      },

      reset: () => {
        set({
          branding: null,
          loading: false,
          error: null,
          _lastFetchedAt: null,
        });
      },
    }),
    {
      name: "iworkr-branding",
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        try {
          const state = (persisted ?? {}) as Record<string, unknown>;

          if (version < 2) {
            // v0/v1 → v2: Ensure the branding field is either a valid object or null.
            // Protects against corrupted localStorage where branding is a string,
            // number, or partially-constructed object.
            const branding = state.branding;
            const isValidBranding =
              branding !== null &&
              branding !== undefined &&
              typeof branding === "object" &&
              !Array.isArray(branding);

            return {
              branding: isValidBranding ? branding : null,
            };
          }

          return persisted;
        } catch {
          console.warn("[branding-store] Migration failed, resetting to defaults");
          return undefined;
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.branding?.workspace_id) {
          console.debug("[branding-store] Rehydrated from cache for workspace:", state.branding.workspace_id);
        }
      },
      partialize: (state) => ({
        branding: state.branding,
      }),
    }
  )
);
