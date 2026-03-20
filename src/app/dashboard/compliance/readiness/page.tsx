/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Search, Filter, Upload,
  Loader2, ShieldCheck,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getComplianceReadinessAction,
  listComplianceGapsAction,
  sendTargetedRemediationAction,
  type ComplianceGapRow,
} from "@/app/actions/care-ironclad";
import { RemediationSlideOver } from "@/components/governance/RemediationSlideOver";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ═══════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════ */

type PillTab = "all" | "staffing" | "clinical" | "evv";

const PILL_TABS: { id: PillTab; label: string }[] = [
  { id: "all", label: "Action Required" },
  { id: "staffing", label: "Staffing" },
  { id: "clinical", label: "Clinical" },
  { id: "evv", label: "EVV / Documentation" },
];

interface ReadinessState {
  compliance_score: number;
  gaps: {
    staffing: number;
    documentation: number;
    clinical: number;
    evv_rate: number;
  };
  computed_at: string;
}

interface ReadinessQueryData {
  readiness: ReadinessState;
  gaps: (ComplianceGapRow & { _optimisticRemediation?: "dispatched" })[];
}

const EMPTY_GAPS: ReadinessQueryData["gaps"] = [];

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function scoreColor(score: number): string {
  if (score >= 100) return "text-emerald-500";
  if (score >= 70) return "text-amber-500";
  return "text-rose-500 font-bold";
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    staffing: "Staffing",
    documentation: "Documentation",
    clinical: "Clinical",
    evv: "EVV / Timesheets",
  };
  return map[cat] || cat;
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════ */

function GhostBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    monitor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  const labels: Record<string, string> = {
    critical: "CRITICAL",
    warning: "WARNING",
    monitor: "MONITOR",
  };
  const cls = map[severity] || map.monitor;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {labels[severity] || severity.toUpperCase()}
    </span>
  );
}

function MetricNode({ label, value, colorClass, alert }: { label: string; value: string | number; colorClass?: string; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {alert && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
        <span className={`font-mono text-[20px] leading-none ${colorClass || "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 h-16 animate-pulse">
      <td className="px-8 py-3"><div className="space-y-1.5"><div className="h-3 w-40 rounded bg-white/5" /><div className="h-2 w-28 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-3 w-16 rounded bg-white/5" /></td>
      <td className="py-3"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-white/5" /><div className="h-3 w-24 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-5 w-16 rounded-full bg-white/5" /></td>
      <td className="py-3 pr-8"><div className="h-5 w-20 rounded bg-white/5" /></td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-zinc-950/50 mx-8 mt-8">
      <ShieldCheck size={40} strokeWidth={0.8} className="mb-4 text-emerald-500/50" />
      <p className="text-[15px] font-medium text-white">100% Compliance Achieved.</p>
      <p className="mt-1 max-w-sm text-center text-[13px] text-zinc-500">
        There are no active gaps or expiring credentials across your workforce and clinical systems.
      </p>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ComplianceReadinessPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PillTab>("all");
  const [search, setSearch] = useState("");
  const [slideOverGap, setSlideOverGap] = useState<ComplianceGapRow | null>(null);
  const [userId, setUserId] = useState<string>("");

  const { data: readinessData, isLoading: loading } = useQuery<ReadinessQueryData>({
    queryKey: queryKeys.compliance.readiness(orgId ?? ""),
    queryFn: async () => {
      const [readiness, gaps] = await Promise.all([
        getComplianceReadinessAction(orgId!),
        listComplianceGapsAction(orgId!),
      ]);
      return { readiness: readiness as ReadinessState, gaps };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const readiness = readinessData?.readiness ?? null;
  const gaps = readinessData?.gaps ?? EMPTY_GAPS;

  const readinessQueryKey = orgId ? queryKeys.compliance.readiness(orgId) : null;

  const invalidateReadiness = () => {
    if (orgId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.compliance.readiness(orgId),
      });
    }
  };

  const dispatchRemediationMutation = useMutation({
    mutationFn: (gap: ComplianceGapRow) =>
      sendTargetedRemediationAction({
        organization_id: orgId!,
        user_id: gap.affected_entity_id,
        gap_title: gap.gap_title,
      }),
    onMutate: async (gap) => {
      if (!readinessQueryKey) return {};
      await queryClient.cancelQueries({ queryKey: readinessQueryKey });
      const previous = queryClient.getQueryData<ReadinessQueryData>(readinessQueryKey);
      queryClient.setQueryData<ReadinessQueryData>(readinessQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          gaps: old.gaps.map((g) =>
            g.id === gap.id ? { ...g, _optimisticRemediation: "dispatched" as const } : g
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _gap, context) => {
      if (context?.previous !== undefined && readinessQueryKey) {
        queryClient.setQueryData(readinessQueryKey, context.previous);
      }
      console.error("[ironclad] dispatch failed:", _err);
    },
    onSettled: () => {
      invalidateReadiness();
    },
  });

  // Resolve current admin user id from auth store (no network call needed)
  const authUser = useAuthStore((s) => s.user);
  useEffect(() => {
    if (authUser?.id) setUserId(authUser.id);
  }, [authUser?.id]);

  // ── Filter by tab + search ────────────────────────
  const filteredGaps = useMemo(() => {
    let filtered = gaps;
    if (activeTab === "staffing") {
      filtered = filtered.filter((g) => g.category === "staffing");
    } else if (activeTab === "clinical") {
      filtered = filtered.filter((g) => g.category === "clinical");
    } else if (activeTab === "evv") {
      filtered = filtered.filter((g) => g.category === "evv" || g.category === "documentation");
    }
    // "all" tab shows everything

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.gap_title.toLowerCase().includes(q) ||
          g.affected_entity_name.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q) ||
          g.gap_detail.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [gaps, activeTab, search]);

  // Telemetry derived from readiness state
  const score = readiness?.compliance_score ?? 0;
  const staffingGaps = readiness?.gaps.staffing ?? 0;
  const docGaps = readiness?.gaps.documentation ?? 0;
  const clinicalGaps = readiness?.gaps.clinical ?? 0;
  const evvRate = readiness?.gaps.evv_rate ?? 0;

  if (orgLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#050505]">
      {/* ═══ COMMAND HEADER (h-14) ═══ */}
      <div className="flex h-14 items-center justify-between border-b border-white/5 bg-[#050505] px-8">
        {/* Left Cluster */}
        <div className="flex items-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            GOVERNANCE
          </span>
          <div className="mx-4 h-4 w-px bg-white/10" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-zinc-900/50 p-1">
            {PILL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white font-medium shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Cluster */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex h-8 w-64 items-center rounded-md border border-white/5 bg-zinc-900 px-3">
            <Search className="h-3 w-3 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search policy, worker, credential..."
              className="ml-2 w-full bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
            />
          </div>

          {/* Filters */}
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/5 bg-transparent px-3 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
            <Filter className="h-3 w-3" />
            Filters
          </button>

          {/* Upload Policy CTA */}
          <button className="ml-3 flex h-8 items-center gap-1.5 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200">
            <Upload className="h-3 w-3" />
            Upload Policy
          </button>
        </div>
      </div>

      {/* ═══ TELEMETRY RIBBON (h-16) ═══ */}
      <div className="flex h-16 w-full items-center overflow-x-auto border-b border-white/5 bg-zinc-950/30 px-8">
        <MetricNode
          label="READINESS SCORE"
          value={`${score}%`}
          colorClass={scoreColor(score)}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="STAFFING GAPS"
          value={staffingGaps}
          colorClass={staffingGaps > 0 ? "text-amber-500 font-bold" : "text-white"}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="DOCUMENTATION GAPS"
          value={docGaps}
          colorClass={docGaps > 0 ? "text-amber-500" : "text-white"}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="CLINICAL GAPS"
          value={clinicalGaps}
          colorClass={clinicalGaps > 0 ? "text-rose-500 font-bold" : "text-white"}
          alert={clinicalGaps > 0}
        />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode
          label="EVV GAP RATE"
          value={`${evvRate}%`}
          colorClass={evvRate > 5 ? "text-amber-500" : "text-white"}
        />
      </div>

      {/* ═══ DATA GRID ═══ */}
      <div className="flex-1 overflow-y-auto px-8 mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="w-[30%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">GAP / POLICY ITEM</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">CATEGORY</th>
              <th className="w-[25%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">AFFECTED ENTITY</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">SEVERITY</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">ACTION</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filteredGaps.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              filteredGaps.map((gap, i) => (
                <motion.tr
                  key={gap.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.25 }}
                  onClick={() => setSlideOverGap(gap)}
                  className="group cursor-pointer border-b border-white/5 transition-colors h-16 hover:bg-white/[0.02]"
                >
                  {/* GAP / POLICY ITEM */}
                  <td className="py-3">
                    <div>
                      <p className="text-[14px] font-medium text-white">{gap.gap_title}</p>
                      <p className="font-mono text-[11px] text-rose-400">{gap.gap_detail}</p>
                    </div>
                  </td>

                  {/* CATEGORY */}
                  <td className="py-3">
                    <span className="text-[13px] text-zinc-400">{categoryLabel(gap.category)}</span>
                  </td>

                  {/* AFFECTED ENTITY */}
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <LetterAvatar name={gap.affected_entity_name} src={gap.affected_entity_avatar} size={24} />
                      <span className="text-[13px] text-zinc-300">{gap.affected_entity_name}</span>
                    </div>
                  </td>

                  {/* SEVERITY */}
                  <td className="py-3">
                    <GhostBadge severity={gap.severity} />
                  </td>

                  {/* ACTION */}
                  <td className="py-3 pr-0">
                    {gap._optimisticRemediation === "dispatched" ? (
                      <span className="inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-medium text-sky-400">
                        Reminder sent
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideOverGap(gap);
                        }}
                        className="h-6 rounded-md px-2.5 text-[10px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10"
                      >
                        Remediate
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ REMEDIATION SLIDE-OVER ═══ */}
      <AnimatePresence>
        {slideOverGap && orgId && (
          <RemediationSlideOver
            gap={slideOverGap}
            orgId={orgId}
            userId={userId}
            onClose={() => setSlideOverGap(null)}
            onAction={invalidateReadiness}
            dispatchSending={dispatchRemediationMutation.isPending}
            onDispatchNotification={async () => {
              if (!slideOverGap) return;
              dispatchRemediationMutation.mutate(slideOverGap);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
