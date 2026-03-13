"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Search,
  ChevronRight,
  Clock,
  X,
  User,
  Heart,
  Thermometer,
  Brain,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  TIMELINE_TYPE_CONFIG,
  SEVERITY_CONFIG,
  type TimelineEvent,
} from "@/lib/care-command-store";

/* ═══════════════════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════════════════ */

type EventType = TimelineEvent["type"] | "all";
type DateRange = "today" | "7d" | "14d" | "30d";

const TYPE_LINE_COLOR: Record<TimelineEvent["type"], string> = {
  observation: "bg-sky-500",
  medication: "bg-purple-500",
  incident: "bg-rose-500",
  progress_note: "bg-emerald-500",
  sentinel_alert: "bg-amber-500",
};

const TYPE_FILTER_OPTIONS: { key: EventType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "observation", label: "Observations" },
  { key: "medication", label: "Medications" },
  { key: "incident", label: "Incidents" },
  { key: "progress_note", label: "Notes" },
  { key: "sentinel_alert", label: "Alerts" },
];

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
];

const MEDICATION_OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  given: { label: "Given", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  refused: { label: "Refused", color: "text-rose-400", bg: "bg-rose-500/10" },
  withheld: { label: "Withheld", color: "text-amber-400", bg: "bg-amber-500/10" },
  self_administered: { label: "Self-Administered", color: "text-sky-400", bg: "bg-sky-500/10" },
  not_available: { label: "Not Available", color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ═══════════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateGroupKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateGroupLabel(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (eventDay.getTime() === today.getTime()) return "Today";
  if (eventDay.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupEventsByDate(events: TimelineEvent[]): { label: string; events: TimelineEvent[] }[] {
  const map = new Map<string, { label: string; events: TimelineEvent[] }>();
  for (const event of events) {
    const key = getDateGroupKey(event.timestamp);
    if (!map.has(key)) {
      map.set(key, { label: getDateGroupLabel(event.timestamp), events: [] });
    }
    map.get(key)!.events.push(event);
  }
  return Array.from(map.values());
}

function filterByDateRange(events: TimelineEvent[], range: DateRange): TimelineEvent[] {
  const now = Date.now();
  const ms: Record<DateRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "14d": 14 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const cutoff = now - ms[range];
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════════ */

function TimelineSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="r-card mb-2 p-4">
          <div className="skeleton-shimmer h-4 w-48 rounded mb-2" />
          <div className="skeleton-shimmer h-3 w-32 rounded" />
        </div>
      ))}
    </div>
  );
}

function MetadataPanel({ event }: { event: TimelineEvent }) {
  const metadata = event.metadata || {};
  const entries = Object.entries(metadata).filter(
    ([, v]) => v != null && !(Array.isArray(v) && v.length === 0)
  );

  if (entries.length === 0 && !event.subtitle) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
      className="mt-3 overflow-hidden border-t border-white/[0.04] pt-3"
    >
      {/* Full timestamp */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mb-3">
        <Clock size={12} className="text-[var(--text-muted)]" />
        <span className="font-mono">
          {new Date(event.timestamp).toLocaleString("en-AU", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* Description */}
      {event.subtitle && (
        <div className="mb-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
            Description
          </p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{event.subtitle}</p>
        </div>
      )}

      {/* Type-specific badges */}
      <EventBadges event={event} metadata={metadata} />

      {/* Metadata grid */}
      {entries.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Event Details
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {entries.map(([key, value]) => (
              <div key={key} className="px-2.5 py-1.5 rounded bg-white/[0.03] border border-white/[0.04]">
                <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-zinc-300 font-mono truncate">
                  {Array.isArray(value) ? value.join(", ") : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IDs */}
      <div className="flex items-center gap-4 pt-3 mt-3 border-t border-white/[0.04]">
        <span className="font-mono text-[10px] text-zinc-700">ID: {event.id.slice(0, 12)}…</span>
        {event.participant_id && (
          <span className="font-mono text-[10px] text-zinc-700">
            Participant: {event.participant_id.slice(0, 8)}…
          </span>
        )}
      </div>
    </motion.div>
  );
}

function EventBadges({ event, metadata }: { event: TimelineEvent; metadata: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Observation: numeric value */}
      {event.type === "observation" && metadata.value_numeric != null && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/8 border border-sky-500/15 text-[10px] font-mono text-sky-400">
          <Thermometer size={12} />
          {String(metadata.value_numeric)}
          {metadata.unit ? ` ${String(metadata.unit)}` : ""}
        </span>
      )}
      {event.type === "observation" && metadata.is_abnormal === true && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400 tracking-wider">
          ABNORMAL
        </span>
      )}

      {/* Medication: outcome */}
      {event.type === "medication" && typeof metadata.outcome === "string" && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/[0.06] ${
            MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.bg ?? "bg-zinc-500/10"
          } ${MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.color ?? "text-zinc-400"}`}
        >
          {MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.label ?? metadata.outcome}
        </span>
      )}

      {/* Incident: category + status */}
      {event.type === "incident" && typeof metadata.category === "string" && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400 capitalize">
          {metadata.category.replace(/_/g, " ")}
        </span>
      )}
      {event.type === "incident" && typeof metadata.status === "string" && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] text-[var(--text-muted)] capitalize">
          {metadata.status.replace(/_/g, " ")}
        </span>
      )}

      {/* Sentinel: triggered keywords */}
      {event.type === "sentinel_alert" && Array.isArray(metadata.triggered_keywords) && (metadata.triggered_keywords as string[]).length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {(metadata.triggered_keywords as string[]).slice(0, 4).map((kw: string) => (
            <span key={kw} className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-400">
              {kw}
            </span>
          ))}
          {(metadata.triggered_keywords as string[]).length > 4 && (
            <span className="text-[10px] text-[var(--text-muted)]">
              +{(metadata.triggered_keywords as string[]).length - 4}
            </span>
          )}
        </div>
      )}

      {/* Progress note: mood */}
      {event.type === "progress_note" && typeof metadata.mood === "string" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/8 border border-emerald-500/15 text-[10px] text-emerald-400">
          <Brain size={12} />
          {metadata.mood}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function ClinicalTimelinePage() {
  const { orgId } = useOrg();
  const { timeline, timelineLoading, fetchTimeline } = useCareCommandStore();

  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("14d");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Load data ── */
  useEffect(() => {
    if (orgId) fetchTimeline(orgId);
  }, [orgId, fetchTimeline]);

  /* ── Filter pipeline ── */
  const filteredEvents = useMemo(() => {
    let events = [...timeline];

    if (typeFilter !== "all") {
      events = events.filter((e) => e.type === typeFilter);
    }

    events = filterByDateRange(events, dateRange);

    if (search.trim()) {
      const q = search.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          e.worker_name?.toLowerCase().includes(q) ||
          e.participant_name?.toLowerCase().includes(q)
      );
    }

    return events;
  }, [timeline, typeFilter, dateRange, search]);

  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);
  const hasActiveFilters = typeFilter !== "all" || search.trim().length > 0;

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────────
          Sticky Header
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          {/* LEFT: breadcrumb + overline + type filters */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] mb-0.5">
                <span className="text-[var(--text-muted)]">Dashboard</span>
                <ChevronRight size={10} className="text-zinc-700" />
                <span className="font-medium text-white">Care Command</span>
              </div>
              <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
                CLINICAL TIMELINE
              </span>
            </div>

            {/* Divider */}
            <div className="ml-4 h-4 w-px bg-white/[0.06]" />

            {/* Type filter chips */}
            <div className="flex items-center gap-1">
              {TYPE_FILTER_OPTIONS.map((opt) => {
                const isActive = typeFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setTypeFilter(opt.key)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] transition-all duration-150 cursor-pointer border ${
                      isActive
                        ? "bg-white/[0.06] text-white border-white/[0.1] font-medium"
                        : "border-white/[0.06] text-[var(--text-muted)] hover:text-zinc-300 hover:border-white/[0.1]"
                    }`}
                  >
                    {opt.key !== "all" && (
                      <span className="mr-1">{TIMELINE_TYPE_CONFIG[opt.key as TimelineEvent["type"]].icon}</span>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: stealth search + date range */}
          <div className="flex items-center gap-2">
            {/* Stealth search */}
            <div className="relative flex items-center gap-2">
              <motion.div
                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-[var(--brand)]"
                initial={false}
                animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              />
              <div className="flex items-center gap-2 pl-2">
                <Search
                  size={12}
                  className={`shrink-0 transition-colors duration-150 ${
                    searchFocused ? "text-[var(--brand)]" : "text-zinc-600"
                  }`}
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search events..."
                  className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !search && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[10px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-white/[0.06]" />

            {/* Date range pills */}
            <div className="flex items-center gap-1">
              {DATE_RANGE_OPTIONS.map((opt) => {
                const isActive = dateRange === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDateRange(opt.key)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] transition-all duration-150 cursor-pointer border ${
                      isActive
                        ? "bg-white/[0.06] text-white border-white/[0.1] font-medium"
                        : "border-white/[0.06] text-[var(--text-muted)] hover:text-zinc-300 hover:border-white/[0.1]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          Scrollable Timeline
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4">
        {/* Loading */}
        {timelineLoading && <TimelineSkeleton />}

        {/* Empty state */}
        {!timelineLoading && filteredEvents.length === 0 && (
          <div className="stealth-empty-state">
            <div className="stealth-empty-state-icon">
              <Activity size={24} />
            </div>
            <h3 className="stealth-empty-state-title">
              {hasActiveFilters ? "No matching events" : "No clinical events"}
            </h3>
            <p className="stealth-empty-state-desc">
              {hasActiveFilters
                ? "Try adjusting your filters or date range to see more events."
                : "Clinical events will appear here as they are recorded."}
            </p>
          </div>
        )}

        {/* Timeline groups */}
        {!timelineLoading && filteredEvents.length > 0 && (
          <div className="space-y-6">
            {groupedEvents.map((group) => (
              <div key={group.label} className="mb-6">
                {/* Date group header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 py-2">
                  <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">
                    {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Event cards */}
                {group.events.map((event, i) => {
                  const config = TIMELINE_TYPE_CONFIG[event.type];
                  const isExpanded = expandedId === event.id;

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: Math.min(i * 0.02, 0.3),
                        duration: 0.25,
                        ease: EASE_OUT_EXPO,
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="r-card group relative mb-2 cursor-pointer p-4 transition-colors hover:bg-white/[0.02]"
                      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type dot */}
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TYPE_LINE_COLOR[event.type]}`} />

                        <div className="flex-1 min-w-0">
                          {/* Type label + severity */}
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            {event.severity && event.severity !== "normal" && (
                              <span className={`text-[10px] ${SEVERITY_CONFIG[event.severity].color}`}>
                                {SEVERITY_CONFIG[event.severity].label}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="mt-0.5 text-[13px] font-medium text-white">{event.title}</h3>

                          {/* Subtitle */}
                          <p className="mt-0.5 text-[12px] text-[var(--text-muted)] line-clamp-2">
                            {event.subtitle}
                          </p>

                          {/* Meta row: participant, worker, time */}
                          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                            {event.participant_name && (
                              <span className="inline-flex items-center gap-1">
                                <Heart size={10} className="text-[var(--text-muted)]" />
                                {event.participant_name}
                              </span>
                            )}
                            {event.worker_name && (
                              <span className="inline-flex items-center gap-1">
                                <User size={10} className="text-[var(--text-muted)]" />
                                by {event.worker_name}
                              </span>
                            )}
                            <span className="font-mono">{formatTime(event.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && <MetadataPanel event={event} />}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            ))}

            {/* End of timeline marker */}
            <div className="flex items-center gap-3 py-4">
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.04]">
                <Clock size={12} className="text-zinc-700" />
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                  End of timeline — {filteredEvents.length} events
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-white/[0.04] to-transparent" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
