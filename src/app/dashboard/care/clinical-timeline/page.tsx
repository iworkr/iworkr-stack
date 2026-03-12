"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Pill,
  AlertTriangle,
  FileText,
  Shield,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  Clock,
  X,
  User,
  Heart,
  Thermometer,
  Brain,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  TIMELINE_TYPE_CONFIG,
  SEVERITY_CONFIG,
  type TimelineEvent,
} from "@/lib/care-command-store";

/* ═══════════════════════════════════════════════════════════════════════════════
   Constants & Config
   ═══════════════════════════════════════════════════════════════════════════════ */

type EventType = TimelineEvent["type"] | "all";
type DateRange = "today" | "7d" | "14d" | "30d";

const TYPE_ICON_MAP: Record<TimelineEvent["type"], React.ElementType> = {
  observation: Heart,
  medication: Pill,
  incident: AlertTriangle,
  progress_note: FileText,
  sentinel_alert: Shield,
};

const TYPE_LINE_COLOR: Record<TimelineEvent["type"], string> = {
  observation: "bg-sky-500",
  medication: "bg-purple-500",
  incident: "bg-rose-500",
  progress_note: "bg-emerald-500",
  sentinel_alert: "bg-amber-500",
};

const TYPE_DOT_GLOW: Record<TimelineEvent["type"], string> = {
  observation: "shadow-[0_0_8px_rgba(14,165,233,0.4)]",
  medication: "shadow-[0_0_8px_rgba(168,85,247,0.4)]",
  incident: "shadow-[0_0_8px_rgba(244,63,94,0.4)]",
  progress_note: "shadow-[0_0_8px_rgba(16,185,129,0.4)]",
  sentinel_alert: "shadow-[0_0_8px_rgba(245,158,11,0.4)]",
};

const TYPE_FILTER_CHIPS: { key: EventType; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Events", icon: Activity },
  { key: "observation", label: "Observations", icon: Heart },
  { key: "medication", label: "Medications", icon: Pill },
  { key: "incident", label: "Incidents", icon: AlertTriangle },
  { key: "progress_note", label: "Progress Notes", icon: FileText },
  { key: "sentinel_alert", label: "Sentinel Alerts", icon: Shield },
];

const DATE_RANGE_OPTIONS: { key: DateRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "14d", label: "14 Days" },
  { key: "30d", label: "30 Days" },
];

const MEDICATION_OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  given: { label: "Given", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  refused: { label: "Refused", color: "text-rose-400", bg: "bg-rose-500/10" },
  withheld: { label: "Withheld", color: "text-amber-400", bg: "bg-amber-500/10" },
  self_administered: { label: "Self-Administered", color: "text-sky-400", bg: "bg-sky-500/10" },
  not_available: { label: "Not Available", color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
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

function groupEventsByDate(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const label = getDateGroupLabel(event.timestamp);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(event);
  }
  return Array.from(groups.entries());
}

function filterByDateRange(events: TimelineEvent[], range: DateRange): TimelineEvent[] {
  const now = Date.now();
  const rangeMs: Record<DateRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "14d": 14 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const cutoff = now - rangeMs[range];
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════════════════════════════════════════ */

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, gi) => (
        <div key={gi} className="space-y-3">
          <div className="h-3 w-24 rounded skeleton-shimmer" />
          {Array.from({ length: 3 }).map((_, ci) => (
            <div key={ci} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full skeleton-shimmer" />
                <div className="flex-1 w-px skeleton-shimmer mt-1" />
              </div>
              <div className="flex-1 r-card border border-white/[0.05] bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 rounded-full skeleton-shimmer" />
                  <div className="h-4 w-40 rounded skeleton-shimmer" />
                </div>
                <div className="h-3 w-full rounded skeleton-shimmer" />
                <div className="flex gap-2">
                  <div className="h-3 w-16 rounded skeleton-shimmer" />
                  <div className="h-3 w-12 rounded skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Type Stat Counter
   ═══════════════════════════════════════════════════════════════════════════════ */

function TypeStatBadge({
  type,
  count,
  delay,
}: {
  type: TimelineEvent["type"];
  count: number;
  delay: number;
}) {
  const config = TIMELINE_TYPE_CONFIG[type];
  const Icon = TYPE_ICON_MAP[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bg} border border-white/[0.04]`}
    >
      <Icon className={`w-3 h-3 ${config.color}`} />
      <span className={`font-mono text-[11px] font-semibold tabular-nums ${config.color}`}>
        {count}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Event Badges — Extracted to avoid deep JSX type inference
   ═══════════════════════════════════════════════════════════════════════════════ */

function _EventBadges({
  event,
  workerLabel,
  participantLabel,
  metadata,
}: {
  event: TimelineEvent;
  workerLabel: string;
  participantLabel: string;
  metadata: Record<string, unknown>;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {workerLabel.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
          <User className="w-3 h-3 text-zinc-600" />
          {workerLabel}
        </span>
      )}
      {participantLabel.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
          <Heart className="w-3 h-3 text-zinc-600" />
          {participantLabel}
        </span>
      )}
      {event.type === "observation" && metadata.value_numeric != null && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/8 border border-sky-500/15 text-[10px] font-mono text-sky-400">
          <Thermometer className="w-3 h-3" />
          {String(metadata.value_numeric)}
          {metadata.unit ? ` ${String(metadata.unit)}` : ""}
        </span>
      )}
      {event.type === "observation" && metadata.is_abnormal === true && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 tracking-wider">
          ABNORMAL
        </span>
      )}
      {event.type === "medication" && typeof metadata.outcome === "string" && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/[0.06] ${
            MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.bg ?? "bg-zinc-500/10"
          } ${MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.color ?? "text-zinc-400"}`}
        >
          {MEDICATION_OUTCOME_CONFIG[metadata.outcome]?.label ?? metadata.outcome}
        </span>
      )}
      {event.type === "incident" && typeof metadata.category === "string" && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400 capitalize">
          {metadata.category.replace(/_/g, " ")}
        </span>
      )}
      {event.type === "incident" && typeof metadata.status === "string" && (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-500 capitalize">
          {metadata.status.replace(/_/g, " ")}
        </span>
      )}
      {event.type === "sentinel_alert" && Array.isArray(metadata.triggered_keywords) && (metadata.triggered_keywords as string[]).length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {(metadata.triggered_keywords as string[]).slice(0, 4).map((kw: string) => (
            <span key={kw} className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-medium text-amber-400">
              {kw}
            </span>
          ))}
          {(metadata.triggered_keywords as string[]).length > 4 && (
            <span className="text-[9px] text-zinc-600">+{(metadata.triggered_keywords as string[]).length - 4}</span>
          )}
        </div>
      )}
      {event.type === "progress_note" && typeof metadata.mood === "string" && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/8 border border-emerald-500/15 text-[10px] text-emerald-400">
          <Brain className="w-3 h-3" />
          {metadata.mood}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Timeline Card — Expandable event card
   ═══════════════════════════════════════════════════════════════════════════════ */

function _TimelineCard({
  event,
  index,
  isLast,
}: {
  event: TimelineEvent;
  index: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = TIMELINE_TYPE_CONFIG[event.type];
  const Icon = TYPE_ICON_MAP[event.type];
  const lineColor = TYPE_LINE_COLOR[event.type];
  const dotGlow = TYPE_DOT_GLOW[event.type];
  const severityConfig = event.severity ? SEVERITY_CONFIG[event.severity] : null;
  const isCritical = event.severity === "critical";
  const isWarning = event.severity === "warning";

  const metadata = event.metadata || {};
  const participantLabel = String(event.participant_name || "");
  const workerLabel = String(event.worker_name || "");

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ delay: index * 0.025, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-4 group"
    >
      {/* ── Timeline Spine ── */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        {/* Dot */}
        <div className="relative">
          <div
            className={`h-3 w-3 rounded-full ${lineColor} ${dotGlow} ring-2 ring-[#0A0A0A] transition-all duration-300 group-hover:scale-125`}
          />
          {(isCritical || isWarning) && (
            <div
              className={`absolute inset-0 rounded-full ${lineColor} animate-ping opacity-30`}
            />
          )}
        </div>
        {/* Connecting line */}
        {!isLast && (
          <div className={`flex-1 w-px ${lineColor} opacity-20 mt-1 min-h-[24px]`} />
        )}
      </div>

      {/* ── Card ── */}
      <div className="flex-1 min-w-0 pb-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`w-full text-left r-card border bg-white/[0.02] p-4 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1] cursor-pointer ${
            isCritical
              ? "border-rose-500/20"
              : isWarning
              ? "border-amber-500/15"
              : "border-white/[0.05]"
          } ${expanded ? "border-white/[0.12]" : ""}`}
          style={{ boxShadow: "var(--shadow-inset-bevel)" }}
        >
          {/* Top row: type badge + title + severity + timestamp */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* Type badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${config.bg} ${config.color} border border-white/[0.06] flex-shrink-0`}
              >
                <Icon className="w-3 h-3" />
                {config.label}
              </span>

              {/* Severity pill */}
              {severityConfig && (event.severity === "critical" || event.severity === "warning") && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${severityConfig.bg} ${severityConfig.color} border ${severityConfig.border} flex-shrink-0`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${severityConfig.dot} ${severityConfig.glow}`} />
                  {severityConfig.label.toUpperCase()}
                </span>
              )}

              {/* Title */}
              <h3 className="text-[13px] font-medium text-zinc-100 tracking-tight truncate">
                {event.title}
              </h3>
            </div>

            {/* Timestamp + expand indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-[10px] text-zinc-600 tabular-nums whitespace-nowrap">
                {formatRelativeDate(event.timestamp)}
              </span>
              <ChevronRight
                className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-200 ${
                  expanded ? "rotate-90" : ""
                }`}
              />
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-[12px] text-zinc-500 leading-relaxed mb-2 line-clamp-2 pl-0.5">
            {event.subtitle}
          </p>

          {/* Bottom row: worker + type-specific badges */}
          <_EventBadges event={event} workerLabel={workerLabel} participantLabel={participantLabel} metadata={metadata} />
        </button>

        {/* ── Expanded detail panel ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-1 r-card border border-white/[0.06] bg-[#0A0A0A] p-4 space-y-3">
                {/* Full timestamp */}
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Clock className="w-3.5 h-3.5 text-zinc-600" />
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

                {/* Full subtitle / description */}
                {event.subtitle && (
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                      Description
                    </p>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">
                      {event.subtitle}
                    </p>
                  </div>
                )}

                {/* Metadata grid */}
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                    Event Details
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(metadata).map(([key, value]) => {
                      if (value == null || (Array.isArray(value) && value.length === 0)) return null;
                      return (
                        <div
                          key={key}
                          className="px-2.5 py-1.5 rounded bg-white/[0.03] border border-white/[0.04]"
                        >
                          <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] text-zinc-300 font-mono truncate">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* IDs */}
                <div className="flex items-center gap-4 pt-1 border-t border-white/[0.04]">
                  <span className="font-mono text-[9px] text-zinc-700">
                    ID: {event.id.slice(0, 12)}…
                  </span>
                  {event.participant_id && (
                    <span className="font-mono text-[9px] text-zinc-700">
                      Participant: {event.participant_id.slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════════════════════════ */

function EmptyTimeline({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="stealth-empty-state py-20"
    >
      <div className="relative mb-6">
        <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
        <div className="stealth-empty-state-icon animate-zen-breathe">
          <Activity className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
      <h3 className="stealth-empty-state-title">
        {hasFilters ? "No matching events" : "No clinical events"}
      </h3>
      <p className="stealth-empty-state-desc">
        {hasFilters
          ? "Try adjusting your filters or date range to see more events."
          : "Clinical events will appear here as observations, medications, incidents, and notes are recorded."}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function ClinicalTimelinePage() {
  const { orgId } = useOrg();
  const {
    timeline,
    timelineLoading,
    fetchTimeline,
  } = useCareCommandStore();

  const [typeFilter, setTypeFilter] = useState<EventType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("14d");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  /* ── Load timeline data ── */
  useEffect(() => {
    if (orgId) {
      fetchTimeline(orgId);
    }
  }, [orgId, fetchTimeline]);

  /* ── Filter pipeline ── */
  const filteredEvents = useMemo(() => {
    let events = [...timeline];

    // Type filter
    if (typeFilter !== "all") {
      events = events.filter((e) => e.type === typeFilter);
    }

    // Date range
    events = filterByDateRange(events, dateRange);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          e.worker_name?.toLowerCase().includes(q) ||
          e.participant_name?.toLowerCase().includes(q)
      );
    }

    return events;
  }, [timeline, typeFilter, dateRange, searchQuery]);

  /* ── Grouped by date ── */
  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  /* ── Type stats ── */
  const typeStats = useMemo(() => {
    const rangeFiltered = filterByDateRange(timeline, dateRange);
    return {
      observation: rangeFiltered.filter((e) => e.type === "observation").length,
      medication: rangeFiltered.filter((e) => e.type === "medication").length,
      incident: rangeFiltered.filter((e) => e.type === "incident").length,
      progress_note: rangeFiltered.filter((e) => e.type === "progress_note").length,
      sentinel_alert: rangeFiltered.filter((e) => e.type === "sentinel_alert").length,
    };
  }, [timeline, dateRange]);

  const hasActiveFilters = typeFilter !== "all" || searchQuery.trim().length > 0;

  const clearFilters = useCallback(() => {
    setTypeFilter("all");
    setSearchQuery("");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative min-h-screen bg-[var(--background)]"
    >
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow — blue tint for clinical */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-72 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(59,130,246,0.025) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto p-6 lg:p-8 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════
           Header
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-blue-400/60 mb-1">
              CLINICAL INTELLIGENCE
            </p>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
              Clinical Timeline
            </h1>
            <p className="text-[13px] text-zinc-500 mt-1">
              Unified clinical history across all event types
            </p>
          </motion.div>

          {/* Type stat counters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="hidden sm:flex items-center gap-2 flex-wrap justify-end"
          >
            {(Object.keys(typeStats) as TimelineEvent["type"][]).map((type, i) => (
              <TypeStatBadge
                key={type}
                type={type}
                count={typeStats[type]}
                delay={0.1 + i * 0.04}
              />
            ))}
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
           Filter Bar
           ═══════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="r-card border border-white/[0.05] bg-[#0A0A0A] rounded-xl p-4 space-y-3"
          style={{ boxShadow: "var(--shadow-inset-bevel)" }}
        >
          {/* Search + Date range row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200 ${
                  searchFocused ? "text-blue-400" : "text-zinc-600"
                }`}
              />
              <input
                type="text"
                placeholder="Search events, workers, participants…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full pl-9 pr-8 py-2 r-input bg-white/[0.03] border border-white/[0.06] rounded-lg text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-blue-500/30 focus:bg-white/[0.04] transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Date range selector */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/[0.06] p-0.5">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDateRange(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    dateRange === opt.key
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all"
              >
                <X className="w-3 h-3" />
                Clear
              </motion.button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-zinc-600 mr-1" />
            {TYPE_FILTER_CHIPS.map((chip) => {
              const ChipIcon = chip.icon;
              const isActive = typeFilter === chip.key;
              const chipConfig = chip.key !== "all" ? TIMELINE_TYPE_CONFIG[chip.key] : null;
              const count = chip.key !== "all" ? typeStats[chip.key] : filteredEvents.length;

              return (
                <button
                  key={chip.key}
                  onClick={() => setTypeFilter(chip.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                    isActive
                      ? chip.key === "all"
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                        : `${chipConfig!.bg} ${chipConfig!.color} border-white/[0.08]`
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <ChipIcon className="w-3 h-3" />
                  {chip.label}
                  <span
                    className={`font-mono text-[9px] tabular-nums ${
                      isActive ? "opacity-80" : "text-zinc-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════════
           Mobile Type Stats (visible on small screens)
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex sm:hidden items-center gap-2 flex-wrap">
          {(Object.keys(typeStats) as TimelineEvent["type"][]).map((type, i) => (
            <TypeStatBadge
              key={type}
              type={type}
              count={typeStats[type]}
              delay={0.1 + i * 0.04}
            />
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
           Timeline
           ═══════════════════════════════════════════════════════════════════════ */}
        <div className="relative">
          {timelineLoading && <TimelineSkeleton />}

          {!timelineLoading && filteredEvents.length === 0 && (
            <EmptyTimeline hasFilters={hasActiveFilters} />
          )}

          {!timelineLoading && filteredEvents.length > 0 && (
            <div className="space-y-6">
              {groupedEvents.map(([dateLabel, events], groupIndex) => (
                <motion.div
                  key={dateLabel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: groupIndex * 0.06,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {/* Date group header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                      <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                        {dateLabel}
                      </h2>
                    </div>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                    <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
                      {events.length} event{events.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="pl-1">
                    <AnimatePresence mode="popLayout">
                      {events.map((event, eventIndex) => (
                        <_TimelineCard
                          key={event.id}
                          event={event}
                          index={eventIndex}
                          isLast={eventIndex === events.length - 1}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}

              {/* End of timeline marker */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex items-center gap-3 py-4"
              >
                <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.04]">
                  <Clock className="w-3 h-3 text-zinc-700" />
                  <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">
                    End of timeline — {filteredEvents.length} events
                  </span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-l from-white/[0.04] to-transparent" />
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline Keyframes ── */}
      <style>{`
        @keyframes timeline-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </motion.div>
  );
}
