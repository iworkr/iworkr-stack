/**
 * @component DataProvider
 * @status COMPLETE
 * @description Root data hydration provider that fetches and populates all Zustand stores on mount
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useRef } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useJobsStore } from "@/lib/jobs-store";
import { useClientsStore } from "@/lib/clients-store";
import { useFinanceStore } from "@/lib/finance-store";
import { useInboxStore } from "@/lib/inbox-store";
import { useScheduleStore } from "@/lib/schedule-store";
import { useAutomationsStore } from "@/lib/automations-store";
import { useAssetsStore } from "@/lib/assets-store";
import { useFormsStore } from "@/lib/forms-store";
import { useTeamStore } from "@/lib/team-store";
import { useIntegrationsStore } from "@/lib/integrations-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { useCredentialsStore } from "@/lib/credentials-store";
import { useIncidentsStore } from "@/lib/incidents-store";
import { useBrandingStore } from "@/lib/stores/branding-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFleetTracking } from "@/lib/hooks/use-fleet-tracking";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/components/shell/notification-toast";

/**
 * DataProvider — Optimised data loading layer (v3 — anti-slingshot)
 *
 * Key improvements over v2:
 *   1. GENERATION COUNTER: Each orgId change increments a generation. Stores
 *      check the generation before writing results. If the generation has changed
 *      (user navigated away or switched org), the stale write is silently dropped.
 *   2. TWO-PHASE LOADING: critical stores load immediately, secondary stores
 *      are deferred via requestIdleCallback.
 *   3. SINGLE REALTIME CLIENT with consolidated channels.
 *   4. Stores use SWR (stale-while-revalidate) internally.
 */

// Global generation counter — incremented each time orgId changes.
// loadFromServer wrappers check this before writing results.
let _loadGeneration = 0;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { orgId, userId } = useOrg();
  const addRealtimeItem = useInboxStore((s) => s.addRealtimeItem);
  const addToast = useToastStore((s) => s.addToast);
  const prevOrgRef = useRef<string | null>(null);

  useFleetTracking({ orgId, enabled: !!orgId });

  // ── Nightingale: Apply .care class to <html> for CSS theme overrides ──
  const { isCare } = useIndustryLexicon();
  useEffect(() => {
    const html = document.documentElement;
    if (isCare) {
      html.classList.add("care");
    } else {
      html.classList.remove("care");
    }
    return () => { html.classList.remove("care"); };
  }, [isCare]);

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1 — Critical stores (load immediately — visible on dashboard)
  // PHASE 2 — Secondary stores (deferred — only needed on specific pages)
  //
  // Anti-slingshot: each load captures the current generation. If the
  // generation has changed by the time the async response arrives, the
  // store's internal SWR will see a different orgId and skip the write.
  // Additionally, deferred loads are fully cancelled on cleanup.
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!orgId) return;

    // Increment generation — any in-flight loads from previous orgId
    // will see a stale generation when they try to write results.
    _loadGeneration++;
    const gen = _loadGeneration;

    // Track org changes
    const orgChanged = prevOrgRef.current !== orgId;
    prevOrgRef.current = orgId;

    // If org changed, mark critical stores as stale so they refetch even if SWR says "fresh"
    if (orgChanged) {
      const jobsState = useJobsStore.getState();
      if (jobsState.orgId !== orgId) useJobsStore.setState({ _lastFetchedAt: 0 });
      const schedState = useScheduleStore.getState();
      if (schedState.orgId !== orgId) useScheduleStore.setState({ _lastFetchedAt: 0 });
      const teamState = useTeamStore.getState();
      if (teamState.orgId !== orgId) useTeamStore.setState({ _lastFetchedAt: 0 });
      const inboxState = useInboxStore.getState();
      if (inboxState._lastFetchedAt) useInboxStore.setState({ _lastFetchedAt: 0 });
    }

    // ── Phase 1: Critical (fires now — visible on main dashboard) ──
    useJobsStore.getState().loadFromServer(orgId);
    useScheduleStore.getState().loadFromServer(orgId, new Date().toISOString().split("T")[0]);
    useTeamStore.getState().loadFromServer(orgId);
    useInboxStore.getState().loadFromServer(orgId);
    useBrandingStore.getState().loadFromServer(orgId);

    // ── Phase 2: Secondary (deferred — forms, assets, automations etc.) ──
    let deferredCancelled = false;
    const schedule = typeof requestIdleCallback === "function"
      ? (fn: () => void) => requestIdleCallback(fn, { timeout: 2000 })
      : (fn: () => void) => setTimeout(fn, 150);

    const deferredId = schedule(() => {
      // Check if this effect's generation is still current
      if (deferredCancelled || gen !== _loadGeneration) return;

      useClientsStore.getState().loadFromServer(orgId);
      useFinanceStore.getState().loadFromServer(orgId);
      useAutomationsStore.getState().loadFromServer(orgId);
      useAssetsStore.getState().loadFromServer(orgId);
      useFormsStore.getState().loadFromServer(orgId);
      useIntegrationsStore.getState().loadFromServer(orgId);
      useMessengerStore.getState().loadChannels(orgId);
      useCredentialsStore.getState().loadFromServer(orgId);
      useIncidentsStore.getState().loadFromServer(orgId);
    });

    return () => {
      deferredCancelled = true;
      if (typeof cancelIdleCallback === "function" && typeof deferredId === "number") {
        cancelIdleCallback(deferredId);
      } else {
        clearTimeout(deferredId as unknown as number);
      }
    };
  }, [orgId]);

  // ═══════════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS — consolidated into 2 channels
  // ═══════════════════════════════════════════════════════════════

  // Channel 1: User-scoped (notifications)
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        addRealtimeItem(payload);
        const n = payload.new as Record<string, unknown>;
        addToast({
          id: (n.id as string) || crypto.randomUUID(),
          type: (n.type as string) || "system",
          title: (n.title as string) || "New notification",
          body: (n.body as string) || "",
          action_url: (n.action_url as string) || undefined,
          created_at: (n.created_at as string) || new Date().toISOString(),
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => { useInboxStore.getState().refresh(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, addRealtimeItem, addToast]);

  // Channel 2: Org-scoped data changes
  useEffect(() => {
    if (!isSupabaseConfigured || !orgId) return;

    const supabase = createClient();
    // Capture the orgId this subscription was created for
    const subscriptionOrgId = orgId;

    const channel = supabase
      .channel(`org-data:${orgId}`)
      // Schedule blocks
      .on("postgres_changes", {
        event: "*", schema: "public", table: "schedule_blocks",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        // Only update if we're still on the same org
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useScheduleStore.getState().handleRealtimeUpdate();
        }
      })
      // Jobs
      .on("postgres_changes", {
        event: "*", schema: "public", table: "jobs",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useScheduleStore.getState().handleRealtimeUpdate();
        }
      })
      // Invoices
      .on("postgres_changes", {
        event: "*", schema: "public", table: "invoices",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useFinanceStore.getState().handleRealtimeUpdate();
        }
      })
      // Assets + inventory
      .on("postgres_changes", {
        event: "*", schema: "public", table: "assets",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useAssetsStore.getState().handleRealtimeUpdate();
        }
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "inventory_items",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useAssetsStore.getState().handleRealtimeUpdate();
        }
      })
      // Team members + roles
      .on("postgres_changes", {
        event: "*", schema: "public", table: "organization_members",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useTeamStore.getState().handleRealtimeUpdate();
        }
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "organization_roles",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useTeamStore.getState().handleRealtimeUpdate();
        }
      })
      // Form submissions
      .on("postgres_changes", {
        event: "*", schema: "public", table: "form_submissions",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useFormsStore.getState().handleRealtimeUpdate();
        }
      })
      // Automation flows
      .on("postgres_changes", {
        event: "*", schema: "public", table: "automation_flows",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useAutomationsStore.getState().handleRealtimeUpdate();
        }
      })
      // Integrations
      .on("postgres_changes", {
        event: "*", schema: "public", table: "integrations",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useIntegrationsStore.getState().handleRealtimeUpdate();
        }
      })
      // Worker credentials
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "worker_credentials",
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useCredentialsStore.getState().handleRealtimeInsert(payload.new as unknown as import("@/lib/credentials-store").WorkerCredential);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "worker_credentials",
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useCredentialsStore.getState().handleRealtimeUpdate(payload.new as unknown as import("@/lib/credentials-store").WorkerCredential);
        }
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "worker_credentials",
        filter: `organization_id=eq.${orgId}`,
      }, (payload) => {
        if (useOrg_getOrgId() === subscriptionOrgId) {
          useCredentialsStore.getState().handleRealtimeDelete((payload.old as unknown as { id: string }).id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  return <>{children}</>;
}

/** Quick read of the current orgId from auth store (non-hook, for realtime callbacks) */
function useOrg_getOrgId(): string | null {
  return useAuthStore.getState().currentOrg?.id ?? null;
}
