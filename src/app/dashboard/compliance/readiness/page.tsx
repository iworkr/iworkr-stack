/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search, ChevronRight, Filter, Upload, X,
  Loader2, ShieldCheck, Bell, Lock,
  AlertTriangle,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getComplianceReadinessAction,
  listComplianceGapsAction,
  sendTargetedRemediationAction,
  triggerCredentialRemediationAction,
  type ComplianceGapRow,
} from "@/app/actions/care-ironclad";

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
   Remediation Slide-Over
   ═══════════════════════════════════════════════════════════════════ */

function RemediationSlideOver({
  gap,
  orgId,
  onClose,
  onAction,
}: {
  gap: ComplianceGapRow;
  orgId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const [sending, setSending] = useState(false);

  const handleDispatchNotification = async () => {
    setSending(true);
    try {
      await sendTargetedRemediationAction({
        organization_id: orgId,
        user_id: gap.affected_entity_id,
        gap_title: gap.gap_title,
      });
      onAction();
      onClose();
    } catch (e: any) {
      console.error("[ironclad] dispatch failed:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 450 }}
        animate={{ x: 0 }}
        exit={{ x: 450 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[450px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <h3 className="text-[16px] font-medium text-white">Remediate Compliance Gap</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Entity Block */}
          <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-900/50 p-4">
            {gap.affected_entity_avatar ? (
              <img src={gap.affected_entity_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-[12px] font-semibold text-zinc-300">
                {getInitials(gap.affected_entity_name)}
              </div>
            )}
            <div>
              <p className="text-[14px] font-medium text-white">{gap.affected_entity_name}</p>
              <p className="text-[11px] text-zinc-500 capitalize">{categoryLabel(gap.category)}</p>
            </div>
            <div className="ml-auto">
              <GhostBadge severity={gap.severity} />
            </div>
          </div>

          {/* Gap Details */}
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Missing Credential / Gap</p>
            <p className="text-[14px] font-medium text-white">{gap.gap_title}</p>
            <p className="mt-1 font-mono text-[11px] text-rose-400">{gap.gap_detail}</p>
          </div>

          {/* Action Matrix */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Remediation Actions</p>

            {/* Action 1: Dispatch Push Notification */}
            <button
              onClick={handleDispatchNotification}
              disabled={sending}
              className="flex w-full items-center gap-3 rounded-md border border-white/5 bg-transparent px-4 py-3 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <Bell size={16} className="text-emerald-400" />}
              <div>
                <p className="text-[13px] font-medium text-white">Dispatch Push Notification</p>
                <p className="text-[11px] text-zinc-500">Send targeted alert to this worker&apos;s mobile app.</p>
              </div>
            </button>

            {/* Action 2: Manual Upload */}
            <button
              onClick={() => {
                // Open file picker for certificate upload
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.jpg,.jpeg,.png,.webp";
                input.onchange = async () => {
                  if (!input.files?.[0]) return;
                  // INCOMPLETE: Wire to Supabase Storage upload + credential update when backend ready
                  alert(`File "${input.files[0].name}" selected — upload integration pending backend wiring.`);
                };
                input.click();
              }}
              className="flex w-full items-center gap-3 rounded-md border border-white/5 bg-transparent px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <Upload size={16} className="text-zinc-400" />
              <div>
                <p className="text-[13px] font-medium text-white">Manually Upload Certificate</p>
                <p className="text-[11px] text-zinc-500">Upload a document on the worker&apos;s behalf.</p>
              </div>
            </button>

            {/* Action 3: Suspend (Destructive) */}
            <button
              onClick={() => {
                if (!gap) return;
                const confirmed = confirm(`Are you sure you want to suspend this worker profile?\n\nThis will prevent rostering until the compliance gap "${gap.gap_title}" is resolved.`);
                if (!confirmed) return;
                // INCOMPLETE: Wire to suspendWorkerProfileAction when backend endpoint ready
                alert("Worker suspension action triggered — backend integration pending.");
              }}
              className="mt-6 flex w-full items-center gap-3 rounded-md border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-left transition-colors hover:bg-rose-500/10"
            >
              <Lock size={16} className="text-rose-500" />
              <div>
                <p className="text-[13px] font-medium text-rose-500">Suspend Worker Profile</p>
                <p className="text-[11px] text-zinc-500">Prevent rostering until the gap is resolved.</p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ComplianceReadinessPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [activeTab, setActiveTab] = useState<PillTab>("all");
  const [search, setSearch] = useState("");
  const [readiness, setReadiness] = useState<ReadinessState | null>(null);
  const [gaps, setGaps] = useState<ComplianceGapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOverGap, setSlideOverGap] = useState<ComplianceGapRow | null>(null);

  // ── Load data ─────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [readinessData, gapData] = await Promise.all([
        getComplianceReadinessAction(orgId),
        listComplianceGapsAction(orgId),
      ]);
      setReadiness(readinessData as ReadinessState);
      setGaps(gapData);
    } catch (e: any) {
      console.error("[ironclad] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId, loadData]);

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
                      {gap.affected_entity_avatar ? (
                        <img src={gap.affected_entity_avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400">
                          {getInitials(gap.affected_entity_name)}
                        </div>
                      )}
                      <span className="text-[13px] text-zinc-300">{gap.affected_entity_name}</span>
                    </div>
                  </td>

                  {/* SEVERITY */}
                  <td className="py-3">
                    <GhostBadge severity={gap.severity} />
                  </td>

                  {/* ACTION */}
                  <td className="py-3 pr-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlideOverGap(gap);
                      }}
                      className="h-6 rounded-md px-2.5 text-[10px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10"
                    >
                      Remediate
                    </button>
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
            onClose={() => setSlideOverGap(null)}
            onAction={loadData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
