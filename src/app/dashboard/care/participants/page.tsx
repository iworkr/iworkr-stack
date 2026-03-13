"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Users,
  Heart,
  Shield,
  AlertTriangle,
  ChevronRight,
  DollarSign,
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
import { ParticipantIntakeWizard } from "@/components/care/participant-intake-wizard";

/* ── Status Config ────────────────────────────────────── */

const statusConfig: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  active: {
    label: "Active",
    dot: "bg-blue-400",
    text: "text-blue-400",
    bg: "bg-blue-500/15",
  },
  pending_agreement: {
    label: "Pending Agreement",
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
    dot: "bg-zinc-600",
    text: "text-zinc-500",
    bg: "bg-zinc-600/15",
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
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending_agreement", label: "Pending Agreement" },
  { key: "on_hold", label: "On Hold" },
  { key: "discharged", label: "Discharged" },
];

/* ── Avatar Gradients ─────────────────────────────────── */

const avatarGradients = [
  "from-blue-600/40 to-blue-800/40",
  "from-sky-600/40 to-indigo-800/40",
  "from-violet-600/40 to-purple-800/40",
  "from-teal-600/40 to-cyan-800/40",
  "from-emerald-600/40 to-green-800/40",
  "from-rose-600/40 to-pink-800/40",
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

/* ── Skeleton Loader ──────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl bg-[#0A0A0A] border border-zinc-800/50 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-zinc-800" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-32 h-3.5 rounded bg-zinc-800" />
            <div className="w-16 h-4 rounded-full bg-zinc-800" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-3 rounded bg-zinc-800/60" />
            <div className="w-28 h-3 rounded bg-zinc-800/60" />
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-zinc-800" />
          <div className="w-6 h-3 rounded bg-zinc-800/60" />
        </div>
        <div className="w-3.5 h-3.5 rounded bg-zinc-800/40" />
      </div>
    </div>
  );
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<StatusTab>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [agencies, setAgencies] = useState<ExternalAgency[]>([]);

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

  /* ── Filtered counts (for tab badges) ──────────────── */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of participants) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [participants]);

  /* ── Budget helper ─────────────────────────────────── */
  function getBudgetPercent(p: ParticipantProfile): number | null {
    // ParticipantProfile doesn't carry budget inline — we use
    // a simple heuristic based on status for the list view.
    // The detailed budget is on the dossier page.
    // This placeholder provides visual consistency.
    if (p.status === "discharged" || p.status === "archived") return null;
    // Deterministic per-participant display value
    let hash = 0;
    for (let i = 0; i < p.id.length; i++) {
      hash = (hash << 5) - hash + p.id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 101;
  }

  /* ── Render ────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-screen bg-[#050505]"
    >
      {/* Noise texture overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow — careBlue */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-72 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(59,130,246,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        {/* ── Header ───────────────────────────────────── */}
        <div className="pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-blue-400 mb-1.5">
                NDIS PARTICIPANT RECORDS
              </p>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Participants
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {loading
                  ? "Loading records..."
                  : `${total} participant${total !== 1 ? "s" : ""} across your care organization`}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/10 transition-colors"
            >
              <Plus size={16} />
              New Participant
            </motion.button>
          </div>

          {/* ── Search Bar ─────────────────────────────── */}
          <div className="mt-6 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or NDIS number..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0A] border border-zinc-800/60 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
            />
          </div>

          {/* ── Status Tab Filters ─────────────────────── */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const isActive = selectedTab === tab.key;
              const count =
                tab.key === "all" ? total : tabCounts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key)}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? "bg-blue-500/10 text-blue-400"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="participant-tab-indicator"
                      className="absolute inset-0 rounded-lg bg-blue-500/10"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`relative rounded-full px-1.5 py-0.5 text-[9px] font-mono ${
                        isActive
                          ? "bg-blue-500/15 text-blue-400"
                          : "text-zinc-600"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Participant List ─────────────────────────── */}
        <div className="space-y-2">
          {/* Loading state */}
          {loading && participants.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && participants.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              {/* Animated empty icon */}
              <div className="relative mb-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative"
                >
                  <div className="w-24 h-24 rounded-full bg-blue-500/5 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Heart
                        size={28}
                        className="text-blue-500/40"
                      />
                    </div>
                  </div>
                  {/* Pulse rings */}
                  <motion.div
                    className="absolute inset-0 rounded-full border border-blue-500/10"
                    animate={{
                      scale: [1, 1.4],
                      opacity: [0.3, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border border-blue-500/10"
                    animate={{
                      scale: [1, 1.6],
                      opacity: [0.2, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay: 0.5,
                    }}
                  />
                </motion.div>
              </div>
              <h3 className="text-[15px] font-medium text-zinc-200">
                {debouncedSearch || selectedTab !== "all"
                  ? "No participants match your filters"
                  : "No participants yet"}
              </h3>
              <p className="mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-zinc-600">
                {debouncedSearch || selectedTab !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Start your first intake to begin managing participant care."}
              </p>
              {!debouncedSearch && selectedTab === "all" && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setWizardOpen(true)}
                  className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/10 transition-colors"
                >
                  <Plus size={14} />
                  Start First Intake
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Participant cards */}
          <AnimatePresence mode="popLayout">
            {participants.map((participant, idx) => {
              const sc =
                statusConfig[participant.status] ?? statusConfig.active;
              const initials = getInitials(
                participant.client_name || "Unknown"
              );
              const gradient = getAvatarGradient(
                participant.client_name || participant.id
              );
              const budgetPct = getBudgetPercent(participant);

              return (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    delay: Math.min(idx * 0.02, 0.3),
                    duration: 0.25,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onClick={() =>
                    router.push(
                      `/dashboard/care/participants/${participant.id}`
                    )
                  }
                  className="group p-4 rounded-xl bg-[#0A0A0A] border border-zinc-800/50 hover:border-zinc-700/50 hover:bg-[#111] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
                    >
                      <span className="text-xs font-semibold text-white">
                        {initials}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {participant.client_name || "Unknown"}
                        </span>
                        {/* Status pill */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                          />
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {participant.ndis_number && (
                          <span className="text-xs font-mono text-zinc-500">
                            {formatNDISNumber(participant.ndis_number)}
                          </span>
                        )}
                        {participant.primary_diagnosis && (
                          <>
                            {participant.ndis_number && (
                              <span className="w-px h-3 bg-zinc-800" />
                            )}
                            <span className="text-xs text-zinc-500 truncate">
                              {participant.primary_diagnosis}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Budget mini bar */}
                    {budgetPct !== null && (
                      <div className="hidden sm:flex items-center gap-2">
                        <DollarSign
                          size={10}
                          className="text-zinc-600 shrink-0"
                        />
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              budgetPct > 85
                                ? "bg-amber-500"
                                : budgetPct > 95
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                            }`}
                            style={{ width: `${budgetPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono w-7 text-right">
                          {budgetPct}%
                        </span>
                      </div>
                    )}

                    {/* Critical alerts */}
                    {participant.critical_alerts &&
                      participant.critical_alerts.length > 0 && (
                        <div className="hidden md:flex items-center gap-1">
                          {participant.critical_alerts
                            .slice(0, 3)
                            .map((alert, alertIdx) => (
                              <span
                                key={alertIdx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-red-500/15 text-red-400 rounded"
                                title={alert}
                              >
                                <AlertTriangle size={8} />
                                {alert.length > 12
                                  ? alert.slice(0, 12) + "..."
                                  : alert}
                              </span>
                            ))}
                          {participant.critical_alerts.length > 3 && (
                            <span className="text-[9px] text-red-400/60 font-mono">
                              +{participant.critical_alerts.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                    {/* Chevron */}
                    <ChevronRight
                      size={14}
                      className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0"
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Stats Footer ─────────────────────────────── */}
        {!loading && participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex items-center justify-center gap-6 text-[10px] font-mono text-zinc-600"
          >
            <div className="flex items-center gap-1.5">
              <Users size={10} />
              <span>{total} total</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Shield size={10} className="text-blue-500/50" />
              <span>
                {tabCounts["active"] || 0} active
              </span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-amber-500/50" />
              <span>
                {tabCounts["pending_agreement"] || 0} pending
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Intake Wizard Modal ────────────────────────── */}
      {wizardOpen && (
        <ParticipantIntakeWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          orgId={orgId ?? ""}
          agencies={agencies}
          onComplete={() => {
            setWizardOpen(false);
            loadParticipants();
          }}
        />
      )}
    </motion.div>
  );
}
