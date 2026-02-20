"use client";

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Phone,
  Clock,
  Brain,
  PhoneForwarded,
  Volume2,
  Mic,
  ChevronLeft,
  Settings,
  Loader2,
  PhoneIncoming,
  PhoneOff,
  Calendar,
  MessageCircle,
  X,
  Plus,
  Trash2,
  Upload,
  Type,
  File,
  GripVertical,
  PhoneCall,
  Activity,
  Smile,
  Meh,
  Frown,
  Check,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import {
  getAgentConfig,
  upsertAgentConfig,
  getAgentCalls,
  type AIAgentConfig,
  type AIAgentCall,
} from "@/app/actions/ai-agent";

const VOICES = [
  { id: "american_female", label: "American Female", accent: "US", desc: "Warm, professional" },
  { id: "american_male", label: "American Male", accent: "US", desc: "Clear, authoritative" },
  { id: "australian_female", label: "Australian Female", accent: "AU", desc: "Friendly, approachable" },
  { id: "australian_male", label: "Australian Male", accent: "AU", desc: "Relaxed, natural" },
  { id: "british_female", label: "British Female", accent: "UK", desc: "Polished, articulate" },
  { id: "british_male", label: "British Male", accent: "UK", desc: "Refined, trustworthy" },
];

const OUTCOME_CONFIG: Record<string, { icon: typeof Phone; label: string; color: string; bg: string; border: string }> = {
  booked: { icon: Calendar, label: "Booked", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  message: { icon: MessageCircle, label: "Message", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  transferred: { icon: PhoneForwarded, label: "Transferred", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  abandoned: { icon: PhoneOff, label: "Abandoned", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  voicemail: { icon: Mic, label: "Voicemail", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
};

const SENTIMENT_CONFIG: Record<string, { icon: typeof Smile; color: string }> = {
  positive: { icon: Smile, color: "text-emerald-400" },
  neutral: { icon: Meh, color: "text-zinc-500" },
  negative: { icon: Frown, color: "text-rose-400" },
};

/* PRD 60: Violet waveform (AI semantic) */
function NeuralWaveform({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <div className={`flex items-end gap-[2px] ${className}`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-[2px] rounded-full ${active ? "bg-violet-500" : "bg-zinc-700"}`}
          animate={active ? { height: [4, 8 + Math.random() * 12, 4, 10 + Math.random() * 8, 4] } : { height: 4 }}
          transition={active ? { duration: 0.8 + Math.random() * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function AnimatedStat({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${prefix}${Math.round(v)}${suffix}`);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on("change", setDisplay);
    return () => { c.stop(); unsub(); };
  }, [value, mv, rounded, prefix, suffix]);
  return <span>{display}</span>;
}

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
  { id: "k4", type: "file", title: "Pricing_Guidelines_2026.pdf", content: "Full pricing breakdown for residential and commercial services.", enabled: true },
  { id: "k5", type: "text", title: "Business_Hours_Text_Snippet", content: "Mon-Fri 7am-5pm, Sat 8am-12pm, Closed Sunday. AI handles after hours.", enabled: false },
];

function NeuralEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col items-center justify-center py-16 text-center">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.04] blur-[50px]" />
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Bot size={16} className="text-zinc-600" />
      </div>
      <h3 className="text-[13px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[240px] text-[11px] text-zinc-600">{subtitle}</p>
    </motion.div>
  );
}

type AgentTab = "config" | "knowledge" | "calls";

export default function PhoneAgentPage() {
  const { currentOrg } = useAuthStore();
  const org = currentOrg;
  const [activeTab, setActiveTab] = useState<AgentTab>("config");
  const [config, setConfig] = useState<AIAgentConfig | null>(null);
  const [calls, setCalls] = useState<AIAgentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
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
    const [configRes, callsRes] = await Promise.all([getAgentConfig(org.id), getAgentCalls(org.id)]);
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
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const addKnowledgeItem = () => {
    if (!newKnowledgeTitle) return;
    setKnowledgeItems((prev) => [...prev, { id: `k-${Date.now()}`, type: newKnowledgeType, title: newKnowledgeTitle, content: newKnowledgeContent, enabled: true }]);
    setNewKnowledgeTitle("");
    setNewKnowledgeContent("");
    setShowAddKnowledge(false);
    markDirty();
  };

  const removeKnowledgeItem = (id: string) => { setKnowledgeItems((prev) => prev.filter((k) => k.id !== id)); markDirty(); };
  const toggleKnowledgeItem = (id: string) => { setKnowledgeItems((prev) => prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k))); markDirty(); };

  const transcriptCall = transcriptCallId ? calls.find((c) => c.id === transcriptCallId) : null;
  const totalCalls = calls.length;
  const bookedCalls = calls.filter((c) => c.outcome === "booked").length;
  const avgDuration = totalCalls > 0 ? Math.round(calls.reduce((s, c) => s + c.duration_seconds, 0) / totalCalls) : 0;

  const tabs: { id: AgentTab; label: string; icon: typeof Settings }[] = [
    { id: "config", label: "Configuration", icon: Settings },
    { id: "knowledge", label: "Knowledge Base", icon: Brain },
    { id: "calls", label: "Activity Logs", icon: Phone },
  ];

  const stealthInputClass = "w-full bg-transparent text-[12px] text-zinc-300 outline-none border-b border-transparent focus:border-violet-500 transition-[border-color] duration-150 py-1.5";

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-[#050505]">
        <div className="border-b border-white/5 bg-zinc-950/80 px-6 py-4">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-900/50" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-900/30" />
        </div>
        <div className="flex-1 px-6 py-5">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="h-20 animate-pulse rounded-xl bg-zinc-900/30" />
            <div className="h-40 animate-pulse rounded-xl bg-zinc-900/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* PRD 60: Detail header — Back + Title + iOS toggle (no big Enable block) */}
      <div className="sticky top-0 z-20 border-b border-white/5 bg-[#050505]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/ai-agent" className="flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white">
              <ChevronLeft size={14} /> AI Workforce
            </Link>
            <h1 className="font-display text-[18px] font-semibold text-white">AI Phone Receptionist</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500">{enabled ? "On" : "Off"}</span>
            <button
              onClick={() => { setEnabled(!enabled); markDirty(); }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-violet-500" : "bg-zinc-800"}`}
            >
              <motion.div animate={{ x: enabled ? 22 : 3 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm" />
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[11px] font-medium text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
            >
              {savedFeedback ? <><Check size={12} /> Saved</> : saving ? <Loader2 size={12} className="animate-spin" /> : <>Save Changes</>}
            </button>
          </div>
        </div>
        {/* Tabs — PRD 60: sliding pill, violet */}
        <div className="flex items-center gap-0.5 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative px-3 py-2.5">
                <span className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${isActive ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                  <Icon size={12} />
                  {tab.label}
                  {tab.id === "calls" && totalCalls > 0 && <span className="ml-0.5 rounded bg-white/5 px-1 font-mono text-[9px] text-zinc-500">{totalCalls}</span>}
                </span>
                {isActive && <motion.div layoutId="ai-phone-tab-pill" className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">
          {activeTab === "config" && (
            <motion.div key="config" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="mx-auto max-w-2xl space-y-5">
            {/* Voice — PRD 60: bg-zinc-950 border-white/5, hover violet glow, active border-violet-500 */}
            <div className="rounded-xl border border-white/5 bg-zinc-950 p-5">
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
                      className={`relative rounded-xl border p-3 text-left transition-all ${
                        isSelected ? "border-violet-500 bg-violet-500/5 shadow-[0_0_20px_-4px_rgba(139,92,246,0.2)]" : "border-white/5 bg-white/[0.02] hover:border-violet-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-[11px] font-medium ${isSelected ? "text-white" : "text-zinc-300"}`}>{v.label}</p>
                          <p className="text-[9px] text-zinc-600">{v.desc}</p>
                        </div>
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${isSelected ? "bg-violet-500/20 text-violet-400" : "bg-white/[0.04] text-zinc-600"}`}>{v.accent}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <NeuralWaveform active={isSelected || isHovered} className="h-3" />
                        {isSelected && <Activity size={12} className="text-violet-400" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Greeting — PRD 60: Stealth input, border-b border-violet-500 on focus */}
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Mic size={13} className="text-zinc-500" />
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Greeting</h3>
              </div>
              <input
                type="text"
                value={greeting}
                onChange={(e) => { setGreeting(e.target.value); markDirty(); }}
                className={stealthInputClass}
                placeholder="Thank you for calling..."
              />
            </div>

            {/* Availability, Escalation, Booking — inline/stealth */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clock size={12} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Availability</h3>
                </div>
                <div className="space-y-1">
                  {(["after_hours", "24_7", "custom"] as const).map((opt) => (
                    <button key={opt} onClick={() => { setHoursMode(opt); markDirty(); }} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] ${hoursMode === opt ? "bg-violet-500/10 text-violet-400" : "text-zinc-500 hover:bg-white/[0.03]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${hoursMode === opt ? "bg-violet-500" : "bg-zinc-700"}`} />
                      {opt === "after_hours" ? "After Hours" : opt === "24_7" ? "24/7" : "Custom"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <PhoneForwarded size={12} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Escalation</h3>
                </div>
                <input type="tel" value={escalationNumber} onChange={(e) => { setEscalationNumber(e.target.value); markDirty(); }} placeholder="+61 400 000 000" className={`${stealthInputClass} font-mono text-[11px]`} />
              </div>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar size={12} className="text-zinc-500" />
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Booking</h3>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">Allow AI to book</span>
                  <button onClick={() => { setBookingEnabled(!bookingEnabled); markDirty(); }} className={`relative h-5 w-9 rounded-full transition-colors ${bookingEnabled ? "bg-violet-500" : "bg-zinc-800"}`}>
                    <motion.div animate={{ x: bookingEnabled ? 16 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {activeTab === "knowledge" && (
            <motion.div key="knowledge" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-zinc-500">{knowledgeItems.filter((k) => k.enabled).length} of {knowledgeItems.length} active</p>
                <button onClick={() => setShowAddKnowledge(true)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
                  <Plus size={12} /> Add Knowledge
                </button>
              </div>
              {knowledgeItems.length === 0 ? <NeuralEmptyState title="No training data" subtitle="Add knowledge blocks for RAG." /> : (
                <div className="space-y-1.5">
                  {knowledgeItems.map((item) => (
                    <div key={item.id} className={`flex items-center gap-3 rounded-xl border border-white/5 px-3 py-2.5 ${item.enabled ? "bg-zinc-900/40" : "bg-zinc-900/20 opacity-60"}`}>
                      <GripVertical size={12} className="shrink-0 text-zinc-600" />
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.type === "file" ? "bg-violet-500/10" : "bg-white/5"}`}>
                        {item.type === "file" ? <File size={12} className="text-violet-400" /> : <FileText size={12} className="text-zinc-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-zinc-200">{item.title}</p>
                        <p className="truncate text-[10px] text-zinc-600">{item.content}</p>
                      </div>
                      <button onClick={() => toggleKnowledgeItem(item.id)} className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${item.enabled ? "bg-violet-500" : "bg-zinc-800"}`}>
                        <motion.div animate={{ x: item.enabled ? 13 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[2px] h-3 w-3 rounded-full bg-white shadow-sm" />
                      </button>
                      <button onClick={() => removeKnowledgeItem(item.id)} className="rounded p-1 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add Knowledge Modal — PRD 60: centered glass */}
              <AnimatePresence>
                {showAddKnowledge && (
                  <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddKnowledge(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                        <h3 className="font-display text-[15px] font-semibold text-white">Add Knowledge</h3>
                        <button onClick={() => setShowAddKnowledge(false)} className="rounded-lg p-1.5 text-zinc-500 hover:text-white"><X size={16} /></button>
                      </div>
                      <div className="space-y-4 p-5">
                        <div className="flex gap-2">
                          <button onClick={() => setNewKnowledgeType("text")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium ${newKnowledgeType === "text" ? "bg-violet-500/10 text-violet-400" : "bg-white/[0.03] text-zinc-500"}`}><Type size={11} /> Text</button>
                          <button onClick={() => setNewKnowledgeType("file")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium ${newKnowledgeType === "file" ? "bg-violet-500/10 text-violet-400" : "bg-white/[0.03] text-zinc-500"}`}><Upload size={11} /> File</button>
                        </div>
                        <input value={newKnowledgeTitle} onChange={(e) => setNewKnowledgeTitle(e.target.value)} placeholder={newKnowledgeType === "text" ? "e.g. Call-out Fee Policy" : "Filename.pdf"} className={`${stealthInputClass} w-full`} />
                        {newKnowledgeType === "text" && <textarea value={newKnowledgeContent} onChange={(e) => setNewKnowledgeContent(e.target.value)} rows={3} placeholder="Content..." className={`${stealthInputClass} min-h-[72px] resize-none`} />}
                        {newKnowledgeType === "file" && <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-white/10 py-8"><Upload size={20} className="text-zinc-600" /><span className="ml-2 text-[11px] text-zinc-500">Upload PDF or paste text</span></div>}
                        <div className="flex gap-2">
                          <button onClick={addKnowledgeItem} disabled={!newKnowledgeTitle} className="rounded-xl bg-white px-4 py-2 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-50">Add</button>
                          <button onClick={() => setShowAddKnowledge(false)} className="text-[11px] text-zinc-500 hover:text-white">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "calls" && (
            <motion.div key="calls" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Calls", value: totalCalls, icon: PhoneIncoming },
                  { label: "Booked", value: bookedCalls, icon: Calendar },
                  { label: "Avg Duration", value: avgDuration, icon: Clock, isDuration: true },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
                    <div className="flex items-center gap-2">
                      <stat.icon size={13} className="text-zinc-500" />
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{stat.label}</span>
                    </div>
                    <p className="mt-2 font-mono text-[18px] font-semibold text-white">
                      {"isDuration" in stat && stat.isDuration ? `${Math.floor(stat.value / 60)}:${String(stat.value % 60).padStart(2, "0")}` : <AnimatedStat value={stat.value} />}
                    </p>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-900/30">
                <div className="border-b border-white/5 px-4 py-2 flex text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  <span className="w-48">Caller</span><span className="w-20">Duration</span><span className="w-24">Outcome</span><span className="flex-1">Summary</span><span className="w-28">Time</span>
                </div>
                {calls.length === 0 ? <NeuralEmptyState title="No calls yet" subtitle="Calls handled by the AI will appear here." /> : calls.map((call) => {
                  const oc = OUTCOME_CONFIG[call.outcome] || OUTCOME_CONFIG.message;
                  const OIcon = oc.icon;
                  return (
                    <button key={call.id} onClick={() => setTranscriptCallId(call.id)} className="flex w-full items-center border-b border-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.02]">
                      <div className="w-48"><p className="text-[12px] text-zinc-300">{call.caller_name || "Unknown"}</p><p className="font-mono text-[9px] text-zinc-600">{call.caller_number || "—"}</p></div>
                      <span className="w-20 font-mono text-[10px] text-zinc-500">{Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}</span>
                      <div className="w-24"><span className={`inline-flex items-center gap-1 rounded border ${oc.border} ${oc.bg} px-1.5 py-0.5 text-[9px] ${oc.color}`}><OIcon size={9} />{oc.label}</span></div>
                      <span className="flex-1 truncate text-[10px] text-zinc-500">{call.summary || "—"}</span>
                      <span className="w-28 text-[10px] text-zinc-600">{new Date(call.created_at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transcript drawer */}
      <AnimatePresence>
        {transcriptCall && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTranscriptCallId(null)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-white/5 bg-[#050505]">
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <div>
                  <h2 className="text-[14px] font-medium text-white">Transcript</h2>
                  <p className="text-[10px] text-zinc-600">{transcriptCall.caller_name || transcriptCall.caller_number} · {Math.floor(transcriptCall.duration_seconds / 60)}:{String(transcriptCall.duration_seconds % 60).padStart(2, "0")}</p>
                </div>
                <button onClick={() => setTranscriptCallId(null)} className="rounded-lg p-1.5 text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {transcriptCall.summary && <p className="text-[11px] text-zinc-400">{transcriptCall.summary}</p>}
                {transcriptCall.transcript ? <pre className="mt-3 whitespace-pre-wrap text-[11px] text-zinc-500">{transcriptCall.transcript}</pre> : <NeuralEmptyState title="No transcript" subtitle="Generated after call." />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
