"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Search,
  ChevronRight,
  FileText,
  Pill,
  ShieldAlert,
  Target,
  XCircle,
  AudioWaveform,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getAudioDebriefs,
  getAmbientStats,
} from "@/app/actions/hermes-scribe";

/* ── Types ────────────────────────────────────────────── */

interface Debrief {
  id: string;
  job_id: string | null;
  worker_id: string;
  status: string;
  raw_transcript: string | null;
  sanitized_transcript: string | null;
  overall_confidence: number | null;
  proposed_actions: Record<string, unknown>[] | null;
  sector: string;
  created_at: string;
  whisper_confidence: number | null;
  error_message: string | null;
}

interface Stats {
  pending_review: number;
  committed: number;
  failed: number;
  total: number;
}

type FilterTab = "all" | "PENDING_REVIEW" | "COMMITTED" | "FAILED";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  UPLOADING: { label: "Uploading", icon: Loader2, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  TRANSCRIBING: { label: "Transcribing", icon: AudioWaveform, color: "text-sky-400", bg: "bg-sky-500/10" },
  ROUTING: { label: "Routing", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10" },
  PENDING_REVIEW: { label: "Pending Review", icon: Eye, color: "text-amber-400", bg: "bg-amber-500/10" },
  COMMITTED: { label: "Committed", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  FAILED: { label: "Failed", icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10" },
  REJECTED: { label: "Rejected", icon: XCircle, color: "text-zinc-500", bg: "bg-zinc-500/10" },
};

const ACTION_ICONS: Record<string, typeof FileText> = {
  shift_note: FileText,
  medication: Pill,
  incident: ShieldAlert,
  goal_progress: Target,
};

/* ── Main Component ──────────────────────────────────── */

export default function AmbientPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const statusFilter = tab === "all" ? undefined : tab;
    const [debRes, statsRes] = await Promise.all([
      getAudioDebriefs(orgId, { status: statusFilter }),
      getAmbientStats(orgId),
    ]);
    setDebriefs((debRes.data ?? []) as unknown as Debrief[]);
    setStats(statsRes.data as Stats | null);
    setLoading(false);
  }, [orgId, tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return debriefs;
    const q = search.toLowerCase();
    return debriefs.filter((d) =>
      (d.raw_transcript ?? "").toLowerCase().includes(q) ||
      (d.sanitized_transcript ?? "").toLowerCase().includes(q)
    );
  }, [debriefs, search]);

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "All Debriefs", count: stats?.total },
    { id: "PENDING_REVIEW", label: "Pending Review", count: stats?.pending_review },
    { id: "COMMITTED", label: "Committed", count: stats?.committed },
    { id: "FAILED", label: "Failed", count: stats?.failed },
  ];

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* ── Header ─────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Mic className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Hermes-Scribe — Ambient Intelligence
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Voice-to-ledger debriefs with AI semantic routing
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Stat Cards ───────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mt-5">
            <StatCard label="Total Debriefs" value={stats.total} icon={<Mic className="w-4 h-4 text-violet-400" />} />
            <StatCard label="Pending Review" value={stats.pending_review} icon={<Eye className="w-4 h-4 text-amber-400" />} />
            <StatCard label="Committed" value={stats.committed} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
            <StatCard label="Failed" value={stats.failed} icon={<XCircle className="w-4 h-4 text-rose-400" />} />
          </div>
        )}

        {/* ── Tabs + Search ────────────────────────── */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1.5 text-[10px] text-zinc-600">{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transcripts..."
              className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
            />
          </div>
        </div>
      </div>

      {/* ── Debriefs List ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading debriefs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <Mic className="w-10 h-10 mb-3 text-violet-500/20" />
            <p className="text-sm font-medium text-zinc-400">No debriefs yet</p>
            <p className="text-xs mt-1">Record a shift debrief on mobile to begin</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <AnimatePresence mode="popLayout">
              {filtered.map((d) => (
                <DebriefRow key={d.id} debrief={d} onClick={() => {
                  if (d.status === "PENDING_REVIEW") {
                    router.push(`/dashboard/ambient/review?id=${d.id}`);
                  }
                }} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-Components ──────────────────────────────────── */

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold text-white tracking-tight">{value}</p>
    </div>
  );
}

function DebriefRow({ debrief, onClick }: { debrief: Debrief; onClick: () => void }) {
  const cfg = STATUS_CONFIG[debrief.status] ?? STATUS_CONFIG.UPLOADING;
  const StatusIcon = cfg.icon;
  const actions = debrief.proposed_actions ?? [];
  const isClickable = debrief.status === "PENDING_REVIEW";
  const confidence = debrief.overall_confidence;
  const date = new Date(debrief.created_at);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      disabled={!isClickable}
      className={`w-full px-6 py-4 text-left transition-colors ${
        isClickable ? "hover:bg-white/[0.02] cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Status icon */}
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
          <StatusIcon className={`w-4 h-4 ${cfg.color} ${
            debrief.status === "TRANSCRIBING" || debrief.status === "ROUTING" ? "animate-spin" : ""
          }`} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm text-zinc-300 mt-1 truncate">
            {debrief.sanitized_transcript || debrief.raw_transcript || debrief.error_message || "Processing..."}
          </p>
        </div>

        {/* Action pills */}
        {actions.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {actions.map((a, i) => {
              const Icon = ACTION_ICONS[a.action_type as string] ?? FileText;
              return (
                <div
                  key={i}
                  className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center"
                  title={a.action_type as string}
                >
                  <Icon className="w-3 h-3 text-zinc-400" />
                </div>
              );
            })}
          </div>
        )}

        {/* Confidence */}
        {confidence != null && (
          <div className="shrink-0 text-right">
            <p className={`text-xs font-mono ${
              confidence >= 0.8 ? "text-emerald-400" : confidence >= 0.5 ? "text-amber-400" : "text-rose-400"
            }`}>
              {(confidence * 100).toFixed(0)}%
            </p>
            <p className="text-[9px] text-zinc-600">confidence</p>
          </div>
        )}

        {isClickable && <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />}
      </div>
    </motion.button>
  );
}
