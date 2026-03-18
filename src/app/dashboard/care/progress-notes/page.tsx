/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, Plus, ClipboardList, ChevronRight, AlertTriangle, Check, X, Loader2, Target, FileText, Clock } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";
import { cachedFetch, invalidateCache } from "@/lib/cache-utils";

/* ── Types ────────────────────────────────────────────── */

type NoteType = "shift_summary" | "goal_progress" | "incident_follow_up" | "health_update" | "general";

interface ProgressNote {
  id: string;
  organization_id: string;
  job_id: string | null;
  participant_id: string;
  worker_id: string;
  note_type: NoteType;
  content: string;
  goals_addressed: string[];
  risks_identified: string[];
  follow_up_required: boolean;
  follow_up_notes: string | null;
  attachments: any;
  created_at: string;
  worker_name?: string;
  participant_name?: string;
}

interface Participant { id: string; client_name: string }

/* ── Config ───────────────────────────────────────────── */

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; dot: string; text: string; bg: string }> = {
  shift_summary: { label: "Shift Summary", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/15" },
  goal_progress: { label: "Goal Progress", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
  incident_follow_up: { label: "Incident F/U", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/15" },
  health_update: { label: "Health Update", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/15" },
  general: { label: "General", dot: "bg-zinc-400", text: "text-zinc-400", bg: "bg-zinc-500/15" },
};

type TabKey = "all" | "shift_summary" | "goal_progress" | "health_update" | "follow_up";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shift_summary", label: "Shift Summary" },
  { key: "goal_progress", label: "Goal Progress" },
  { key: "health_update", label: "Health Update" },
  { key: "follow_up", label: "Follow-up Required" },
];

/* ── Tag Input Helper ─────────────────────────────────── */

function TagInput({ label, items, setItems, input, setInput, onAdd, icon, placeholder, tagClass, removeClass }: {
  label: string; items: string[]; setItems: (fn: (v: string[]) => string[]) => void;
  input: string; setInput: (v: string) => void; onAdd: () => void;
  icon: React.ReactNode; placeholder: string; tagClass: string; removeClass: string;
}) {
  return (
    <div>
      <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">{label}</label>
      <div className="flex gap-1.5">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30" />
        <button onClick={onAdd} className="rounded-lg border border-white/[0.06] px-2 py-1.5 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors">
          <Plus size={12} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${tagClass}`}>
              {icon}{item}
              <button onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} className={removeClass}><X size={8} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function ShiftNotesPage() {
  const { orgId, userId } = useOrg();

  /* ── State ─────────────────────────────────────────── */
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<TabKey>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Form state ─────────────────────────────────────── */
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [formParticipant, setFormParticipant] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [formType, setFormType] = useState<NoteType>("shift_summary");
  const [formContent, setFormContent] = useState("");
  const [formGoals, setFormGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [formRisks, setFormRisks] = useState<string[]>([]);
  const [riskInput, setRiskInput] = useState("");
  const [formFollowUp, setFormFollowUp] = useState(false);
  const [formFollowUpNotes, setFormFollowUpNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  /* ── Load notes (with SWR cache) ─────────────────────── */
  const loadNotes = useCallback(async (forceRefresh = false) => {
    if (!orgId) return;
    const cacheKey = `care-progress-notes:${orgId}`;
    if (forceRefresh) invalidateCache(cacheKey);
    if (notes.length === 0) setLoading(true);

    try {
      const { data: raw } = await cachedFetch(
        cacheKey,
        async () => {
          const supabase = createClient();
          const { data, error } = await (supabase as any)
            .from("progress_notes")
            .select("*, profiles!worker_id ( full_name ), participant_profiles!participant_id ( client_name )")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw error;
          return data ?? [];
        },
        3 * 60 * 1000
      );
      setNotes((raw as any[]).map((row: any) => ({
        ...row,
        worker_name: row.profiles?.full_name ?? null,
        participant_name: row.participant_profiles?.client_name ?? null,
      })));
    } catch (e) {
      console.error("Failed to load progress notes:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId, notes.length]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (!orgId) return;
    cachedFetch(
      `care-participants:${orgId}`,
      async () => {
        const supabase = createClient();
        const { data } = await (supabase as any).from("participant_profiles").select("id, client_name").eq("organization_id", orgId).order("client_name");
        return data ?? [];
      },
      5 * 60 * 1000
    ).then(({ data }) => { if (data) setParticipants(data as any[]); });
  }, [orgId]);

  /* ── Filtered notes ─────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = notes;
    if (selectedTab === "follow_up") result = result.filter((n) => n.follow_up_required);
    else if (selectedTab !== "all") result = result.filter((n) => n.note_type === selectedTab);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((n) =>
        n.content?.toLowerCase().includes(q) || n.participant_name?.toLowerCase().includes(q) || n.worker_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, selectedTab, debouncedSearch]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: notes.length, follow_up: 0 };
    for (const n of notes) { c[n.note_type] = (c[n.note_type] || 0) + 1; if (n.follow_up_required) c.follow_up++; }
    return c;
  }, [notes]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const addGoal = () => { const v = goalInput.trim(); if (v && !formGoals.includes(v)) setFormGoals((g) => [...g, v]); setGoalInput(""); };
  const addRisk = () => { const v = riskInput.trim(); if (v && !formRisks.includes(v)) setFormRisks((r) => [...r, v]); setRiskInput(""); };

  const resetForm = () => {
    setFormParticipant(""); setParticipantSearch(""); setFormType("shift_summary"); setFormContent("");
    setFormGoals([]); setGoalInput(""); setFormRisks([]); setRiskInput(""); setFormFollowUp(false); setFormFollowUpNotes("");
  };

  const handleSave = async () => {
    if (!orgId || !formParticipant || !formContent.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await (supabase as any).from("progress_notes").insert({
        organization_id: orgId, participant_id: formParticipant, worker_id: userId, note_type: formType,
        content: formContent.trim(), goals_addressed: formGoals, risks_identified: formRisks,
        follow_up_required: formFollowUp, follow_up_notes: formFollowUp ? formFollowUpNotes.trim() || null : null,
      });
      if (error) throw new Error(error.message);
      resetForm(); setModalOpen(false); loadNotes();
    } catch (err: any) {
      console.error("[progress-notes] save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredParticipants = useMemo(() => {
    if (!participantSearch) return participants.slice(0, 20);
    const q = participantSearch.toLowerCase();
    return participants.filter((p) => p.client_name?.toLowerCase().includes(q)).slice(0, 20);
  }, [participants, participantSearch]);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }} />

      {/* ── Sticky Header ─────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">SHIFT NOTES</span>
            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = selectedTab === tab.key;
                const count = tabCounts[tab.key] || 0;
                return (
                  <button key={tab.key} onClick={() => setSelectedTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div layoutId="notes-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center gap-2">
              <motion.div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500" initial={false}
                animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }} transition={{ duration: 0.15 }} />
              <div className="flex items-center gap-2 pl-2">
                <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
                <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                  placeholder="Search notes…" className="w-48 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700" />
                {!searchFocused && !search && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500">
              <Plus size={12} />New Note
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Column Headers ─────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-32 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
        <div className="w-44 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Participant</div>
        <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Worker</div>
        <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Type</div>
        <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Content</div>
        <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Follow-up</div>
        <div className="w-10" />
      </div>

      {/* ── Rows ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading && notes.length === 0 && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.02] animate-pulse">
            <div className="w-32 px-2"><div className="w-20 h-3 bg-zinc-800 rounded" /></div>
            <div className="w-44 px-2"><div className="w-28 h-3 bg-zinc-800 rounded" /></div>
            <div className="w-36 px-2"><div className="w-20 h-3 bg-zinc-800/60 rounded" /></div>
            <div className="w-28 px-2"><div className="w-16 h-4 bg-zinc-800/40 rounded-full" /></div>
            <div className="min-w-0 flex-1 px-2"><div className="w-48 h-3 bg-zinc-800/40 rounded" /></div>
            <div className="w-24 px-2"><div className="w-10 h-3 bg-zinc-800/40 rounded" /></div>
            <div className="w-10" />
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center justify-center py-24 text-center">
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
              <ClipboardList size={32} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {debouncedSearch || selectedTab !== "all" ? "No notes match your filters" : "No shift notes yet"}
            </h3>
            <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">
              {debouncedSearch || selectedTab !== "all" ? "Try adjusting your search or filter criteria." : "Log your first shift note after a shift or session."}
            </p>
            {!debouncedSearch && selectedTab === "all" && (
              <button onClick={() => setModalOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500">
                <Plus size={14} />Add First Note
              </button>
            )}
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.map((note, idx) => {
            const tc = NOTE_TYPE_CONFIG[note.note_type] ?? NOTE_TYPE_CONFIG.general;
            return (
              <motion.div key={note.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -8 }}
                transition={{ delay: Math.min(idx * 0.015, 0.2), duration: 0.2 }}
                className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer transition-colors duration-100 hover:bg-white/[0.02]">
                <div className="w-32 px-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-zinc-700 shrink-0" />
                    <span className="text-xs text-zinc-400 font-mono">
                      {new Date(note.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-700 font-mono pl-4">
                    {new Date(note.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="w-44 px-2">
                  <span className="text-sm text-zinc-200 truncate block group-hover:text-white transition-colors">{note.participant_name || "Unknown"}</span>
                </div>
                <div className="w-36 px-2">
                  <span className="text-xs text-zinc-500 truncate block">{note.worker_name || "—"}</span>
                </div>
                <div className="w-28 px-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${tc.bg} ${tc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />{tc.label}
                  </span>
                </div>
                <div className="min-w-0 flex-1 px-2">
                  <span className="text-xs text-zinc-500 truncate block">{note.content.length > 80 ? note.content.slice(0, 80) + "…" : note.content}</span>
                </div>
                <div className="w-24 px-2">
                  {note.follow_up_required ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/15 text-amber-400 rounded">
                      <AlertTriangle size={8} />Required
                    </span>
                  ) : <span className="text-xs text-zinc-800">—</span>}
                </div>
                <div className="w-10 flex justify-end">
                  <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-1.5"><FileText size={10} /><span>{filtered.length} notes</span></div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5"><Target size={10} className="text-emerald-500/50" /><span>{tabCounts.goal_progress || 0} goal updates</span></div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5"><AlertTriangle size={10} className="text-amber-500/50" /><span>{tabCounts.follow_up || 0} follow-ups</span></div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            <span>↑↓ Navigate</span><span className="text-zinc-800">·</span><span>⌘F Search</span>
          </div>
        </div>
      )}

      {/* ── Create Note Modal ──────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { setModalOpen(false); resetForm(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 p-6 shadow-2xl backdrop-blur-xl">

              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">New Note</span>
                  <h2 className="text-[15px] font-medium text-zinc-200 mt-0.5">Log Shift Note</h2>
                </div>
                <button onClick={() => { setModalOpen(false); resetForm(); }}
                  className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400 transition-colors"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                {/* Participant selector */}
                <div>
                  <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Participant</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder="Search participants…"
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 pl-8 pr-3 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30" />
                  </div>
                  {participantSearch && !formParticipant && (
                    <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-white/[0.06] bg-[#0A0A0A]">
                      {filteredParticipants.map((p) => (
                        <button key={p.id} onClick={() => { setFormParticipant(p.id); setParticipantSearch(p.client_name); }}
                          className="w-full px-3 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition-colors">{p.client_name}</button>
                      ))}
                      {filteredParticipants.length === 0 && <div className="px-3 py-2 text-[11px] text-zinc-700">No participants found</div>}
                    </div>
                  )}
                  {formParticipant && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Check size={10} className="text-emerald-500" />
                      <span className="text-[11px] text-emerald-400">{participantSearch}</span>
                      <button onClick={() => { setFormParticipant(""); setParticipantSearch(""); }} className="text-zinc-600 hover:text-zinc-400"><X size={10} /></button>
                    </div>
                  )}
                </div>

                {/* Note Type */}
                <div>
                  <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Note Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as NoteType)}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 outline-none focus:border-emerald-500/30">
                    {Object.entries(NOTE_TYPE_CONFIG).map(([k, v]) => (<option key={k} value={k} className="bg-zinc-900">{v.label}</option>))}
                  </select>
                </div>

                {/* Content */}
                <div>
                  <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Content</label>
                  <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={5} placeholder="Describe the session, observations, and outcomes…"
                    className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 leading-relaxed outline-none placeholder:text-zinc-700 focus:border-emerald-500/30" />
                </div>

                {/* Goals Addressed */}
                <TagInput label="Goals Addressed" items={formGoals} setItems={setFormGoals} input={goalInput} setInput={setGoalInput}
                  onAdd={addGoal} icon={<Target size={8} />} placeholder="Type a goal and press Enter…" tagClass="bg-emerald-500/10 text-emerald-400" removeClass="text-emerald-600 hover:text-emerald-300" />
                {/* Risks Identified */}
                <TagInput label="Risks Identified" items={formRisks} setItems={setFormRisks} input={riskInput} setInput={setRiskInput}
                  onAdd={addRisk} icon={<AlertTriangle size={8} />} placeholder="Type a risk and press Enter…" tagClass="bg-rose-500/10 text-rose-400" removeClass="text-rose-600 hover:text-rose-300" />

                {/* Follow-up Toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Follow-up Required</label>
                    <button onClick={() => setFormFollowUp((v) => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${formFollowUp ? "bg-emerald-600" : "bg-zinc-800"}`}>
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${formFollowUp ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                  {formFollowUp && (
                    <textarea value={formFollowUpNotes} onChange={(e) => setFormFollowUpNotes(e.target.value)} rows={2} placeholder="Describe required follow-up actions…"
                      className="mt-2 w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 leading-relaxed outline-none placeholder:text-zinc-700 focus:border-emerald-500/30" />
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button onClick={() => { setModalOpen(false); resetForm(); }}
                  className="rounded-lg px-4 py-2 text-[12px] font-medium text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !formParticipant || !formContent.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-white transition-all duration-200 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {saving ? "Saving…" : "Save Note"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
