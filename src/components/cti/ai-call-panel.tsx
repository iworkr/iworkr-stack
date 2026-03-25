/**
 * @component AiCallPanel
 * @status COMPLETE
 * @description Project Siren-Voice — AI Voice Intelligence panel showing call history,
 *   AI actions audit trail, transcripts, summaries, and phone configuration.
 * @lastAudit 2026-03-24
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Bot,
  User,
  Calendar,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  Clock,
  FileText,
  ChevronRight,
  Play,
  Voicemail,
  Sparkles,
  BarChart3,
  Shield,
  ArrowUpRight,
  X,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getAiCallActions,
  getCallHistory,
  getAiCallStats,
  getCallTranscript,
  type AiCallAction,
  type CallHistoryEntry,
  type AiCallStats,
} from "@/app/actions/siren-voice";

/* ── Helpers ──────────────────────────────────────────────── */

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const ACTION_ICONS: Record<string, typeof Calendar> = {
  reschedule_job: Calendar,
  save_message: MessageSquare,
  create_lead: UserPlus,
  trigger_escalation: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  reschedule_job: "text-blue-400 bg-blue-500/10",
  save_message: "text-amber-400 bg-amber-500/10",
  create_lead: "text-emerald-400 bg-emerald-500/10",
  trigger_escalation: "text-rose-400 bg-rose-500/10",
};

type Tab = "history" | "ai_actions" | "stats";

/* ── Main Component ──────────────────────────────────────── */

export function AiCallPanel() {
  const org = useOrg();
  const orgId = org?.orgId;
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [selectedCall, setSelectedCall] = useState<CallHistoryEntry | null>(null);
  const [transcriptData, setTranscriptData] = useState<Record<string, any> | null>(null);

  // Queries
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["siren-voice", "history", orgId],
    queryFn: async () => {
      const res = await getCallHistory(orgId!);
      return res.data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: aiActions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ["siren-voice", "actions", orgId],
    queryFn: async () => {
      const res = await getAiCallActions(orgId!);
      return res.data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: stats = null } = useQuery<AiCallStats | null>({
    queryKey: ["siren-voice", "stats", orgId],
    queryFn: async () => {
      const res = await getAiCallStats(orgId!);
      return res.data;
    },
    enabled: !!orgId,
  });

  const loadTranscript = async (callSid: string) => {
    const res = await getCallTranscript(callSid);
    setTranscriptData(res.data);
  };

  if (!orgId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-zinc-500">Loading…</p>
      </div>
    );
  }

  const tabs = [
    { id: "history" as Tab, label: "Call History", icon: Phone, count: history.length },
    { id: "ai_actions" as Tab, label: "AI Actions", icon: Bot, count: aiActions.length },
    { id: "stats" as Tab, label: "Intelligence", icon: BarChart3 },
  ];

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <div className="stealth-noise" />

      {/* ══ Left Panel ══ */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-white/[0.06] px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <Bot size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold tracking-tight text-white">
                Voice Intelligence
              </h1>
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Siren-Voice · AI Receptionist
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          {stats && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {[
                { label: "Total", value: stats.total_calls, color: "zinc" },
                { label: "AI Handled", value: stats.ai_handled, color: "emerald" },
                { label: "Missed", value: stats.missed, color: "rose" },
                { label: "Reschedules", value: stats.reschedules, color: "blue" },
                { label: "Leads", value: stats.leads_created, color: "violet" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-center"
                >
                  <p className={`text-[16px] font-bold text-${color}-400`}>{value ?? 0}</p>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-4 flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-0.5 rounded bg-white/[0.06] px-1 text-[9px] font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "history" && (
            <CallHistoryTab
              calls={history}
              loading={historyLoading}
              onSelect={(call) => {
                setSelectedCall(call);
                setTranscriptData(null);
                if (call.twilio_call_sid) {
                  loadTranscript(call.twilio_call_sid);
                }
              }}
              selectedId={selectedCall?.id}
            />
          )}

          {activeTab === "ai_actions" && (
            <AiActionsTab actions={aiActions} loading={actionsLoading} />
          )}

          {activeTab === "stats" && stats && (
            <StatsTab stats={stats} />
          )}
        </div>
      </div>

      {/* ══ Right Panel: Detail ══ */}
      <AnimatePresence>
        {selectedCall && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="shrink-0 overflow-hidden border-l border-white/[0.06]"
          >
            <CallDetail
              call={selectedCall}
              transcript={transcriptData}
              onClose={() => setSelectedCall(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Call History Tab ──────────────────────────────────────── */

function CallHistoryTab({
  calls,
  loading,
  onSelect,
  selectedId,
}: {
  calls: CallHistoryEntry[];
  loading: boolean;
  onSelect: (call: CallHistoryEntry) => void;
  selectedId?: string;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2">
        <Phone size={20} className="text-zinc-700" />
        <p className="text-[12px] text-zinc-600">No call records yet</p>
        <p className="text-[10px] text-zinc-700">Calls will appear here once your Twilio number is configured</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {calls.map((call) => (
        <button
          key={call.id}
          onClick={() => onSelect(call)}
          className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.02] ${
            selectedId === call.id ? "bg-white/[0.04]" : ""
          }`}
        >
          {/* Icon */}
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            call.ai_handled
              ? "bg-emerald-500/10"
              : call.status === "missed"
              ? "bg-rose-500/10"
              : call.status === "voicemail"
              ? "bg-amber-500/10"
              : "bg-white/[0.04]"
          }`}>
            {call.ai_handled ? (
              <Bot size={14} className="text-emerald-400" />
            ) : call.status === "missed" ? (
              <PhoneMissed size={14} className="text-rose-400" />
            ) : call.status === "voicemail" ? (
              <Voicemail size={14} className="text-amber-400" />
            ) : (
              <PhoneIncoming size={14} className="text-zinc-400" />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-white">
                {call.client_name || call.from_number || "Unknown"}
              </span>
              {call.ai_handled && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                  AI
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              {call.direction === "inbound" ? "Inbound" : "Outbound"}
              {call.duration_seconds ? ` · ${formatDuration(call.duration_seconds)}` : ""}
              {call.ai_summary && (
                <span className="truncate text-zinc-500">· {call.ai_summary.substring(0, 50)}...</span>
              )}
            </div>
          </div>

          {/* Time + Status */}
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-zinc-600">{timeAgo(call.created_at)}</p>
            {call.status && (
              <span className={`mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                call.status === "ai_handled" ? "bg-emerald-500/15 text-emerald-400" :
                call.status === "completed" ? "bg-blue-500/15 text-blue-400" :
                call.status === "missed" ? "bg-rose-500/15 text-rose-400" :
                call.status === "voicemail" ? "bg-amber-500/15 text-amber-400" :
                "bg-zinc-800 text-zinc-500"
              }`}>
                {call.status.replace("_", " ")}
              </span>
            )}
          </div>

          <ChevronRight size={14} className="shrink-0 text-zinc-700" />
        </button>
      ))}
    </div>
  );
}

/* ── AI Actions Tab ───────────────────────────────────────── */

function AiActionsTab({
  actions,
  loading,
}: {
  actions: AiCallAction[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2">
        <Shield size={20} className="text-zinc-700" />
        <p className="text-[12px] text-zinc-600">No AI actions recorded</p>
        <p className="text-[10px] text-zinc-700">AI receptionist mutations will be logged here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.action_type] || Sparkles;
        const colorClass = ACTION_COLORS[action.action_type] || "text-zinc-400 bg-zinc-800";

        return (
          <div key={action.id} className="px-5 py-3">
            <div className="flex items-start gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass.split(" ")[1]}`}>
                <Icon size={14} className={colorClass.split(" ")[0]} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-white capitalize">
                    {action.action_type.replace(/_/g, " ")}
                  </span>
                  {action.success ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                      Success
                    </span>
                  ) : (
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-rose-400">
                      Failed
                    </span>
                  )}
                  {action.ai_confidence !== null && (
                    <span className="text-[9px] text-zinc-600">
                      {Math.round((action.ai_confidence ?? 0) * 100)}% conf
                    </span>
                  )}
                </div>

                {/* Payload summary */}
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {action.action_type === "reschedule_job" && action.action_payload?.job_title
                    ? `Rescheduled "${action.action_payload.job_title}" to ${new Date(action.action_payload.new_datetime).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`
                    : action.action_type === "save_message" && action.action_payload?.summary
                    ? action.action_payload.summary
                    : action.action_type === "create_lead" && action.action_payload?.name
                    ? `Created lead: ${action.action_payload.name} — ${action.action_payload.intent}`
                    : action.action_type === "trigger_escalation" && action.action_payload?.reason
                    ? `Escalation: ${action.action_payload.reason}`
                    : JSON.stringify(action.action_payload).substring(0, 80)
                  }
                </p>

                <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-700">
                  <Clock size={9} />
                  {timeAgo(action.created_at)}
                  {action.caller_phone && (
                    <>
                      <span>·</span>
                      <Phone size={9} />
                      {action.caller_phone}
                    </>
                  )}
                  {action.client_name && (
                    <>
                      <span>·</span>
                      <User size={9} />
                      {action.client_name}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Stats Tab ────────────────────────────────────────────── */

function StatsTab({ stats }: { stats: AiCallStats }) {
  const aiResolveRate = stats.total_calls > 0
    ? Math.round((stats.ai_handled / stats.total_calls) * 100)
    : 0;

  const cards = [
    { label: "Total Calls", value: stats.total_calls, icon: Phone, color: "zinc" },
    { label: "AI Handled", value: stats.ai_handled, icon: Bot, color: "emerald" },
    { label: "Human Handled", value: stats.human_handled, icon: User, color: "blue" },
    { label: "Missed", value: stats.missed, icon: PhoneMissed, color: "rose" },
    { label: "Voicemails", value: stats.voicemails, icon: Voicemail, color: "amber" },
    { label: "Avg Duration", value: `${formatDuration(stats.avg_duration)}`, icon: Clock, color: "zinc" },
    { label: "AI Reschedules", value: stats.reschedules, icon: Calendar, color: "blue" },
    { label: "Leads Created", value: stats.leads_created, icon: UserPlus, color: "violet" },
    { label: "Messages Saved", value: stats.messages_saved, icon: MessageSquare, color: "amber" },
    { label: "Escalations", value: stats.escalations, icon: AlertTriangle, color: "rose" },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* AI Resolve Rate */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              AI Resolution Rate
            </p>
            <p className="mt-1 text-[32px] font-bold tracking-tight text-emerald-400">
              {aiResolveRate}%
            </p>
            <p className="text-[11px] text-zinc-500">
              of inbound calls resolved autonomously
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-emerald-500/20 bg-emerald-500/5">
            <Bot size={24} className="text-emerald-400" />
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${Math.min(100, aiResolveRate)}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4"
          >
            <div className="flex items-center gap-2">
              <Icon size={13} className={`text-${color}-400/70`} />
              <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                {label}
              </span>
            </div>
            <p className={`mt-2 text-[20px] font-bold text-${color}-400`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Call Detail Panel ────────────────────────────────────── */

function CallDetail({
  call,
  transcript,
  onClose,
}: {
  call: CallHistoryEntry;
  transcript: Record<string, any> | null;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          {call.ai_handled ? (
            <Bot size={14} className="text-emerald-400" />
          ) : (
            <Phone size={14} className="text-zinc-400" />
          )}
          <span className="text-[13px] font-semibold text-white">
            {call.client_name || call.from_number || "Unknown"}
          </span>
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-600 hover:text-white transition">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Call Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Direction</span>
            <span className="text-white capitalize">{call.direction}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Status</span>
            <span className="text-white capitalize">{call.status?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Duration</span>
            <span className="text-white">{formatDuration(call.duration_seconds)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">From</span>
            <span className="font-mono text-white text-[10px]">{call.from_number}</span>
          </div>
          {call.ai_handled && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Handled By</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Bot size={11} /> AI Receptionist
              </span>
            </div>
          )}
          {call.sentiment_score !== null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Sentiment</span>
              <span className={`${
                (call.sentiment_score ?? 0) > 0.6 ? "text-emerald-400" :
                (call.sentiment_score ?? 0) > 0.3 ? "text-amber-400" : "text-rose-400"
              }`}>
                {Math.round((call.sentiment_score ?? 0) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* AI Summary */}
        {call.ai_summary && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={11} className="text-emerald-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                AI Summary
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {call.ai_summary}
            </p>
          </div>
        )}

        {/* Recording */}
        {call.recording_url && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Play size={11} className="text-blue-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Recording
              </span>
            </div>
            <audio
              controls
              className="w-full h-8 [&::-webkit-media-controls-panel]:bg-zinc-900"
              src={call.recording_url}
            />
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={11} className="text-violet-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Transcript
              </span>
            </div>
            {transcript.transcript_jsonb?.segments ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {(transcript.transcript_jsonb.segments as Array<{ role: string; content: string }>).map(
                  (seg, i) => (
                    <div key={i} className={`flex gap-2 ${seg.role === "agent" ? "pl-4" : ""}`}>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        seg.role === "agent" ? "bg-emerald-500/10" : "bg-zinc-800"
                      }`}>
                        {seg.role === "agent" ? (
                          <Bot size={10} className="text-emerald-400" />
                        ) : (
                          <User size={10} className="text-zinc-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{seg.content}</p>
                    </div>
                  )
                )}
              </div>
            ) : transcript.ai_transcript ? (
              <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {transcript.ai_transcript}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-600 italic">No transcript available</p>
            )}
          </div>
        )}

        {/* AI Actions */}
        {transcript?.ai_actions_taken && transcript.ai_actions_taken.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield size={11} className="text-amber-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                AI Actions ({transcript.ai_actions_taken.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {(transcript.ai_actions_taken as Array<Record<string, any>>).map((action, i) => {
                const Icon = ACTION_ICONS[action.function] || Sparkles;
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <Icon size={10} className="text-zinc-500" />
                    <span className="text-zinc-400 capitalize">{action.function?.replace(/_/g, " ")}</span>
                    {action.result?.success && (
                      <span className="text-emerald-400">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
