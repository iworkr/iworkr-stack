"use client";

import { AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Users,
  AlertTriangle,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { type ParticipantProfile } from "@/app/actions/participants";
import { formatNDISNumber } from "@/lib/ndis-utils";
import { NewParticipantOverlay } from "@/components/care/new-participant-overlay";
import { VirtualizedList } from "@/components/ui/virtualized-list";
import { useInfiniteParticipants, usePrefetchParticipant, useInvalidateParticipants } from "@/lib/hooks/use-participants-query";

/* ── Status Config ────────────────────────────────────── */

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  active: {
    label: "Active",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  pending_agreement: {
    label: "Pending",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  on_hold: {
    label: "On Hold",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/20",
    dot: "bg-zinc-500",
  },
  discharged: {
    label: "Discharged",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  archived: {
    label: "Archived",
    bg: "bg-zinc-700/10",
    text: "text-zinc-600",
    border: "border-zinc-700/20",
    dot: "bg-zinc-700",
  },
};

type StatusTab = "all" | "active" | "pending_agreement" | "on_hold" | "discharged";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending_agreement", label: "Pending" },
  { key: "on_hold", label: "On Hold" },
  { key: "discharged", label: "Discharged" },
];

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKELETON_WIDTHS = [
  { name: "w-24", ndis: "w-20", diag: "w-16" },
  { name: "w-32", ndis: "w-16", diag: "w-20" },
  { name: "w-28", ndis: "w-20", diag: "w-12" },
  { name: "w-20", ndis: "w-16", diag: "w-18" },
  { name: "w-36", ndis: "w-20", diag: "w-14" },
  { name: "w-24", ndis: "w-16", diag: "w-20" },
  { name: "w-32", ndis: "w-20", diag: "w-16" },
  { name: "w-28", ndis: "w-16", diag: "w-12" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const w = SKELETON_WIDTHS[idx % SKELETON_WIDTHS.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse shrink-0" />
          <div className={`h-3 ${w.name} bg-zinc-900 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${w.ndis} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className={`h-3 ${w.diag} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 bg-zinc-900/40 rounded-sm animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function ParticipantsPage() {
  const router = useRouter();
  const { orgId } = useOrg();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<StatusTab>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Debounced search ──────────────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── TanStack Query — infinite cursor-based participant list ── */
  const queryFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: selectedTab !== "all" ? selectedTab : undefined,
  }), [debouncedSearch, selectedTab]);

  const {
    data: infiniteData,
    isLoading: loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteParticipants(orgId, queryFilters);

  const participants = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.data) ?? [],
    [infiniteData]
  );
  const total = infiniteData?.pages[0]?.total ?? 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const prefetch = usePrefetchParticipant();
  const { invalidateList } = useInvalidateParticipants();

  /* ── Tab counts ──────────────────────────────────────── */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of participants) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [participants]);

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

  const hasFilters = search.length > 0 || selectedTab !== "all";

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-0">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Participants
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {TABS.map((t) => {
              const isActive = selectedTab === t.key;
              const count = t.key === "all" ? total : tabCounts[t.key] || 0;
              return (
                <button
                  key={t.key}
                  onClick={() => { setSelectedTab(t.key); setFocusedIndex(0); }}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "text-white bg-white/10 shadow-sm font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
              placeholder="Search participants…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>

          <button
            onClick={() => setWizardOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New Participant
          </button>
        </div>
      </div>

      {/* ── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Column Headers */}
        <div className="shrink-0">
          <div className="flex items-center h-10 border-b border-white/5">
            <div className="w-[28%] px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Participant</div>
            <div className="w-[15%] px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">NDIS Number</div>
            <div className="w-[12%] px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Status</div>
            <div className="w-[18%] px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Diagnosis</div>
            <div className="w-[22%] px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Alerts</div>
            <div className="w-10" />
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading && participants.length === 0 && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} idx={i} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && participants.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 my-6 w-full max-w-lg">
              <Users className="w-8 h-8 text-zinc-800 mb-4" />
              <p className="text-sm text-zinc-500">
                {hasFilters ? "No participants match your filters." : "No participants yet."}
              </p>
              <div className="mt-3">
                {hasFilters ? (
                  <button
                    onClick={() => { setSearch(""); setSelectedTab("all"); }}
                    className="text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    onClick={() => setWizardOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add first participant
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Participant Rows */}
        {participants.length > 0 && (
          <VirtualizedList
            items={participants}
            estimateSize={64}
            overscan={10}
            className="min-h-0 flex-1 scrollbar-none"
            getItemKey={(p) => p.id}
            onEndReached={loadMore}
            endReachedThreshold={10}
            renderItem={(participant, idx) => {
              const sc = statusConfig[participant.status] ?? statusConfig.active;
              const name = participant.client_name || "Unknown";
              const initials = getInitials(name);
              const isFocused = idx === focusedIndex;

              return (
                <div
                  onMouseEnter={() => orgId && prefetch(participant.id, orgId)}
                  onClick={() => router.push(`/dashboard/care/participants/${participant.id}`)}
                  className={`group flex items-center border-b border-white/5 cursor-pointer transition-colors h-16 ${
                    isFocused ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Participant */}
                  <div className="w-[28%] px-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-xs text-zinc-400 font-medium select-none">{initials}</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate">{name}</span>
                        <span className="text-[10px] font-mono text-zinc-600 truncate">
                          ID: {participant.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* NDIS Number */}
                  <div className="w-[15%] px-4 py-3">
                    {participant.ndis_number ? (
                      <span className="text-xs font-mono text-zinc-400">
                        {formatNDISNumber(participant.ndis_number)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="w-[12%] px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Diagnosis */}
                  <div className="w-[18%] px-4 py-3">
                    <span className="text-sm text-zinc-300 truncate block">
                      {participant.primary_diagnosis || "—"}
                    </span>
                  </div>

                  {/* Alerts */}
                  <div className="w-[22%] px-4 py-3">
                    {participant.critical_alerts && participant.critical_alerts.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {participant.critical_alerts.slice(0, 2).map((alert, alertIdx) => (
                          <span
                            key={alertIdx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md"
                            title={alert}
                          >
                            <AlertTriangle size={9} />
                            {alert.length > 14 ? alert.slice(0, 14) + "…" : alert}
                          </span>
                        ))}
                        {participant.critical_alerts.length > 2 && (
                          <span className="text-[10px] text-rose-400/50 font-mono">
                            +{participant.critical_alerts.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-700">—</span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div className="w-10 flex justify-center">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Infinite scroll loading */}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center border-t border-white/[0.03] py-2 gap-2">
          <div className="h-1 w-1 rounded-full bg-zinc-500 animate-pulse" />
          <span className="font-mono text-[10px] text-zinc-600">Loading more…</span>
        </div>
      )}

      {/* ── New Participant Overlay ─────────────────────── */}
      <NewParticipantOverlay
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          if (orgId) invalidateList(orgId);
        }}
      />
    </div>
  );
}
