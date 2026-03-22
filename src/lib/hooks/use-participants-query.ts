/**
 * @hook useParticipantsQuery
 * @status COMPLETE
 * @description React Query hooks for participant CRUD, dossier, budget, and clinical timeline
 * @lastAudit 2026-03-22
 */
"use client";

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchParticipants,
  fetchParticipantDossier,
  fetchBudgetTelemetry,
  fetchClinicalTimeline,
  fetchExternalAgencies,
  type ParticipantProfile,
} from "@/app/actions/participants";
import { queryKeys } from "./use-query-keys";

const PAGE_SIZE = 50;

export function useParticipantsList(
  workspaceId: string | null | undefined,
  filters?: { search?: string; status?: string; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.participants.list(workspaceId ?? "", filters),
    queryFn: async () => {
      if (!workspaceId) return { data: [] as ParticipantProfile[], total: 0, nextCursor: null };
      return fetchParticipants(workspaceId, {
        search: filters?.search,
        status: filters?.status,
        limit: filters?.limit ?? 100,
      });
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

/**
 * Cursor-based infinite scroll for large participant lists.
 * Uses keyset pagination (created_at cursor) for O(log N) performance.
 */
export function useInfiniteParticipants(
  workspaceId: string | null | undefined,
  filters?: { search?: string; status?: string }
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.participants.list(workspaceId ?? "", filters), "infinite"] as const,
    queryFn: async ({ pageParam }) => {
      if (!workspaceId) return { data: [] as ParticipantProfile[], total: 0, nextCursor: null };
      return fetchParticipants(workspaceId, {
        search: filters?.search,
        status: filters?.status,
        limit: PAGE_SIZE,
        cursor: pageParam ?? undefined,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useParticipantDossier(
  workspaceId: string | undefined,
  participantId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.participants.dossier(participantId ?? ""),
    queryFn: async () => {
      if (!workspaceId || !participantId) return null;
      return fetchParticipantDossier(participantId, workspaceId);
    },
    enabled: !!workspaceId && !!participantId,
    staleTime: 60_000,
  });
}

export function useParticipantBudget(
  workspaceId: string | undefined,
  participantId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.participants.budget(participantId ?? ""),
    queryFn: async () => {
      if (!workspaceId || !participantId) return null;
      return fetchBudgetTelemetry(participantId, workspaceId);
    },
    enabled: !!workspaceId && !!participantId,
    staleTime: 2 * 60_000,
  });
}

export function useParticipantTimeline(
  workspaceId: string | undefined,
  participantId: string | undefined
) {
  return useQuery({
    queryKey: queryKeys.participants.timeline(participantId ?? ""),
    queryFn: async () => {
      if (!workspaceId || !participantId) return [];
      return fetchClinicalTimeline(participantId, workspaceId);
    },
    enabled: !!workspaceId && !!participantId,
    staleTime: 60_000,
  });
}

export function useExternalAgencies(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agencies.list(workspaceId ?? ""),
    queryFn: async () => {
      if (!workspaceId) return [];
      return fetchExternalAgencies(workspaceId);
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
}

export function usePrefetchParticipant() {
  const queryClient = useQueryClient();

  return (participantId: string, workspaceId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.participants.dossier(participantId),
      queryFn: () => fetchParticipantDossier(participantId, workspaceId),
      staleTime: 60_000,
    });
  };
}

export function useInvalidateParticipants() {
  const queryClient = useQueryClient();

  return {
    invalidateList: (workspaceId: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all(workspaceId) }),
    invalidateDetail: (participantId: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.dossier(participantId) }),
    invalidateAll: (workspaceId: string) =>
      queryClient.invalidateQueries({ queryKey: ["participants"] }),
  };
}

export function useUpdateParticipantStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ participantId, status, workspaceId }: { participantId: string; status: string; workspaceId: string }) => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await (supabase as any)
        .from("participant_profiles")
        .update({ status })
        .eq("id", participantId)
        .eq("organization_id", workspaceId);
      if (error) throw new Error(error.message);
      return { participantId, status };
    },
    onMutate: async ({ participantId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["participants"] });

      const previousLists = queryClient.getQueriesData({ queryKey: ["participants"] });

      queryClient.setQueriesData(
        { queryKey: ["participants"] },
        (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((p: ParticipantProfile) =>
              p.id === participantId ? { ...p, status } : p
            ),
          };
        }
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
    },
  });
}
