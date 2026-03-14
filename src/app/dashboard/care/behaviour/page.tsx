/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Plus,
  Brain,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Check,
  X,
  Clock,
  Shield,
  AlertOctagon,
  Loader2,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { fetchBSPsAction, createBSPAction } from "@/app/actions/care-clinical";
import { fetchBehaviourEventsAction } from "@/app/actions/care-clinical";
import { fetchRestrictivePracticesAction } from "@/app/actions/care-compliance";

/* ── Types ─────────────────────────────────────────────── */

type BSPStatus = "draft" | "active" | "under_review" | "expired";
type Intensity = "low" | "moderate" | "high" | "extreme";
type PracticeType = "physical_restraint" | "chemical_restraint" | "seclusion" | "environmental_restraint";
type TabKey = "bsp" | "events" | "restrictive";

interface BSP {
  id: string;
  title: string;
  participant_name: string;
  status: BSPStatus;
  author_name: string;
  start_date: string;
  review_date: string;
  target_behaviours_count: number;
  consent_obtained: boolean;
}

interface BehaviourEvent {
  id: string;
  participant_name: string;
  behaviour_type: string;
  intensity: Intensity;
  occurred_at: string;
  worker_name: string;
  strategies_used: string;
  restrictive_practice_used: boolean;
  linked_incident: string | null;
}

interface RestrictivePractice {
  id: string;
  participant_name: string;
  practice_type: PracticeType;
  occurred_at: string;
  duration_minutes: number;
  worker_name: string;
  authorised_in_bsp: boolean;
  review_required: boolean;
  reviewed: boolean;
  reportable: boolean;
  debrief_completed: boolean;
}

/* ── Config ────────────────────────────────────────────── */

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "bsp", label: "Support Plans", icon: Brain },
  { key: "events", label: "Behaviour Events", icon: AlertTriangle },
  { key: "restrictive", label: "Restrictive Practices", icon: ShieldAlert },
];

const bspStatusConfig: Record<BSPStatus, { label: string; dot: string; text: string; bg: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/15" },
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
  under_review: { label: "Under Review", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/15" },
  expired: { label: "Expired", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/15" },
};

const intensityConfig: Record<Intensity, { label: string; dot: string; text: string; bg: string }> = {
  low: { label: "Low", dot: "bg-zinc-400", text: "text-zinc-400", bg: "bg-zinc-500/15" },
  moderate: { label: "Moderate", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/15" },
  high: { label: "High", dot: "bg-orange-400", text: "text-orange-400", bg: "bg-orange-500/15" },
  extreme: { label: "Extreme", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/15" },
};

const practiceTypeLabels: Record<PracticeType, string> = {
  physical_restraint: "Physical Restraint",
  chemical_restraint: "Chemical Restraint",
  seclusion: "Seclusion",
  environmental_restraint: "Environmental Restraint",
};

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(d: string) { return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); }
function formatDateTime(d: string) {
  const dt = new Date(d);
  return { date: dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" }), time: dt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) };
}
function isOverdue(d: string) { return new Date(d) < new Date(); }

/** Map raw DB row to BSP UI shape */
function mapBSP(row: any): BSP {
  return {
    id: row.id,
    title: row.title ?? "Untitled BSP",
    participant_name: row.participant_profiles?.full_name ?? row.participant_name ?? "Unknown",
    status: (row.status as BSPStatus) ?? "draft",
    author_name: row.author_name ?? "—",
    start_date: row.start_date ?? row.created_at,
    review_date: row.review_date ?? row.next_review_date ?? row.start_date ?? row.created_at,
    target_behaviours_count: Array.isArray(row.target_behaviours) ? row.target_behaviours.length : 0,
    consent_obtained: row.consent_obtained ?? false,
  };
}

/** Map raw DB row to BehaviourEvent UI shape */
function mapEvent(row: any): BehaviourEvent {
  return {
    id: row.id,
    participant_name: row.participant_profiles?.full_name ?? row.participant_name ?? "Unknown",
    behaviour_type: row.behaviour_type ?? "Unknown",
    intensity: (row.intensity as Intensity) ?? "low",
    occurred_at: row.occurred_at ?? row.created_at,
    worker_name: row.profiles?.full_name ?? row.worker_name ?? "—",
    strategies_used: Array.isArray(row.strategies_used) ? row.strategies_used.join(", ") : row.strategies_used ?? "",
    restrictive_practice_used: row.restrictive_practice_used ?? false,
    linked_incident: row.linked_incident_id ?? row.linked_incident ?? null,
  };
}

/** Map raw DB row to RestrictivePractice UI shape */
function mapRP(row: any): RestrictivePractice {
  return {
    id: row.id,
    participant_name: row.participant_profiles?.full_name ?? row.participant_name ?? "Unknown",
    practice_type: (row.practice_type as PracticeType) ?? "physical_restraint",
    occurred_at: row.occurred_at ?? row.created_at,
    duration_minutes: row.duration_minutes ?? 0,
    worker_name: row.profiles?.full_name ?? row.worker_name ?? "—",
    authorised_in_bsp: row.authorised_in_bsp ?? false,
    review_required: row.review_required ?? true,
    reviewed: row.reviewed ?? false,
    reportable: row.reportable ?? false,
    debrief_completed: row.debrief_completed ?? false,
  };
}

/* ── Main Page ─────────────────────────────────────────── */

export default function BehaviourPage() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState<TabKey>("bsp");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  /* ── Data State ───────────────────────────────────────── */
  const [bsps, setBsps] = useState<BSP[]>([]);
  const [events, setEvents] = useState<BehaviourEvent[]>([]);
  const [restrictive, setRestrictive] = useState<RestrictivePractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── BSP Create Form State ──────────────────────────── */
  const [form, setForm] = useState({
    title: "", participant: "", author_name: "", author_role: "",
    start_date: "", review_date: "", notes: "", consent: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── Data Loading ─────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [bspData, eventData, rpData] = await Promise.all([
        fetchBSPsAction(orgId),
        fetchBehaviourEventsAction(orgId),
        fetchRestrictivePracticesAction(orgId),
      ]);

      setBsps((bspData || []).map(mapBSP));
      setEvents((eventData || []).map(mapEvent));
      setRestrictive((rpData || []).map(mapRP));
    } catch (e: any) {
      console.error("[behaviour] Failed to load data:", e);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Filtered Data ──────────────────────────────────── */
  const filteredBSPs = useMemo(() => {
    if (!search) return bsps;
    const q = search.toLowerCase();
    return bsps.filter(
      (b) => b.title.toLowerCase().includes(q) || b.participant_name.toLowerCase().includes(q) || b.author_name.toLowerCase().includes(q)
    );
  }, [search, bsps]);

  const filteredEvents = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) => e.participant_name.toLowerCase().includes(q) || e.behaviour_type.toLowerCase().includes(q) || e.worker_name.toLowerCase().includes(q)
    );
  }, [search, events]);

  const filteredRP = useMemo(() => {
    if (!search) return restrictive;
    const q = search.toLowerCase();
    return restrictive.filter(
      (r) => r.participant_name.toLowerCase().includes(q) || practiceTypeLabels[r.practice_type]?.toLowerCase().includes(q)
    );
  }, [search, restrictive]);

  /* ── Tab stats ──────────────────────────────────────── */
  const stats = useMemo(() => ({
    activeBSPs: bsps.filter((b) => b.status === "active").length,
    rpEvents: events.filter((e) => e.restrictive_practice_used).length,
    unreviewedRP: restrictive.filter((r) => !r.reviewed).length,
    undebriefedRP: restrictive.filter((r) => !r.debrief_completed).length,
  }), [bsps, events, restrictive]);

  const handleCreate = useCallback(async () => {
    if (!orgId) return;
    setSaving(true);
    setSaveError(null);

    try {
      await createBSPAction({
        organization_id: orgId,
        participant_id: form.participant, // NOTE: In production this should be a UUID from a participant picker
        title: form.title,
        author_name: form.author_name || null,
        author_role: form.author_role || null,
        start_date: form.start_date || null,
        review_date: form.review_date || null,
        target_behaviours: [],
        triggers: [],
        prevention_strategies: [],
        response_strategies: [],
        reinforcement_strategies: [],
        consent_obtained: form.consent,
        notes: form.notes || null,
      });
      setCreateOpen(false);
      setForm({ title: "", participant: "", author_name: "", author_role: "", start_date: "", review_date: "", notes: "", consent: false });
      // Reload data to pick up the new BSP
      loadData();
    } catch (e: any) {
      console.error("[behaviour] createBSP failed:", e);
      setSaveError(e.message || "Failed to create BSP. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [orgId, form, loadData]);

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Command Bar ────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              Behaviour &amp; Safety
            </span>

            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon size={11} />
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="behaviour-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center gap-2">
              <motion.div
                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                initial={false}
                animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              />
              <div className="flex items-center gap-2 pl-2">
                <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search…"
                  className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
              </div>
            </div>

            {activeTab === "bsp" && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus size={12} />
                New BSP
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading State ────────────────────────────────── */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
            <span className="text-[12px] text-zinc-600">Loading behaviour data…</span>
          </div>
        </div>
      )}

      {/* ── Error State ──────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle size={20} className="text-rose-400" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">{error}</h3>
            <button onClick={loadData} className="mt-2 rounded-lg px-4 py-1.5 text-[12px] font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Content ────────────────────────────────── */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <AnimatePresence mode="wait">
            {/* ── TAB 1: Behaviour Support Plans ────────── */}
            {activeTab === "bsp" && (
              <motion.div key="bsp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Plan Title</div>
                  <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Participant</div>
                  <div className="w-32 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Author</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Behaviours</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Review Date</div>
                  <div className="w-20 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Consent</div>
                  <div className="w-8" />
                </div>

                {filteredBSPs.length === 0 ? (
                  <EmptyState icon={Brain} message="No behaviour support plans found" sub={search ? "Try adjusting your search criteria." : "Create your first BSP to get started."} />
                ) : (
                  filteredBSPs.map((bsp, idx) => {
                    const sc = bspStatusConfig[bsp.status] ?? bspStatusConfig.draft;
                    const overdue = bsp.status !== "expired" && isOverdue(bsp.review_date);
                    return (
                      <motion.div
                        key={bsp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
                      >
                        <div className="min-w-0 flex-1 px-2 flex items-center gap-2">
                          <Brain size={12} className="shrink-0 text-zinc-600" />
                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                            {bsp.title}
                          </span>
                        </div>
                        <div className="w-36 px-2">
                          <span className="text-xs text-zinc-400 truncate block">{bsp.participant_name}</span>
                        </div>
                        <div className="w-32 px-2">
                          <span className="text-xs text-zinc-500 truncate block">{bsp.author_name}</span>
                        </div>
                        <div className="w-28 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="w-24 px-2 text-center">
                          <span className="text-[11px] font-mono text-zinc-400">{bsp.target_behaviours_count}</span>
                        </div>
                        <div className="w-28 px-2">
                          <span className={`text-xs font-mono ${overdue ? "text-rose-400" : "text-zinc-500"}`}>
                            {overdue && <Clock size={9} className="inline mr-1 -mt-px" />}
                            {formatDate(bsp.review_date)}
                          </span>
                        </div>
                        <div className="w-20 px-2 text-center">
                          {bsp.consent_obtained ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Check size={10} /> Yes</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle size={9} /> No</span>
                          )}
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* ── TAB 2: Behaviour Events ───────────────── */}
            {activeTab === "events" && (
              <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
                  <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Participant</div>
                  <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Behaviour</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Intensity</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Worker</div>
                  <div className="w-56 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Strategies</div>
                  <div className="w-16 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">RP</div>
                  <div className="w-20 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Incident</div>
                  <div className="w-8" />
                </div>

                {filteredEvents.length === 0 ? (
                  <EmptyState icon={AlertTriangle} message="No behaviour events found" sub={search ? "Try adjusting your search criteria." : "No behaviour events have been recorded yet."} />
                ) : (
                  filteredEvents.map((evt, idx) => {
                    const ic = intensityConfig[evt.intensity] ?? intensityConfig.low;
                    const dt = formatDateTime(evt.occurred_at);
                    return (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
                      >
                        <div className="w-28 px-2">
                          <div className="flex items-center gap-1.5">
                            <Clock size={10} className="text-zinc-700 shrink-0" />
                            <span className="text-xs text-zinc-400 font-mono">{dt.date}</span>
                          </div>
                          <span className="text-[10px] text-zinc-700 font-mono pl-4">{dt.time}</span>
                        </div>
                        <div className="w-36 px-2">
                          <span className="text-sm text-zinc-200 truncate block group-hover:text-white transition-colors">{evt.participant_name}</span>
                        </div>
                        <div className="min-w-0 flex-1 px-2">
                          <span className="text-xs text-zinc-400 truncate block">{evt.behaviour_type}</span>
                        </div>
                        <div className="w-24 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${ic.bg} ${ic.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ic.dot}`} />
                            {ic.label}
                          </span>
                        </div>
                        <div className="w-28 px-2">
                          <span className="text-xs text-zinc-500 truncate block">{evt.worker_name}</span>
                        </div>
                        <div className="w-56 px-2">
                          <span className="text-[11px] text-zinc-500 truncate block">
                            {evt.strategies_used.length > 50 ? evt.strategies_used.slice(0, 50) + "…" : evt.strategies_used}
                          </span>
                        </div>
                        <div className="w-16 px-2 text-center">
                          {evt.restrictive_practice_used ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/15 text-rose-400 rounded">
                              <ShieldAlert size={8} /> Yes
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div className="w-20 px-2">
                          {evt.linked_incident ? (
                            <span className="text-[10px] font-mono text-amber-400">{evt.linked_incident}</span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* ── TAB 3: Restrictive Practices ──────────── */}
            {activeTab === "restrictive" && (
              <motion.div key="restrictive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
                  <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Participant</div>
                  <div className="w-44 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Practice Type</div>
                  <div className="w-20 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Duration</div>
                  <div className="w-20 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">BSP Auth</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Review</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Reportable</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Debrief</div>
                  <div className="w-8" />
                </div>

                {filteredRP.length === 0 ? (
                  <EmptyState icon={ShieldAlert} message="No restrictive practices recorded" sub={search ? "Try adjusting your search criteria." : "No restrictive practices have been logged."} />
                ) : (
                  filteredRP.map((rp, idx) => {
                    const dt = formatDateTime(rp.occurred_at);
                    const needsAttention = !rp.reviewed || !rp.debrief_completed;
                    return (
                      <motion.div
                        key={rp.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className={`group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer transition-colors duration-100 ${
                          needsAttention ? "hover:bg-amber-500/[0.03] bg-amber-500/[0.01]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="w-28 px-2">
                          <div className="flex items-center gap-1.5">
                            <Clock size={10} className="text-zinc-700 shrink-0" />
                            <span className="text-xs text-zinc-400 font-mono">{dt.date}</span>
                          </div>
                          <span className="text-[10px] text-zinc-700 font-mono pl-4">{dt.time}</span>
                        </div>
                        <div className="w-36 px-2">
                          <span className="text-sm text-zinc-200 truncate block group-hover:text-white transition-colors">{rp.participant_name}</span>
                        </div>
                        <div className="w-44 px-2 flex items-center gap-2">
                          <ShieldAlert size={11} className="shrink-0 text-rose-500/60" />
                          <span className="text-xs text-zinc-300 truncate">{practiceTypeLabels[rp.practice_type] ?? rp.practice_type}</span>
                        </div>
                        <div className="w-20 px-2 text-center">
                          <span className="text-[11px] font-mono text-zinc-400">
                            {rp.duration_minutes > 0 ? `${rp.duration_minutes} min` : "N/A"}
                          </span>
                        </div>
                        <div className="w-20 px-2 text-center">
                          {rp.authorised_in_bsp ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Shield size={9} /> Yes</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/15 text-rose-400 rounded">
                              <AlertOctagon size={8} /> No
                            </span>
                          )}
                        </div>
                        <div className="w-24 px-2 text-center">
                          {rp.reviewed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Check size={10} /> Done</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/15 text-amber-400 rounded animate-pulse">
                              <AlertTriangle size={8} /> Pending
                            </span>
                          )}
                        </div>
                        <div className="w-24 px-2 text-center">
                          {rp.reportable ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/10 text-rose-400 rounded">
                              <AlertOctagon size={8} /> Yes
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">No</span>
                          )}
                        </div>
                        <div className="w-24 px-2 text-center">
                          {rp.debrief_completed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Check size={10} /> Done</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-rose-500/15 text-rose-400 rounded animate-pulse">
                              <X size={8} /> Missing
                            </span>
                          )}
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
          {activeTab === "bsp" && (
            <>
              <div className="flex items-center gap-1.5">
                <Brain size={10} className="text-emerald-500/50" />
                <span>{filteredBSPs.length} plans</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <Shield size={10} className="text-emerald-500/50" />
                <span>{stats.activeBSPs} active</span>
              </div>
            </>
          )}
          {activeTab === "events" && (
            <>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-amber-500/50" />
                <span>{filteredEvents.length} events</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={10} className="text-rose-500/50" />
                <span>{stats.rpEvents} with RP</span>
              </div>
            </>
          )}
          {activeTab === "restrictive" && (
            <>
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={10} className="text-rose-500/50" />
                <span>{filteredRP.length} records</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-amber-500/50" />
                <span>{stats.unreviewedRP} unreviewed</span>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <AlertOctagon size={10} className="text-rose-500/50" />
                <span>{stats.undebriefedRP} no debrief</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
          <span>Tab to switch</span>
          <span className="text-zinc-800">·</span>
          <span>⌘K to search</span>
        </div>
      </div>

      {/* ── Create BSP Modal ───────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">New Plan</span>
                  <h2 className="mt-1 text-[15px] font-medium text-zinc-200">Create Behaviour Support Plan</h2>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {saveError && (
                <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                <FormField label="Title" value={form.title} onChange={(v) => setForm((s) => ({ ...s, title: v }))} placeholder="e.g. Self-Injurious Behaviour Reduction Plan" />
                <FormField label="Participant ID" value={form.participant} onChange={(v) => setForm((s) => ({ ...s, participant: v }))} placeholder="Participant UUID" />
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Author Name" value={form.author_name} onChange={(v) => setForm((s) => ({ ...s, author_name: v }))} placeholder="Dr. Sarah Chen" />
                  <FormField label="Author Role" value={form.author_role} onChange={(v) => setForm((s) => ({ ...s, author_role: v }))} placeholder="Behaviour Practitioner" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start Date" value={form.start_date} onChange={(v) => setForm((s) => ({ ...s, start_date: v }))} type="date" />
                  <FormField label="Review Date" value={form.review_date} onChange={(v) => setForm((s) => ({ ...s, review_date: v }))} type="date" />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Notes</label>
                  <textarea value={form.notes} onChange={(ev) => setForm((s) => ({ ...s, notes: ev.target.value }))} placeholder="Additional context or observations…" rows={3}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 resize-none transition-colors" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Consent Obtained</label>
                  <button onClick={() => setForm((s) => ({ ...s, consent: !s.consent }))}
                    className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${form.consent ? "bg-emerald-600" : "bg-zinc-800"}`}>
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${form.consent ? "translate-x-4" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Modal footer */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg px-4 py-2 text-[12px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.title || !form.participant || saving}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {saving ? "Creating…" : "Create BSP"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Shared Sub-components ─────────────────────────────── */

function FormField({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{label}</label>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 transition-colors ${type === "date" ? "[color-scheme:dark]" : ""}`} />
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: React.ElementType; message: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
        <Icon size={28} className="text-zinc-600" />
      </div>
      <h3 className="text-[15px] font-medium text-zinc-200">{message}</h3>
      <p className="mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-zinc-600">{sub}</p>
    </motion.div>
  );
}
