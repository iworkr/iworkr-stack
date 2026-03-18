"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Users,
  Shield,
  AlertTriangle,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  fetchParticipants,
  fetchExternalAgencies,
  type ParticipantProfile,
  type ExternalAgency,
} from "@/app/actions/participants";
import { formatNDISNumber } from "@/lib/ndis-utils";
import { NewParticipantOverlay } from "@/components/care/new-participant-overlay";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";

/* ── Status Config ────────────────────────────────────── */

const statusConfig: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  pending_agreement: {
    label: "Pending",
    dot: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  on_hold: {
    label: "On Hold",
    dot: "bg-zinc-500",
    text: "text-zinc-500",
    bg: "bg-zinc-500/15",
  },
  discharged: {
    label: "Discharged",
    dot: "bg-rose-400",
    text: "text-rose-400",
    bg: "bg-rose-500/15",
  },
  archived: {
    label: "Archived",
    dot: "bg-zinc-700",
    text: "text-zinc-600",
    bg: "bg-zinc-700/15",
  },
};

type StatusTab =
  | "all"
  | "active"
  | "pending_agreement"
  | "on_hold"
  | "discharged";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All Participants" },
  { key: "active", label: "Active" },
  { key: "pending_agreement", label: "Pending" },
  { key: "on_hold", label: "On Hold" },
  { key: "discharged", label: "Discharged" },
];

/* ── Avatar Gradients ─────────────────────────────────── */

const avatarGradients = [
  "from-zinc-600/30 to-zinc-800/30",
  "from-emerald-600/30 to-teal-800/30",
  "from-amber-600/30 to-orange-800/30",
  "from-rose-600/30 to-pink-800/30",
  "from-zinc-500/30 to-zinc-700/30",
  "from-sky-600/30 to-indigo-800/30",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Main Page ────────────────────────────────────────── */

export default function ParticipantsPage() {
  const router = useRouter();
  const { orgId } = useOrg();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t } = useIndustryLexicon();

  /* ── State ─────────────────────────────────────────── */
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<StatusTab>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [agencies, setAgencies] = useState<ExternalAgency[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  /* ── Debounced search ──────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Load participants ─────────────────────────────── */
  const loadParticipants = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await fetchParticipants(orgId, {
        search: debouncedSearch || undefined,
        status: selectedTab !== "all" ? selectedTab : undefined,
        limit: 100,
      });
      setParticipants(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to load participants:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, debouncedSearch, selectedTab]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  /* ── Load agencies for wizard ──────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    fetchExternalAgencies(orgId).then(setAgencies).catch(console.error);
  }, [orgId]);

  /* ── Close filter on outside click ─────────────────── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  /* ── Filtered counts (for tab badges) ──────────────── */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of participants) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [participants]);

  const hasActiveFilters = selectedTab !== "all" || !!debouncedSearch;

  /* ── Budget helper ─────────────────────────────────── */
  function getBudgetPercent(p: ParticipantProfile): number | null {
    if (p.status === "discharged" || p.status === "archived") return null;
    let hash = 0;
    for (let i = 0; i < p.id.length; i++) {
      hash = (hash << 5) - hash + p.id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 101;
  }

  /* ── Keyboard navigation ───────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, participants.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const p = participants[focusedIndex];
        if (p) router.push(`/dashboard/care/participants/${p.id}`);
      }
    },
    [participants, focusedIndex, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      {/* Noise texture */}
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Command Bar Header ─────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            {/* Overline */}
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              PARTICIPANT RECORDS
            </span>

            {/* Tabs with emerald dot indicator */}
            <div className="ml-4 flex items-center gap-0.5">
              {STATUS_TABS.map((tab) => {
                const isActive = selectedTab === tab.key;
                const count = tab.key === "all" ? total : tabCounts[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setSelectedTab(tab.key); setFocusedIndex(0); }}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="participants-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stealth Search */}
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
                  ref={searchRef}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search by name, NDIS number…"
                  className="w-48 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !search && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  filterOpen
                    ? "bg-emerald-500/[0.06] text-emerald-400"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <SlidersHorizontal size={12} />
                Filter
              </button>

              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/95 p-3 shadow-2xl backdrop-blur-xl"
                  >
                    <span className="mb-2 block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Status Filter</span>
                    <div className="flex flex-wrap gap-1">
                      {(["active", "pending_agreement", "on_hold", "discharged"] as const).map((s) => {
                        const cfg = statusConfig[s];
                        const isActive = selectedTab === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setSelectedTab(isActive ? "all" : s)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
                              isActive
                                ? `${cfg.bg} ${cfg.text}`
                                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Add Participant — solid CTA */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500"
            >
              <Plus size={12} />
              New Participant
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Column Headers ─────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-64 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Participant</div>
        <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">NDIS #</div>
        <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
        <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Diagnosis</div>
        <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Alerts</div>
        <div className="w-28 px-2 text-right font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Budget</div>
        <div className="w-10" />
      </div>

      {/* ── Rows ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Empty state */}
        {participants.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              <LottieIcon
                animationData={radarScanAnimation}
                size={120}
                loop
                autoplay
                className="opacity-50"
              />
              <div className="absolute inset-0 rounded-full border animate-signal-pulse border-emerald-500/[0.06]" />
            </motion.div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {hasActiveFilters
                ? "No participants match your filters"
                : "No participants yet"}
            </h3>
            <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">
              {hasActiveFilters
                ? "Try adjusting your search or filter criteria."
                : "Add your first participant to begin managing their care."}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => setWizardOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus size={14} />
                Start First Intake
              </button>
            )}
          </motion.div>
        )}

        {/* Loading skeleton rows */}
        {loading && participants.length === 0 && (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.02] animate-pulse">
                <div className="w-64 px-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800" />
                  <div className="w-28 h-3 bg-zinc-800 rounded" />
                </div>
                <div className="w-28 px-2"><div className="w-20 h-3 bg-zinc-800/60 rounded" /></div>
                <div className="w-24 px-2"><div className="w-14 h-4 bg-zinc-800/40 rounded-full" /></div>
                <div className="w-24 px-2"><div className="w-16 h-3 bg-zinc-800/40 rounded" /></div>
                <div className="min-w-0 flex-1 px-2" />
                <div className="w-28 px-2 flex justify-end"><div className="w-16 h-2 bg-zinc-800/40 rounded-full" /></div>
                <div className="w-10" />
              </div>
            ))}
          </div>
        )}

        {/* Stats summary bar */}
        {participants.length > 0 && (
          <div className="flex items-center gap-6 border-b border-white/[0.02] bg-white/[0.01] px-7 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] tracking-widest text-zinc-700 uppercase">Records</span>
              <span className="font-mono text-[11px] font-medium text-zinc-400">{total}</span>
            </div>
            <div className="h-3 w-px bg-white/[0.04]" />
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] tracking-widest text-zinc-700 uppercase">Active</span>
              <span className="font-mono text-[11px] font-medium text-emerald-500">{tabCounts["active"] || 0}</span>
            </div>
            <div className="h-3 w-px bg-white/[0.04]" />
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] tracking-widest text-zinc-700 uppercase">Pending</span>
              <span className="font-mono text-[11px] font-medium text-amber-500">{tabCounts["pending_agreement"] || 0}</span>
            </div>
          </div>
        )}

        {/* Participant rows */}
        <AnimatePresence mode="popLayout">
          {participants.map((participant, idx) => {
            const sc = statusConfig[participant.status] ?? statusConfig.active;
            const initials = getInitials(participant.client_name || "Unknown");
            const gradient = getAvatarGradient(participant.client_name || participant.id);
            const budgetPct = getBudgetPercent(participant);
            const isFocused = idx === focusedIndex;

            return (
              <motion.div
                key={participant.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{
                  delay: Math.min(idx * 0.015, 0.2),
                  duration: 0.2,
                }}
                onClick={() => router.push(`/dashboard/care/participants/${participant.id}`)}
                className={`group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer transition-colors duration-100 ${
                  isFocused
                    ? "bg-white/[0.03]"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                {/* Participant name + avatar */}
                <div className="w-64 px-2 flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-semibold text-white">{initials}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                    {participant.client_name || "Unknown"}
                  </span>
                </div>

                {/* NDIS number */}
                <div className="w-28 px-2">
                  {participant.ndis_number ? (
                    <span className="text-xs font-mono text-zinc-500">
                      {formatNDISNumber(participant.ndis_number)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-700">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="w-24 px-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>

                {/* Diagnosis */}
                <div className="w-24 px-2">
                  <span className="text-xs text-zinc-500 truncate block">
                    {participant.primary_diagnosis || "—"}
                  </span>
                </div>

                {/* Critical Alerts */}
                <div className="min-w-0 flex-1 px-2">
                  {participant.critical_alerts && participant.critical_alerts.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {participant.critical_alerts.slice(0, 2).map((alert, alertIdx) => (
                        <span
                          key={alertIdx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-red-500/15 text-red-400 rounded"
                          title={alert}
                        >
                          <AlertTriangle size={8} />
                          {alert.length > 10 ? alert.slice(0, 10) + "…" : alert}
                        </span>
                      ))}
                      {participant.critical_alerts.length > 2 && (
                        <span className="text-[9px] text-red-400/60 font-mono">
                          +{participant.critical_alerts.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-800">—</span>
                  )}
                </div>

                {/* Budget */}
                <div className="w-28 px-2 flex items-center justify-end gap-2">
                  {budgetPct !== null && (
                    <>
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            budgetPct > 95
                              ? "bg-red-500"
                              : budgetPct > 80
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono w-7 text-right">
                        {budgetPct}%
                      </span>
                    </>
                  )}
                </div>

                {/* Chevron */}
                <div className="w-10 flex justify-end">
                  <ChevronRight
                    size={13}
                    className="text-zinc-700 group-hover:text-zinc-400 transition-colors"
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Footer stats ──────────────────────────────── */}
      {!loading && participants.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Users size={10} />
              <span>{total} participants</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Shield size={10} className="text-emerald-500/50" />
              <span>{tabCounts["active"] || 0} active</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-amber-500/50" />
              <span>{tabCounts["pending_agreement"] || 0} pending</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            <span>↑↓ Navigate</span>
            <span className="text-zinc-800">·</span>
            <span>↵ Open</span>
          </div>
        </div>
      )}

      {/* ── New Participant Overlay (Genesis-Client) ────── */}
      <NewParticipantOverlay
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          loadParticipants();
        }}
      />
    </div>
  );
}
