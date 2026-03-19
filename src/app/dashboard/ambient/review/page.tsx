"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  FileText,
  Pill,
  ShieldAlert,
  Target,
  Trash2,
  Edit3,
  ShoppingCart,
  AudioWaveform,
  XCircle,
  Check,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getDebriefDetail,
  approveAndCommitDebrief,
  removeProposedAction,
  rejectDebrief,
} from "@/app/actions/hermes-scribe";
import { useToastStore } from "@/components/app/action-toast";

/* ── Types ────────────────────────────────────────────── */

interface ProposedAction {
  action_type: string;
  confidence: number;
  data: Record<string, unknown>;
  warnings?: string[];
}

interface DebriefData {
  id: string;
  organization_id: string;
  job_id: string | null;
  worker_id: string;
  participant_id: string | null;
  raw_transcript: string | null;
  sanitized_transcript: string | null;
  whisper_confidence: number | null;
  overall_confidence: number | null;
  proposed_actions: ProposedAction[];
  status: string;
  sector: string;
  created_at: string;
}

const ACTION_CONFIG: Record<string, {
  icon: typeof FileText;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  shift_note: {
    icon: FileText, label: "Shift Note", color: "text-sky-400",
    bg: "bg-sky-500/10", border: "border-sky-500/20",
  },
  medication: {
    icon: Pill, label: "Medication", color: "text-emerald-400",
    bg: "bg-emerald-500/10", border: "border-emerald-500/20",
  },
  incident: {
    icon: ShieldAlert, label: "Incident Report", color: "text-rose-400",
    bg: "bg-rose-500/10", border: "border-rose-500/20",
  },
  goal_progress: {
    icon: Target, label: "Goal Progress", color: "text-violet-400",
    bg: "bg-violet-500/10", border: "border-violet-500/20",
  },
  purchase_order: {
    icon: ShoppingCart, label: "Purchase Order", color: "text-amber-400",
    bg: "bg-amber-500/10", border: "border-amber-500/20",
  },
};

/* ── Main Component ──────────────────────────────────── */

export default function DebriefReviewPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const debriefId = searchParams.get("id");
  const toast = useToastStore();

  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!orgId || !debriefId) return;
    setLoading(true);
    const { data } = await getDebriefDetail(orgId, debriefId);
    if (data) {
      setDebrief({
        ...data,
        proposed_actions: (data.proposed_actions ?? []) as ProposedAction[],
      } as unknown as DebriefData);
    }
    setLoading(false);
  }, [orgId, debriefId]);

  useEffect(() => { load(); }, [load]);

  const handleCommit = useCallback(async () => {
    if (!orgId || !debriefId || !debrief) return;
    setCommitting(true);
    const res = await approveAndCommitDebrief(orgId, debriefId, {
      job_id: debrief.job_id ?? undefined,
      participant_id: debrief.participant_id ?? undefined,
    });
    if (res.error) {
      toast.addToast(res.error, undefined, "error");
    } else {
      toast.addToast("Debrief committed successfully — all records saved");
      router.push("/dashboard/ambient");
    }
    setCommitting(false);
  }, [orgId, debriefId, debrief, toast, router]);

  const handleRemoveAction = useCallback(async (idx: number) => {
    if (!orgId || !debriefId) return;
    setRemovingIdx(idx);
    await removeProposedAction(orgId, debriefId, idx);
    await load();
    setRemovingIdx(null);
  }, [orgId, debriefId, load]);

  const handleReject = useCallback(async () => {
    if (!orgId || !debriefId) return;
    await rejectDebrief(orgId, debriefId);
    toast.addToast("Debrief rejected");
    router.push("/dashboard/ambient");
  }, [orgId, debriefId, toast, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050505] text-zinc-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading debrief...
      </div>
    );
  }

  if (!debrief) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050505] text-zinc-500">
        Debrief not found
      </div>
    );
  }

  const actions = debrief.proposed_actions;
  const hasWarnings = actions.some((a) => a.warnings && a.warnings.length > 0);
  const hasHighSeverityIncident = actions.some(
    (a) => a.action_type === "incident" &&
      ((a.data.severity === "HIGH" || a.data.severity === "CRITICAL") ||
        a.data.is_sirs_reportable || a.data.involves_restrictive_practice)
  );

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* ── Header ─────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/ambient")}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-white">Review Debrief</h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{debrief.id}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* ── Transcript Card ──────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AudioWaveform className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Raw Transcript
            </span>
            {debrief.whisper_confidence != null && (
              <span className={`ml-auto text-[10px] font-mono ${
                debrief.whisper_confidence >= 0.85 ? "text-emerald-400" : "text-amber-400"
              }`}>
                Whisper {(debrief.whisper_confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed italic">
            &ldquo;{debrief.raw_transcript}&rdquo;
          </p>
        </div>

        {/* ── Warning Banner ───────────────────────── */}
        {hasHighSeverityIncident && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3"
          >
            <ShieldAlert className="w-5 h-5 text-rose-400 mt-0.5 shrink-0 animate-pulse" />
            <div>
              <p className="text-xs font-semibold text-rose-300">
                SIRS-Reportable Incident Detected
              </p>
              <p className="text-xs text-rose-400/80 mt-1">
                This debrief contains a high-severity incident that may require mandatory reporting to the NDIS Quality and Safeguards Commission within 24 hours.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Action Cards ─────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Proposed Actions ({actions.length})
          </p>

          <AnimatePresence mode="popLayout">
            {actions.map((action, idx) => (
              <ActionCard
                key={`${action.action_type}-${idx}`}
                action={action}
                index={idx}
                onRemove={() => handleRemoveAction(idx)}
                removing={removingIdx === idx}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer Actions ─────────────────────────── */}
      {debrief.status === "PENDING_REVIEW" && (
        <div className="shrink-0 border-t border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleReject}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject All
          </button>

          <div className="flex items-center gap-3">
            {debrief.overall_confidence != null && (
              <span className={`text-xs font-mono ${
                debrief.overall_confidence >= 0.8 ? "text-emerald-400" : "text-amber-400"
              }`}>
                {(debrief.overall_confidence * 100).toFixed(0)}% confidence
              </span>
            )}
            <button
              onClick={handleCommit}
              disabled={committing || actions.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {committing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve &amp; Commit All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Action Card ─────────────────────────────────────── */

function ActionCard({
  action,
  index,
  onRemove,
  removing,
}: {
  action: ProposedAction;
  index: number;
  onRemove: () => void;
  removing: boolean;
}) {
  const cfg = ACTION_CONFIG[action.action_type] ?? ACTION_CONFIG.shift_note;
  const Icon = cfg.icon;
  const data = action.data;
  const warnings = action.warnings ?? [];
  const confidence = action.confidence;
  const confPct = Math.round(confidence * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${cfg.color}`} />
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className={`text-[10px] font-mono ${
            confPct >= 80 ? "text-emerald-400" : confPct >= 50 ? "text-amber-400" : "text-rose-400"
          }`}>
            {confPct}%
          </span>
        </div>
        <button
          onClick={onRemove}
          disabled={removing}
          className="w-6 h-6 rounded-md bg-white/[0.06] hover:bg-rose-500/20 flex items-center justify-center transition-colors"
        >
          {removing ? (
            <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
          ) : (
            <Trash2 className="w-3 h-3 text-zinc-500 hover:text-rose-400" />
          )}
        </button>
      </div>

      {/* Content by type */}
      {action.action_type === "shift_note" && (
        <div className="text-sm text-zinc-300 leading-relaxed">
          <p>{(data.context_of_support as string) ?? ""}</p>
          {data.outcomes_achieved ? (
            <span className="block mt-2 text-xs text-zinc-400">
              Outcomes: {String(data.outcomes_achieved)}
            </span>
          ) : null}
        </div>
      )}

      {action.action_type === "medication" && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Pill className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-medium text-white">
              {data.medication_name as string}
            </span>
          </div>
          {data.dosage_amount ? (
            <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
              {String(data.dosage_amount)}
            </span>
          ) : null}
          {data.approximate_time ? (
            <span className="text-xs text-zinc-400">
              at {String(data.approximate_time)}
            </span>
          ) : null}
          {data.was_refused ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium">
              REFUSED
            </span>
          ) : null}
        </div>
      )}

      {action.action_type === "incident" && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              data.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400" :
              data.severity === "HIGH" ? "bg-amber-500/20 text-amber-400" :
              data.severity === "MEDIUM" ? "bg-sky-500/20 text-sky-400" :
              "bg-zinc-500/20 text-zinc-400"
            }`}>
              {data.severity as string}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {data.incident_type as string}
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {data.objective_description as string}
          </p>
        </div>
      )}

      {action.action_type === "goal_progress" && (
        <div className="flex items-center gap-3">
          <Target className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-sm text-white font-medium">
            {data.goal_name as string}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            data.progress_rating === "EXCEEDED" ? "bg-emerald-500/20 text-emerald-400" :
            data.progress_rating === "PROGRESSING" ? "bg-sky-500/20 text-sky-400" :
            data.progress_rating === "MAINTAINED" ? "bg-zinc-500/20 text-zinc-400" :
            "bg-rose-500/20 text-rose-400"
          }`}>
            {data.progress_rating as string}
          </span>
        </div>
      )}

      {action.action_type === "purchase_order" && (
        <div>
          {data.supplier_name ? (
            <p className="text-xs text-zinc-400 mb-1">
              Supplier: {String(data.supplier_name)}
            </p>
          ) : null}
          <div className="space-y-1">
            {((data.items as Record<string, unknown>[]) ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 font-mono">{item.quantity as number}x</span>
                <span className="text-zinc-300">{item.description as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
