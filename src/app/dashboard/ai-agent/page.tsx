"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  ChevronRight,
  Settings,
  Loader2,
  PhoneIncoming,
  PhoneOff,
  Calendar,
  MessageCircle,
  TrendingUp,
  X,
  Search,
  FileText,
  Plus,
  Trash2,
  Upload,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Radio,
  Zap,
  PhoneCall,
  Type,
  File,
  GripVertical,
  Power,
  Activity,
  Smile,
  Meh,
  Frown,
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
  { id: "american_female", label: "American Female", accent: "US", desc: "Warm, professional" },
  { id: "american_male", label: "American Male", accent: "US", desc: "Clear, authoritative" },
  { id: "australian_female", label: "Australian Female", accent: "AU", desc: "Friendly, approachable" },
  { id: "australian_male", label: "Australian Male", accent: "AU", desc: "Relaxed, natural" },
  { id: "british_female", label: "British Female", accent: "UK", desc: "Polished, articulate" },
  { id: "british_male", label: "British Male", accent: "UK", desc: "Refined, trustworthy" },
];

/* ── Outcome config ───────────────────────────────────── */

const OUTCOME_CONFIG: Record<string, { icon: typeof Phone; label: string; color: string; bg: string; border: string }> = {
  booked: { icon: Calendar, label: "Booked", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  message: { icon: MessageCircle, label: "Message", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  transferred: { icon: PhoneForwarded, label: "Transferred", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  abandoned: { icon: PhoneOff, label: "Abandoned", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  voicemail: { icon: Mic, label: "Voicemail", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
};

/* ── Sentiment config ──────────────────────────────────── */

const SENTIMENT_CONFIG: Record<string, { icon: typeof Smile; color: string }> = {
  positive: { icon: Smile, color: "text-emerald-400" },
  neutral: { icon: Meh, color: "text-zinc-500" },
  negative: { icon: Frown, color: "text-rose-400" },
};

/* ── Waveform visualizer ───────────────────────────────── */

function NeuralWaveform({ active, className = "" }: { active: boolean; className?: string }) {
  const bars = 12;
  return (
    <div className={`flex items-end gap-[2px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-[2px] rounded-full ${active ? "bg-gradient-to-t from-purple-500 to-emerald-400" : "bg-zinc-700"}`}
          animate={active ? {
            height: [4, 8 + Math.random() * 12, 4, 10 + Math.random() * 8, 4],
          } : { height: 4 }}
          transition={active ? {
            duration: 0.8 + Math.random() * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.05,
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

/* ── Animated counter ──────────────────────────────────── */

function AnimatedStat({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${prefix}${Math.round(v)}${suffix}`);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on("change", setDisplay);
    return () => { controls.stop(); unsub(); };
  }, [value, mv, rounded, prefix, suffix]);

  return <span>{display}</span>;
}

/* ── Mock knowledge items ──────────────────────────────── */

interface KnowledgeItem {
  id: string;
  type: "text" | "file";
  title: string;
  content: string;
  enabled: boolean;
}

const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  { id: "k1", type: "text", title: "Call-out Fee", content: "We charge $120 call-out fee for all residential jobs within Brisbane metro.", enabled: true },
  { id: "k2", type: "text", title: "Service Area", content: "We cover greater Brisbane, Gold Coast, and Sunshine Coast. No Toowoomba.", enabled: true },
  { id: "k3", type: "text", title: "Emergency Protocol", content: "For burst pipes or gas leaks, escalate immediately to the on-call technician.", enabled: true },
  { id: "k4", type: "file", title: "Pricing Guide 2026.pdf", content: "Full pricing breakdown for residential and commercial services.", enabled: true },
  { id: "k5", type: "text", title: "Operating Hours", content: "Mon-Fri 7am-5pm, Sat 8am-12pm, Closed Sunday. AI handles after hours.", enabled: false },
];

/* ── Neural Empty State ────────────────────────────────── */

function NeuralEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.04] blur-[50px]" />
      <div className="relative mb-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-signal-pulse" />
          <div className="absolute inset-2 rounded-lg border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
          <motion.div
            className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"
            animate={{ top: ["25%", "75%", "25%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-purple-500/30">
              <div className="h-1 w-1 rounded-full bg-purple-400" />
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Bot size={16} strokeWidth={1.5} className="text-zinc-600" />
          </div>
        </div>
      </div>
      <h3 className="text-[13px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[240px] text-[11px] text-zinc-600">{subtitle}</p>
    </motion.div>
  );
}

/* ── Test Call Modal ───────────────────────────────────── */

function TestCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [state, setState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");

  useEffect(() => {
    if (open) { setState("idle"); setPhoneNumber(""); }
  }, [open]);

  const handleCall = () => {
    if (!phoneNumber) return;
    setState("dialing");
    setTimeout(() => setState("connected"), 3000);
    setTimeout(() => setState("ended"), 8000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[380px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 shadow-[0_40px_80px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500 shadow-lg">
                  <PhoneCall size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[13px] font-medium text-white">Test Agent</h2>
                  <p className="text-[10px] text-zinc-600">Simulate a live call</p>
                </div>
              </div>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400">
                <X size={13} />
              </button>
            </div>

            <div className="px-5 py-5">
              {state === "idle" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">Phone Number</label>
                    <div className="relative">
                      <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+61 400 000 000"
                        className="w-full rounded-xl border border-white/[0.06] bg-zinc-900/30 py-2.5 pl-8 pr-3 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-purple-500/30 focus:shadow-[0_0_0_1px_rgba(168,85,247,0.05)]"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCall}
                    disabled={!phoneNumber}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-emerald-500 py-2.5 text-[12px] font-medium text-white shadow-lg transition-all hover:shadow-purple-500/20 disabled:opacity-40"
                  >
                    <Phone size={13} /> Call Me
                  </button>
                </motion.div>
              )}

              {state === "dialing" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6">
                  <motion.div
                    animate={{ rotate: [-5, 5, -5, 5, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-emerald-500 shadow-xl"
                  >
                    <Phone size={22} className="text-white" />
                  </motion.div>
                  <p className="text-[13px] font-medium text-white">Dialing...</p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">{phoneNumber}</p>
                  <NeuralWaveform active className="mt-4" />
                </motion.div>
              )}

              {state === "connected" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6">
                  <div className="relative mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-xl">
                      <Phone size={22} className="text-white" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl bg-emerald-500"
                    />
                  </div>
                  <p className="text-[13px] font-medium text-emerald-400">Connected</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Your AI agent is speaking</p>
                  <NeuralWaveform active className="mt-4" />
                </motion.div>
              )}

              {state === "ended" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
                    <PhoneOff size={22} className="text-zinc-500" />
                  </div>
                  <p className="text-[13px] font-medium text-zinc-300">Call Ended</p>
                  <p className="mt-1 text-[11px] text-zinc-600">Simulation complete</p>
                  <button
                    onClick={onClose}
                    className="mt-4 rounded-xl bg-white/[0.06] px-4 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.1]"
                  >
                    Close
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Page ───────────────────────────────────────────────── */

type AgentTab = "config" | "knowledge" | "calls";

export default function AIAgentPage() {
  const { currentOrg } = useAuthStore();
  const org = currentOrg;
  const [activeTab, setActiveTab] = useState<AgentTab>("config");
  const [config, setConfig] = useState<AIAgentConfig | null>(null);
  const [calls, setCalls] = useState<AIAgentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testCallOpen, setTestCallOpen] = useState(false);
  const [transcriptCallId, setTranscriptCallId] = useState<string | null>(null);
  const [hoveredVoice, setHoveredVoice] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState("american_female");
  const [hoursMode, setHoursMode] = useState<"after_hours" | "24_7" | "custom">("after_hours");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [greeting, setGreeting] = useState("Thank you for calling. How can I help you today?");
  const [escalationNumber, setEscalationNumber] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(true);

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newKnowledgeType, setNewKnowledgeType] = useState<"text" | "file">("text");
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState("");
  const [newKnowledgeContent, setNewKnowledgeContent] = useState("");

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

  const markDirty = () => setDirty(true);

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
    setDirty(false);
  };

  const addKnowledgeItem = () => {
    if (!newKnowledgeTitle) return;
    setKnowledgeItems((prev) => [
      ...prev,
      {
        id: `k-${Date.now()}`,
        type: newKnowledgeType,
        title: newKnowledgeTitle,
        content: newKnowledgeContent,
        enabled: true,
      },
    ]);
    setNewKnowledgeTitle("");
    setNewKnowledgeContent("");
    setShowAddKnowledge(false);
    markDirty();
  };

  const removeKnowledgeItem = (id: string) => {
    setKnowledgeItems((prev) => prev.filter((k) => k.id !== id));
    markDirty();
  };

  const toggleKnowledgeItem = (id: string) => {
    setKnowledgeItems((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k))
    );
    markDirty();
  };

  const transcriptCall = transcriptCallId ? calls.find((c) => c.id === transcriptCallId) : null;

  const totalCalls = calls.length;
  const bookedCalls = calls.filter((c) => c.outcome === "booked").length;
  const avgDuration = totalCalls > 0
    ? Math.round(calls.reduce((sum, c) => sum + c.duration_seconds, 0) / totalCalls)
    : 0;

  const tabs: { id: AgentTab; label: string; icon: typeof Settings }[] = [
    { id: "config", label: "Configuration", icon: Settings },
    { id: "knowledge", label: "Knowledge Base", icon: Brain },
    { id: "calls", label: "Call Logs", icon: Phone },
  ];

  if (loading) {
    return <AIAgentSkeleton />;
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Neural Link Header ────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRight size={10} className="text-zinc-700" />
              <span className="font-medium text-white">AI Agent</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* System Status Pill */}
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1">
              {enabled ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <motion.span
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-full bg-emerald-500"
                    />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-medium text-emerald-400">System Online</span>
                  <NeuralWaveform active className="ml-1 h-3" />
                </>
              ) : (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="text-[10px] font-medium text-zinc-500">Standby</span>
                </>
              )}
            </div>

            {/* Test Agent */}
            <button
              onClick={() => setTestCallOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-zinc-500 transition-all hover:bg-white/[0.03] hover:text-zinc-300"
            >
              <PhoneCall size={12} />
              Test Agent
            </button>

            {/* Save */}
            <AnimatePresence>
              {dirty && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  Save Changes
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tabs — Sliding Pill */}
        <div className="flex items-center px-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-3 py-2"
              >
                <span className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${isActive ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                  <Icon size={12} />
                  {tab.label}
                  {tab.id === "calls" && totalCalls > 0 && (
                    <span className="ml-0.5 rounded-md bg-white/[0.05] px-1 py-0.5 text-[8px] font-bold text-zinc-600">{totalCalls}</span>
                  )}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="ai-tab-pill"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5">
        <AnimatePresence mode="wait">
          {/* ─── CONFIGURATION TAB ──────────────────────── */}
          {activeTab === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-2xl space-y-5"
            >
              {/* Master Toggle */}
              <div className="flex items-center justify-between rounded-2xl bg-zinc-900/30 p-5 transition-colors hover:bg-zinc-900/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500 shadow-lg">
                    <Power size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white">Enable AI Agent</p>
                    <p className="text-[11px] text-zinc-600">Forward calls to your AI receptionist</p>
                  </div>
                </div>
                <button
                  onClick={() => { setEnabled(!enabled); markDirty(); }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-zinc-800"}`}
                >
                  <motion.div
                    animate={{ x: enabled ? 22 : 3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              {/* Voice Selector */}
              <motion.div
                animate={{ opacity: enabled ? 1 : 0.5, filter: enabled ? "none" : "grayscale(60%)" }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl bg-zinc-900/30 p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Volume2 size={13} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Voice</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {VOICES.map((v) => {
                    const isSelected = voiceId === v.id;
                    const isHovered = hoveredVoice === v.id;
                    return (
                      <motion.button
                        key={v.id}
                        onClick={() => { setVoiceId(v.id); markDirty(); }}
                        onMouseEnter={() => setHoveredVoice(v.id)}
                        onMouseLeave={() => setHoveredVoice(null)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative overflow-hidden rounded-xl p-3 text-left transition-all duration-300 ${
                          isSelected
                            ? "bg-gradient-to-br from-purple-500/10 to-emerald-500/10 shadow-[0_0_20px_-4px_rgba(168,85,247,0.15)]"
                            : "bg-white/[0.02] hover:bg-white/[0.04]"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 rounded-xl border border-emerald-500/20" />
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-[11px] font-medium ${isSelected ? "text-white" : "text-zinc-300"}`}>
                              {v.label}
                            </p>
                            <p className="text-[9px] text-zinc-600">{v.desc}</p>
                          </div>
                          <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold ${
                            isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.04] text-zinc-600"
                          }`}>
                            {v.accent}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <NeuralWaveform active={isSelected || isHovered} className="h-3" />
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"
                            >
                              <Activity size={8} className="text-white" />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Greeting */}
              <motion.div
                animate={{ opacity: enabled ? 1 : 0.5 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl bg-zinc-900/30 p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Mic size={13} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Greeting</h3>
                </div>
                <div className="relative">
                  <motion.div
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-gradient-to-b from-purple-500 to-emerald-500"
                    initial={false}
                    animate={{ opacity: 0 }}
                    whileFocus={{ opacity: 1 }}
                  />
                  <input
                    type="text"
                    value={greeting}
                    onChange={(e) => { setGreeting(e.target.value); markDirty(); }}
                    className="w-full rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-2.5 text-[12px] text-zinc-300 outline-none transition-all focus:border-purple-500/20 focus:shadow-[0_0_0_1px_rgba(168,85,247,0.05)]"
                  />
                </div>
              </motion.div>

              {/* Behavior Grid */}
              <motion.div
                animate={{ opacity: enabled ? 1 : 0.5 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-3 gap-3"
              >
                {/* Availability */}
                <div className="rounded-2xl bg-zinc-900/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock size={12} className="text-zinc-500" />
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Availability</h3>
                  </div>
                  <div className="space-y-1.5">
                    {([
                      { id: "after_hours" as const, label: "After Hours" },
                      { id: "24_7" as const, label: "24/7" },
                      { id: "custom" as const, label: "Custom" },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setHoursMode(opt.id); markDirty(); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-medium transition-all ${
                          hoursMode === opt.id
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                        }`}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full ${hoursMode === opt.id ? "bg-emerald-500" : "bg-zinc-700"}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Escalation */}
                <div className="rounded-2xl bg-zinc-900/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <PhoneForwarded size={12} className="text-zinc-500" />
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Escalation</h3>
                  </div>
                  <label className="mb-1 block text-[9px] text-zinc-600">Transfer number</label>
                  <input
                    type="tel"
                    value={escalationNumber}
                    onChange={(e) => { setEscalationNumber(e.target.value); markDirty(); }}
                    placeholder="+61 400 000 000"
                    className="w-full rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-purple-500/20"
                  />
                </div>

                {/* Booking */}
                <div className="rounded-2xl bg-zinc-900/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar size={12} className="text-zinc-500" />
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Booking</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-400">Allow AI to book</p>
                    <button
                      onClick={() => { setBookingEnabled(!bookingEnabled); markDirty(); }}
                      className={`relative h-5 w-9 rounded-full transition-colors ${bookingEnabled ? "bg-emerald-500" : "bg-zinc-800"}`}
                    >
                      <motion.div
                        animate={{ x: bookingEnabled ? 16 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ─── KNOWLEDGE BASE TAB ─────────────────────── */}
          {activeTab === "knowledge" && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-2xl space-y-4"
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-medium text-white">Training Data</h2>
                  <p className="text-[10px] text-zinc-600">{knowledgeItems.filter((k) => k.enabled).length} of {knowledgeItems.length} active knowledge blocks</p>
                </div>
                <button
                  onClick={() => setShowAddKnowledge(true)}
                  className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500"
                >
                  <Plus size={12} /> Add Knowledge
                </button>
              </div>

              {/* Add Knowledge Form */}
              <AnimatePresence>
                {showAddKnowledge && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-4 space-y-3">
                      {/* Type selector */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNewKnowledgeType("text")}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                            newKnowledgeType === "text"
                              ? "bg-purple-500/10 text-purple-400"
                              : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Type size={11} /> Text Snippet
                        </button>
                        <button
                          onClick={() => setNewKnowledgeType("file")}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                            newKnowledgeType === "file"
                              ? "bg-purple-500/10 text-purple-400"
                              : "bg-white/[0.03] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Upload size={11} /> File Upload
                        </button>
                      </div>

                      {/* Fields */}
                      <input
                        type="text"
                        value={newKnowledgeTitle}
                        onChange={(e) => setNewKnowledgeTitle(e.target.value)}
                        placeholder={newKnowledgeType === "text" ? "e.g. Call-out Fee Policy" : "e.g. Pricing Guide 2026.pdf"}
                        className="w-full rounded-xl border border-white/[0.06] bg-zinc-900/30 px-3 py-2 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-purple-500/20"
                        autoFocus
                      />
                      {newKnowledgeType === "text" ? (
                        <textarea
                          value={newKnowledgeContent}
                          onChange={(e) => setNewKnowledgeContent(e.target.value)}
                          rows={3}
                          placeholder="Enter knowledge content..."
                          className="w-full rounded-xl border border-white/[0.06] bg-zinc-900/30 px-3 py-2 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-purple-500/20"
                        />
                      ) : (
                        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-white/[0.06] bg-zinc-900/20 py-6">
                          <div className="flex flex-col items-center gap-1.5">
                            <Upload size={18} className="text-zinc-600" />
                            <p className="text-[11px] text-zinc-500">Drag & drop or click to upload</p>
                            <p className="text-[9px] text-zinc-700">PDF, DOCX (max 10MB)</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={addKnowledgeItem}
                          disabled={!newKnowledgeTitle}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 disabled:opacity-40"
                        >
                          <Plus size={10} /> Add
                        </button>
                        <button
                          onClick={() => setShowAddKnowledge(false)}
                          className="text-[10px] text-zinc-600 hover:text-zinc-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Knowledge List */}
              {knowledgeItems.length === 0 ? (
                <NeuralEmptyState title="No training data" subtitle="Add knowledge blocks to teach your AI agent about your business." />
              ) : (
                <div className="space-y-1.5">
                  {knowledgeItems.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`group flex items-center gap-3 rounded-xl p-3 transition-all ${
                        item.enabled ? "bg-zinc-900/30 hover:bg-zinc-900/40" : "bg-zinc-900/15 opacity-60"
                      }`}
                    >
                      {/* Drag handle */}
                      <GripVertical size={12} className="shrink-0 cursor-grab text-zinc-700" />

                      {/* Type icon */}
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        item.type === "file" ? "bg-purple-500/10" : "bg-sky-500/10"
                      }`}>
                        {item.type === "file" ? (
                          <File size={12} className="text-purple-400" />
                        ) : (
                          <Type size={12} className="text-sky-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-zinc-200">{item.title}</p>
                        <p className="truncate text-[10px] text-zinc-600">{item.content}</p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleKnowledgeItem(item.id)}
                        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${item.enabled ? "bg-emerald-500" : "bg-zinc-800"}`}
                      >
                        <motion.div
                          animate={{ x: item.enabled ? 13 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-[2px] h-3 w-3 rounded-full bg-white shadow-sm"
                        />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => removeKnowledgeItem(item.id)}
                        className="shrink-0 rounded-md p-1 text-zinc-700 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Legacy Knowledge Base */}
              <div className="rounded-2xl bg-zinc-900/30 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Brain size={13} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Legacy Knowledge</h3>
                  <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[8px] text-zinc-600">Optional</span>
                </div>
                <p className="mb-2 text-[10px] text-zinc-600">
                  Additional context for your AI (rules, edge cases, nuances).
                </p>
                <textarea
                  value={knowledgeBase}
                  onChange={(e) => { setKnowledgeBase(e.target.value); markDirty(); }}
                  rows={4}
                  placeholder="e.g. We don't do commercial roofing. Max travel distance is 50km..."
                  className="w-full rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-purple-500/20"
                />
              </div>
            </motion.div>
          )}

          {/* ─── CALL LOGS TAB ──────────────────────────── */}
          {activeTab === "calls" && (
            <motion.div
              key="calls"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Calls", value: totalCalls, icon: PhoneIncoming, gradient: "from-sky-500/10 to-sky-500/[0.02]" },
                  { label: "Booked", value: bookedCalls, icon: Calendar, gradient: "from-emerald-500/10 to-emerald-500/[0.02]" },
                  { label: "Avg Duration", value: avgDuration, icon: Clock, gradient: "from-amber-500/10 to-amber-500/[0.02]", isDuration: true },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.gradient} p-4 transition-colors hover:brightness-110`}>
                    <div className="flex items-center gap-2">
                      <stat.icon size={13} className="text-zinc-500" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{stat.label}</span>
                    </div>
                    <p className="mt-2 font-mono text-[22px] font-semibold text-white">
                      {stat.isDuration
                        ? `${Math.floor(stat.value / 60)}:${String(stat.value % 60).padStart(2, "0")}`
                        : <AnimatedStat value={stat.value} />}
                    </p>
                  </div>
                ))}
              </div>

              {/* Call log table */}
              <div className="overflow-hidden rounded-2xl bg-zinc-900/30">
                <div className="border-b border-white/[0.03] px-4 py-2">
                  <div className="flex items-center">
                    <span className="w-48 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Caller</span>
                    <span className="w-20 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Duration</span>
                    <span className="w-24 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Outcome</span>
                    <span className="w-14 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Mood</span>
                    <span className="flex-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Summary</span>
                    <span className="w-32 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Time</span>
                  </div>
                </div>

                {calls.length === 0 ? (
                  <NeuralEmptyState title="No calls yet" subtitle="Calls handled by the AI agent will appear here." />
                ) : (
                  calls.map((call, i) => {
                    const outcomeConf = OUTCOME_CONFIG[call.outcome] || OUTCOME_CONFIG.message;
                    const OutcomeIcon = outcomeConf.icon;
                    const sentimentConf = SENTIMENT_CONFIG[call.sentiment] || SENTIMENT_CONFIG.neutral;
                    const SentimentIcon = sentimentConf.icon;
                    return (
                      <motion.button
                        key={call.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => setTranscriptCallId(call.id)}
                        className="group flex w-full items-center border-b border-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="w-48">
                          <p className="text-[12px] text-zinc-300">{call.caller_name || "Unknown"}</p>
                          <p className="font-mono text-[9px] text-zinc-600">{call.caller_number || "—"}</p>
                        </div>
                        <span className="w-20 font-mono text-[10px] text-zinc-500">
                          {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}
                        </span>
                        <div className="w-24">
                          <span className={`inline-flex items-center gap-1 rounded-md border ${outcomeConf.border} ${outcomeConf.bg} px-1.5 py-0.5 text-[9px] font-medium ${outcomeConf.color}`}>
                            <OutcomeIcon size={9} />
                            {outcomeConf.label}
                          </span>
                        </div>
                        <div className="w-14">
                          <SentimentIcon size={14} className={sentimentConf.color} />
                        </div>
                        <span className="flex-1 truncate text-[10px] text-zinc-500">{call.summary || "—"}</span>
                        <span className="w-32 text-[10px] text-zinc-600">
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

      {/* ── Transcript Drawer ──────────────────────────── */}
      <AnimatePresence>
        {transcriptCall && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTranscriptCallId(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-white/[0.06] bg-[#050505]"
            >
              {/* Header */}
              <div className="shrink-0 border-b border-white/[0.04] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500">
                      <Mic size={15} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-medium text-white">Call Transcript</h2>
                      <p className="text-[10px] text-zinc-600">
                        {transcriptCall.caller_name || transcriptCall.caller_number} &middot;{" "}
                        {Math.floor(transcriptCall.duration_seconds / 60)}:{String(transcriptCall.duration_seconds % 60).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTranscriptCallId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Audio Waveform Player */}
                {transcriptCall.recording_url && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-900/40 p-3">
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow">
                      <Play size={11} />
                    </button>
                    <div className="flex-1">
                      <div className="flex items-end gap-[1px]">
                        {Array.from({ length: 40 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-[3px] rounded-full bg-gradient-to-t from-purple-500/40 to-emerald-400/40"
                            style={{ height: `${4 + Math.random() * 16}px` }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="font-mono text-[9px] text-zinc-600">
                      {Math.floor(transcriptCall.duration_seconds / 60)}:{String(transcriptCall.duration_seconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                )}
              </div>

              {/* AI Summary */}
              {transcriptCall.summary && (
                <div className="shrink-0 border-b border-white/[0.04] px-5 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles size={10} className="text-purple-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">AI Summary</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">{transcriptCall.summary}</p>
                </div>
              )}

              {/* Transcript Content */}
              <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4">
                {transcriptCall.transcript ? (
                  <div className="space-y-3">
                    {transcriptCall.transcript.split("\n").filter(Boolean).map((line, i) => {
                      const isAgent = line.toLowerCase().startsWith("agent:") || line.toLowerCase().startsWith("ai:");
                      const content = line.replace(/^(agent|ai|caller|customer):\s*/i, "");
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                            isAgent
                              ? "bg-gradient-to-br from-purple-500/10 to-emerald-500/10 text-zinc-300"
                              : "bg-zinc-900/50 text-zinc-400"
                          }`}>
                            <p className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">
                              {isAgent ? "AI Agent" : "Caller"}
                            </p>
                            <p className="text-[11px] leading-relaxed">{content}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <NeuralEmptyState title="No transcript available" subtitle="Transcripts are generated after call completion." />
                )}
              </div>

              {/* Sentiment Footer */}
              <div className="shrink-0 border-t border-white/[0.04] bg-[#080808] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const sc = SENTIMENT_CONFIG[transcriptCall.sentiment] || SENTIMENT_CONFIG.neutral;
                      const SIcon = sc.icon;
                      return (
                        <>
                          <SIcon size={14} className={sc.color} />
                          <span className={`text-[10px] font-medium capitalize ${sc.color}`}>{transcriptCall.sentiment}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const oc = OUTCOME_CONFIG[transcriptCall.outcome] || OUTCOME_CONFIG.message;
                      const OIcon = oc.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-md border ${oc.border} ${oc.bg} px-2 py-0.5 text-[9px] font-medium ${oc.color}`}>
                          <OIcon size={9} />
                          {oc.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Test Call Modal ──────────────────────────────── */}
      <TestCallModal open={testCallOpen} onClose={() => setTestCallOpen(false)} />
    </div>
  );
}

/* ── Loading Skeleton ──────────────────────────────────── */

function AIAgentSkeleton() {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-900/50" />
            <div className="h-3 w-3 animate-pulse rounded bg-zinc-900/30" />
            <div className="h-3 w-14 animate-pulse rounded bg-zinc-900" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-24 animate-pulse rounded-lg bg-zinc-900/30" />
            <div className="h-7 w-20 animate-pulse rounded-lg bg-zinc-900/30" />
          </div>
        </div>
        <div className="flex items-center gap-1 px-5 pb-2">
          <div className="h-6 w-24 animate-pulse rounded bg-zinc-900/30" />
          <div className="h-6 w-28 animate-pulse rounded bg-zinc-900/20" />
          <div className="h-6 w-20 animate-pulse rounded bg-zinc-900/20" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-5">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Master toggle */}
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-900/30" />
          {/* Voice grid */}
          <div className="rounded-2xl bg-zinc-900/20 p-5">
            <div className="mb-3 h-3 w-12 animate-pulse rounded bg-zinc-800/40" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-900/30" style={{ opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          </div>
          {/* Greeting */}
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-900/20" />
          {/* Behavior grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/20" />
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/20" />
            <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
