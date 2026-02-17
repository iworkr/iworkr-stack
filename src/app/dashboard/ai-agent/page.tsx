"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Phone,
  Clock,
  Brain,
  PhoneForwarded,
  Volume2,
  Mic,
  Play,
  Pause,
  ChevronDown,
  Settings,
  Loader2,
  PhoneIncoming,
  PhoneOff,
  Calendar,
  MessageCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getAgentConfig,
  upsertAgentConfig,
  getAgentCalls,
  type AIAgentConfig,
  type AIAgentCall,
} from "@/app/actions/ai-agent";

/* ── Voice Options ────────────────────────────────────── */
const VOICES = [
  { id: "american_female", label: "American Female", desc: "Warm, professional" },
  { id: "american_male", label: "American Male", desc: "Clear, authoritative" },
  { id: "australian_female", label: "Australian Female", desc: "Friendly, approachable" },
  { id: "australian_male", label: "Australian Male", desc: "Relaxed, natural" },
  { id: "british_female", label: "British Female", desc: "Polished, articulate" },
  { id: "british_male", label: "British Male", desc: "Refined, trustworthy" },
];

/* ── Outcome config ───────────────────────────────────── */
const OUTCOME_CONFIG: Record<string, { icon: typeof Phone; label: string; color: string; bg: string }> = {
  booked: { icon: Calendar, label: "Booked", color: "text-[#00E676]", bg: "bg-[#00E676]/10" },
  message: { icon: MessageCircle, label: "Message", color: "text-sky-400", bg: "bg-sky-400/10" },
  transferred: { icon: PhoneForwarded, label: "Transferred", color: "text-amber-400", bg: "bg-amber-400/10" },
  abandoned: { icon: PhoneOff, label: "Abandoned", color: "text-zinc-500", bg: "bg-zinc-500/10" },
  voicemail: { icon: Mic, label: "Voicemail", color: "text-purple-400", bg: "bg-purple-400/10" },
};

export default function AIAgentPage() {
  const { currentOrg } = useAuthStore();
  const org = currentOrg;
  const [activeTab, setActiveTab] = useState<"config" | "calls">("config");
  const [config, setConfig] = useState<AIAgentConfig | null>(null);
  const [calls, setCalls] = useState<AIAgentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transcriptCallId, setTranscriptCallId] = useState<string | null>(null);

  // Local config edits
  const [enabled, setEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState("american_female");
  const [hoursMode, setHoursMode] = useState<"after_hours" | "24_7" | "custom">("after_hours");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [greeting, setGreeting] = useState("Thank you for calling. How can I help you today?");
  const [escalationNumber, setEscalationNumber] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(true);

  const loadData = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);

    const [configRes, callsRes] = await Promise.all([
      getAgentConfig(org.id),
      getAgentCalls(org.id),
    ]);

    if (configRes.data) {
      const c = configRes.data;
      setConfig(c);
      setEnabled(c.enabled);
      setVoiceId(c.voice_id);
      setHoursMode(c.business_hours_mode);
      setKnowledgeBase(c.knowledge_base);
      setGreeting(c.greeting_message);
      setEscalationNumber(c.escalation_number || "");
      setBookingEnabled(c.booking_enabled);
    }

    setCalls(callsRes.data || []);
    setLoading(false);
  }, [org?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!org?.id) return;
    setSaving(true);
    await upsertAgentConfig(org.id, {
      enabled,
      voice_id: voiceId,
      business_hours_mode: hoursMode,
      knowledge_base: knowledgeBase,
      greeting_message: greeting,
      escalation_number: escalationNumber || null,
      booking_enabled: bookingEnabled,
    });
    setSaving(false);
  };

  const transcriptCall = transcriptCallId ? calls.find((c) => c.id === transcriptCallId) : null;

  // Stats
  const totalCalls = calls.length;
  const bookedCalls = calls.filter((c) => c.outcome === "booked").length;
  const avgDuration = totalCalls > 0
    ? Math.round(calls.reduce((sum, c) => sum + c.duration_seconds, 0) / totalCalls)
    : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-5 pb-0 pt-4 md:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E676] to-[#00C853]">
              <Bot size={18} className="text-black" />
            </div>
            <div>
              <h1 className="text-[15px] font-medium text-zinc-200">AI Phone Agent</h1>
              <p className="text-[11px] text-zinc-600">Your 24/7 virtual receptionist</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Agent status */}
            <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-1.5">
              <span className={`relative flex h-[6px] w-[6px]`}>
                {enabled ? (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E676] opacity-40" />
                    <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#00E676]" />
                  </>
                ) : (
                  <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-zinc-600" />
                )}
              </span>
              <span className="text-[11px] text-zinc-400">{enabled ? "Active" : "Disabled"}</span>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-[#00E676] to-[#00C853] px-3 py-1.5 text-[12px] font-semibold text-black transition-all hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)] disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
              Save Changes
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {[
            { id: "config" as const, label: "Configuration", icon: Settings },
            { id: "calls" as const, label: "Call Logs", icon: Phone },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {tab.id === "calls" && totalCalls > 0 && (
                  <span className="ml-1 rounded-full bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[9px] text-zinc-500">
                    {totalCalls}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="ai-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          {activeTab === "config" ? (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto max-w-2xl space-y-6"
            >
              {/* Master Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00E676]/10">
                    <Phone size={18} className="text-[#00E676]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">Enable AI Agent</p>
                    <p className="text-[11px] text-zinc-600">Forward calls to your AI receptionist</p>
                  </div>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-[#00E676]" : "bg-zinc-800"}`}
                >
                  <motion.div
                    animate={{ x: enabled ? 22 : 3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Voice Selector */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Volume2 size={14} className="text-zinc-500" />
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Voice</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVoiceId(v.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        voiceId === v.id
                          ? "border-[#00E676]/30 bg-[#00E676]/5"
                          : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)]"
                      }`}
                    >
                      <p className={`text-[12px] font-medium ${voiceId === v.id ? "text-[#00E676]" : "text-zinc-300"}`}>
                        {v.label}
                      </p>
                      <p className="text-[10px] text-zinc-600">{v.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Hours */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-zinc-500" />
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Availability</h3>
                </div>
                <div className="flex gap-2">
                  {([
                    { id: "after_hours" as const, label: "After Hours Only" },
                    { id: "24_7" as const, label: "24/7" },
                    { id: "custom" as const, label: "Custom Schedule" },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setHoursMode(opt.id)}
                      className={`rounded-lg border px-4 py-2 text-[12px] font-medium transition-all ${
                        hoursMode === opt.id
                          ? "border-[#00E676]/30 bg-[#00E676]/5 text-[#00E676]"
                          : "border-[rgba(255,255,255,0.06)] text-zinc-400 hover:border-[rgba(255,255,255,0.15)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Knowledge Base */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Brain size={14} className="text-zinc-500" />
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Knowledge Base</h3>
                </div>
                <p className="mb-2 text-[11px] text-zinc-600">
                  Tell the AI about your business rules (e.g., services you offer, areas you cover, pricing guidelines).
                </p>
                <textarea
                  value={knowledgeBase}
                  onChange={(e) => setKnowledgeBase(e.target.value)}
                  rows={5}
                  placeholder="We're a plumbing company based in Brisbane. We cover residential and commercial plumbing in the greater Brisbane area. We don't do commercial roofing..."
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>

              {/* Greeting */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Mic size={14} className="text-zinc-500" />
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Greeting</h3>
                </div>
                <input
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-[12px] text-zinc-300 outline-none transition-colors focus:border-[#00E676]/30"
                />
              </div>

              {/* Escalation & Booking */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <PhoneForwarded size={14} className="text-zinc-500" />
                    <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Escalation</h3>
                  </div>
                  <label className="mb-1 block text-[10px] text-zinc-600">Emergency transfer number</label>
                  <input
                    type="tel"
                    value={escalationNumber}
                    onChange={(e) => setEscalationNumber(e.target.value)}
                    placeholder="+61 400 000 000"
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-[12px] text-zinc-300 placeholder-zinc-700 outline-none transition-colors focus:border-[#00E676]/30"
                  />
                </div>
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar size={14} className="text-zinc-500" />
                    <h3 className="text-[12px] font-medium uppercase tracking-wider text-zinc-500">Booking</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-zinc-400">Allow AI to book jobs</p>
                    <button
                      onClick={() => setBookingEnabled(!bookingEnabled)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${bookingEnabled ? "bg-[#00E676]" : "bg-zinc-800"}`}
                    >
                      <motion.div
                        animate={{ x: bookingEnabled ? 16 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="calls"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Calls", value: totalCalls, icon: PhoneIncoming, color: "text-sky-400" },
                  { label: "Booked", value: bookedCalls, icon: Calendar, color: "text-[#00E676]" },
                  { label: "Avg Duration", value: `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, "0")}`, icon: Clock, color: "text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="flex items-center gap-2">
                      <stat.icon size={14} className={stat.color} />
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600">{stat.label}</span>
                    </div>
                    <p className="mt-2 text-[20px] font-semibold text-zinc-200">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Call log table */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
                <div className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-2">
                  <div className="flex items-center">
                    <span className="w-48 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Caller</span>
                    <span className="w-24 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Duration</span>
                    <span className="w-28 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Outcome</span>
                    <span className="flex-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Summary</span>
                    <span className="w-36 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Time</span>
                  </div>
                </div>

                {calls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Phone size={24} className="mb-2 text-zinc-800" />
                    <p className="text-[12px] text-zinc-600">No calls yet</p>
                    <p className="mt-0.5 text-[10px] text-zinc-700">Calls handled by the AI agent will appear here.</p>
                  </div>
                ) : (
                  calls.map((call, i) => {
                    const outcomeConf = OUTCOME_CONFIG[call.outcome] || OUTCOME_CONFIG.message;
                    const OutcomeIcon = outcomeConf.icon;
                    return (
                      <motion.button
                        key={call.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => setTranscriptCallId(call.id)}
                        className="flex w-full items-center border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <div className="w-48">
                          <p className="text-[12px] text-zinc-300">{call.caller_name || "Unknown"}</p>
                          <p className="text-[10px] text-zinc-600">{call.caller_number || "—"}</p>
                        </div>
                        <span className="w-24 font-mono text-[11px] text-zinc-500">
                          {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}
                        </span>
                        <div className="w-28">
                          <span className={`inline-flex items-center gap-1 rounded-full ${outcomeConf.bg} px-2 py-0.5 text-[10px] font-medium ${outcomeConf.color}`}>
                            <OutcomeIcon size={10} />
                            {outcomeConf.label}
                          </span>
                        </div>
                        <span className="flex-1 truncate text-[11px] text-zinc-500">{call.summary || "—"}</span>
                        <span className="w-36 text-[11px] text-zinc-600">
                          {new Date(call.created_at).toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transcript Drawer */}
      <AnimatePresence>
        {transcriptCall && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTranscriptCallId(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
            >
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
                <div>
                  <h2 className="text-[14px] font-medium text-zinc-200">Call Transcript</h2>
                  <p className="text-[11px] text-zinc-600">
                    {transcriptCall.caller_name || transcriptCall.caller_number} &middot;{" "}
                    {Math.floor(transcriptCall.duration_seconds / 60)}:{String(transcriptCall.duration_seconds % 60).padStart(2, "0")}
                  </p>
                </div>
                <button
                  onClick={() => setTranscriptCallId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {transcriptCall.transcript ? (
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-400">
                    {transcriptCall.transcript}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Mic size={20} className="mb-2 text-zinc-800" />
                    <p className="text-[12px] text-zinc-600">No transcript available</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
