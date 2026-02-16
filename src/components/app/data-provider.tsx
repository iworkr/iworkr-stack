"use client";

import { useEffect } from "react";
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
import { createClient } from "@/lib/supabase/client";

/**
 * Loads data from Supabase into Zustand stores when the user is authenticated.
 * Also manages Realtime subscriptions for live notifications.
 * Place this inside the dashboard layout to trigger on mount.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { orgId, userId, loading: orgLoading } = useOrg();

  const loadJobs = useJobsStore((s) => s.loadFromServer);
  const jobsLoaded = useJobsStore((s) => s.loaded);

  const loadClients = useClientsStore((s) => s.loadFromServer);
  const clientsLoaded = useClientsStore((s) => s.loaded);

  const loadFinance = useFinanceStore((s) => s.loadFromServer);
  const financeLoaded = useFinanceStore((s) => s.loaded);

  const loadInbox = useInboxStore((s) => s.loadFromServer);
  const inboxLoaded = useInboxStore((s) => s.loaded);

  const loadSchedule = useScheduleStore((s) => s.loadFromServer);
  const scheduleLoaded = useScheduleStore((s) => s.loaded);

  const loadAutomations = useAutomationsStore((s) => s.loadFromServer);
  const automationsLoaded = useAutomationsStore((s) => s.loaded);

  const loadAssets = useAssetsStore((s) => s.loadFromServer);
  const assetsLoaded = useAssetsStore((s) => s.loaded);

  const loadForms = useFormsStore((s) => s.loadFromServer);
  const formsLoaded = useFormsStore((s) => s.loaded);

  const loadTeam = useTeamStore((s) => s.loadFromServer);
  const teamLoaded = useTeamStore((s) => s.loaded);

  const loadIntegrations = useIntegrationsStore((s) => s.loadFromServer);
  const integrationsLoaded = useIntegrationsStore((s) => s.loaded);

  const addRealtimeItem = useInboxStore((s) => s.addRealtimeItem);

  // Load store data
  useEffect(() => {
    if (orgLoading || !orgId) return;

    if (!jobsLoaded) loadJobs(orgId);
    if (!clientsLoaded) loadClients(orgId);
    if (!financeLoaded) loadFinance(orgId);
    if (!inboxLoaded) loadInbox(orgId);
    if (!scheduleLoaded) loadSchedule(orgId, new Date().toISOString().split("T")[0]);
    if (!automationsLoaded) loadAutomations(orgId);
    if (!assetsLoaded) loadAssets(orgId);
    if (!formsLoaded) loadForms(orgId);
    if (!teamLoaded) loadTeam(orgId);
    if (!integrationsLoaded) loadIntegrations(orgId);
  }, [
    orgId,
    orgLoading,
    jobsLoaded,
    clientsLoaded,
    financeLoaded,
    inboxLoaded,
    scheduleLoaded,
    automationsLoaded,
    assetsLoaded,
    formsLoaded,
    teamLoaded,
    integrationsLoaded,
    loadJobs,
    loadClients,
    loadFinance,
    loadInbox,
    loadSchedule,
    loadAutomations,
    loadAssets,
    loadForms,
    loadTeam,
    loadIntegrations,
  ]);

  // Realtime subscription for notifications
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          addRealtimeItem(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          useInboxStore.getState().refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, addRealtimeItem]);

  // Realtime subscription for schedule_blocks (multi-player dispatch)
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const scheduleChannel = supabase
      .channel(`schedule:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "schedule_blocks",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useScheduleStore.getState().handleRealtimeUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "schedule_blocks",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useScheduleStore.getState().handleRealtimeUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "schedule_blocks",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useScheduleStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
    };
  }, [orgId]);

  // Realtime subscription for invoices (finance live updates)
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const financeChannel = supabase
      .channel(`finance:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invoices",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useFinanceStore.getState().handleRealtimeUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invoices",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useFinanceStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(financeChannel);
    };
  }, [orgId]);

  // Realtime subscription for assets & inventory
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const assetsChannel = supabase
      .channel(`assets:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assets",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useAssetsStore.getState().handleRealtimeUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useAssetsStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assetsChannel);
    };
  }, [orgId]);

  // Realtime subscription for team members & roles
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const teamChannel = supabase
      .channel(`team:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organization_members",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useTeamStore.getState().handleRealtimeUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organization_roles",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useTeamStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(teamChannel);
    };
  }, [orgId]);

  // Realtime subscription for form submissions
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const formsChannel = supabase
      .channel(`forms:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "form_submissions",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useFormsStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(formsChannel);
    };
  }, [orgId]);

  // Realtime subscription for automation flows
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const automationsChannel = supabase
      .channel(`automations:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_flows",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useAutomationsStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(automationsChannel);
    };
  }, [orgId]);

  // Realtime subscription for integrations
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const integrationsChannel = supabase
      .channel(`integrations:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "integrations",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          useIntegrationsStore.getState().handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(integrationsChannel);
    };
  }, [orgId]);

  return <>{children}</>;
}
