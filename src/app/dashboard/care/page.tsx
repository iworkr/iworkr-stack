"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Activity,
  Heart,
  Users,
  Wallet,
  Target,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  Clock,
  ChevronRight,
  Zap,
  Brain,
  Eye,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  SEVERITY_CONFIG,
  ALERT_TYPE_LABELS,
  type CareSnapshot,
  type SentinelAlert,
} from "@/lib/care-command-store";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const EASE_STEALTH: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FADE_UP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE_STEALTH },
};

const MOOD_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  happy: { bg: "bg-emerald-500", text: "text-emerald-400", label: "Happy" },
  content: { bg: "bg-sky-500", text: "text-sky-400", label: "Content" },
  neutral: { bg: "bg-zinc-500", text: "text-zinc-400", label: "Neutral" },
  anxious: { bg: "bg-amber-500", text: "text-amber-400", label: "Anxious" },
  distressed: { bg: "bg-rose-500", text: "text-rose-400", label: "Distressed" },
  sad: { bg: "bg-violet-500", text: "text-violet-400", label: "Sad" },
  agitated: { bg: "bg-orange-500", text: "text-orange-400", label: "Agitated" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function _relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function _formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function _formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function _liveTimestamp(): string {
  return new Date().toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// _MetricCard
// ═══════════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subStats?: { label: string; value: number; color?: string }[];
  progress?: number; // 0-100
  accent?: "brand" | "emerald" | "rose" | "amber";
  glow?: boolean;
  delay?: number;
}

function _MetricCard({
  icon,
  label,
  value,
  subStats,
  progress,
  accent = "brand",
  glow = false,
  delay = 0,
}: MetricCardProps) {
  const accentMap = {
    brand: {
      text: "text-[var(--brand)]",
      bg: "bg-[var(--ghost-emerald)]",
      border: "border-[var(--brand)]/20",
      bar: "bg-[var(--brand)]",
      glowShadow: "shadow-[var(--brand-glow)]",
    },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      bar: "bg-emerald-500",
      glowShadow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.15)]",
    },
    rose: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      bar: "bg-rose-500",
      glowShadow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.2)]",
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      bar: "bg-amber-500",
      glowShadow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.15)]",
    },
  };
  const a = accentMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className={`r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)] ${
        glow ? a.glowShadow : ""
      }`}
      style={{ boxShadow: glow ? undefined : "var(--shadow-inset-bevel)" }}
    >
      {/* Icon + label */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.bg} ${a.text}`}>
          {icon}
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="mb-1 font-mono text-[28px] font-semibold tracking-tighter text-white">
        {typeof value === "number" ? _formatNumber(value) : value}
      </div>

      {/* Sub-stats */}
      {subStats && subStats.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {subStats.map((s) => (
            <span key={s.label} className="font-mono text-[11px] text-[var(--text-muted)]">
              <span className={`font-medium ${s.color || "text-zinc-300"}`}>{s.value}</span>{" "}
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 1, ease: EASE_STEALTH, delay: delay + 0.3 }}
              className={`h-full rounded-full ${a.bar}`}
            />
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">0%</span>
            <span className={`text-[10px] font-medium ${a.text}`}>{progress.toFixed(1)}%</span>
            <span className="text-[10px] text-[var(--text-muted)]">100%</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// _ClinicalPulseCard
// ═══════════════════════════════════════════════════════════════════════════════

function _ClinicalPulseCard({
  clinical,
  loading,
  delay = 0,
}: {
  clinical: CareSnapshot["clinical"] | null;
  loading: boolean;
  delay?: number;
}) {
  const compliance = clinical?.mar_compliance_pct ?? 0;
  const circumference = 2 * Math.PI * 36; // r=36
  const strokeDashoffset = circumference - (compliance / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className="r-card col-span-6 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Heart size={14} className="text-rose-400" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          CLINICAL PULSE
        </span>
      </div>

      {loading || !clinical ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton-shimmer h-24 rounded" />
          <div className="skeleton-shimmer h-24 rounded" />
          <div className="skeleton-shimmer col-span-2 h-16 rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* MAR Compliance Ring */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-4">
            <span className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              MAR Compliance
            </span>
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="5"
                />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke={compliance >= 95 ? "#10B981" : compliance >= 80 ? "#F59E0B" : "#F43F5E"}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.2, ease: EASE_STEALTH, delay: delay + 0.2 }}
                />
              </svg>
              <span className="absolute text-lg font-semibold text-white">
                {compliance.toFixed(0)}%
              </span>
            </div>
            <span className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
              {clinical.mar_entries_24h} entries today
            </span>
          </div>

          {/* Observations & Notes */}
          <div className="flex flex-col gap-3">
            {/* Observations */}
            <div className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Observations 24h
                </span>
                <Eye size={12} className="text-sky-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-xl font-semibold text-white">
                  {clinical.observations_24h}
                </span>
                {clinical.abnormal_observations > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                    <AlertTriangle size={10} />
                    {clinical.abnormal_observations} abnormal
                  </span>
                )}
              </div>
            </div>

            {/* Progress notes */}
            <div className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Progress Notes 7d
                </span>
                <ClipboardList size={12} className="text-emerald-400" />
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-white">
                {clinical.progress_notes_7d}
              </div>
            </div>
          </div>

          {/* Mood Distribution */}
          <div className="col-span-2 rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3">
            <span className="mb-2.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Mood Distribution
            </span>
            {Object.keys(clinical.mood_distribution).length === 0 ? (
              <span className="font-mono text-[11px] text-[var(--text-muted)]">No mood data recorded yet</span>
            ) : (
              <div className="flex items-end gap-2">
                {Object.entries(clinical.mood_distribution).map(([mood, count]) => {
                  const total = Object.values(clinical.mood_distribution).reduce(
                    (a, b) => a + b,
                    0
                  );
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  const config = MOOD_COLORS[mood] || {
                    bg: "bg-zinc-500",
                    text: "text-zinc-400",
                    label: mood,
                  };
                  return (
                    <div key={mood} className="flex flex-1 flex-col items-center gap-1">
                      <span className={`text-[10px] font-medium ${config.text}`}>{count}</span>
                      <motion.div
                        className={`w-full rounded-sm ${config.bg}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(4, pct * 0.5)}px` }}
                        transition={{ duration: 0.8, ease: EASE_STEALTH, delay: delay + 0.3 }}
                        style={{ minHeight: 4, maxHeight: 32 }}
                      />
                      <span className="text-[10px] capitalize text-[var(--text-muted)]">{config.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// _SentinelFeedCard
// ═══════════════════════════════════════════════════════════════════════════════

function _SentinelFeedCard({
  alerts,
  loading,
  delay = 0,
}: {
  alerts: SentinelAlert[];
  loading: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className="r-card col-span-6 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-amber-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            LIVE SENTINEL FEED
          </span>
        </div>
        <Link
          href="/dashboard/care/compliance-hub"
          className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
        >
          View All
          <ChevronRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-12 rounded" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Shield size={24} className="mb-2 text-emerald-400/40" />
          <span className="text-[12px] text-[var(--text-muted)]">All clear — no active alerts</span>
          <span className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            Sentinel is monitoring your organization
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {alerts.slice(0, 5).map((alert, idx) => {
            const sev = SEVERITY_CONFIG[alert.severity];
            const isCritical = alert.severity === "critical";
            const typeLabel =
              ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type.replace(/_/g, " ");

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: Math.min(idx * 0.02, 0.3),
                  duration: 0.25,
                  ease: EASE_STEALTH,
                }}
                className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  isCritical
                    ? "border-rose-500/10 bg-rose-500/[0.03] shadow-[0_0_12px_-2px_rgba(244,63,94,0.08)]"
                    : "border-[var(--border-base)] bg-white/[0.02] hover:border-[var(--border-active)]"
                }`}
              >
                {/* Severity dot */}
                <div className="mt-1.5 flex-shrink-0">
                  <span
                    className={`block h-2 w-2 rounded-full ${sev.dot} ${
                      isCritical ? "animate-pulse" : ""
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-zinc-200 group-hover:text-white">
                      {alert.title}
                    </span>
                    <span className="flex-shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                      {_relativeTime(alert.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.color} ${sev.border} border`}
                    >
                      {sev.label}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] capitalize text-[var(--text-muted)]">
                      {typeLabel}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// _QuickAccessCard
// ═══════════════════════════════════════════════════════════════════════════════

function _QuickAccessCard({
  emoji,
  title,
  subtitle,
  href,
  delay = 0,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  href: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className="col-span-3"
    >
      <Link href={href} className="group block h-full">
        <div
          className="r-card flex h-full flex-col justify-between border border-[var(--border-base)] bg-[var(--surface-1)] p-4 transition-all hover:border-[var(--border-active)] hover:bg-[var(--surface-2)]"
          style={{ boxShadow: "var(--shadow-inset-bevel)" }}
        >
          <div>
            <span className="mb-2 block text-lg">{emoji}</span>
            <h3 className="text-[13px] font-medium text-zinc-200 group-hover:text-white">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] text-[var(--text-muted)] transition-colors group-hover:text-[var(--brand)]">
            Open
            <ChevronRight size={10} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// _StatBar
// ═══════════════════════════════════════════════════════════════════════════════

interface StatBarItem {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}

function _StatBar({
  items,
  delay = 0,
}: {
  items: StatBarItem[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className="col-span-12"
    >
      <div
        className="r-card flex flex-wrap items-center gap-2 border border-[var(--border-base)] bg-[var(--surface-1)] px-4 py-3"
        style={{ boxShadow: "var(--shadow-inset-bevel)" }}
      >
        {items.map((item, idx) => (
          <div key={item.label} className="flex items-center">
            {idx > 0 && (
              <div className="mx-3 h-4 w-px bg-white/[0.06]" />
            )}
            <div className="flex items-center gap-2">
              <span className={`${item.color || "text-[var(--text-muted)]"}`}>{item.icon}</span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.label}</span>
              <span className="font-mono text-[12px] font-medium text-zinc-300">
                {typeof item.value === "number" ? _formatNumber(item.value) : item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// _SeverityDots — inline severity breakdown
// ═══════════════════════════════════════════════════════════════════════════════

function _SeverityDots({
  critical,
  warning,
  info,
}: {
  critical: number;
  warning: number;
  info: number;
}) {
  const items = [
    { count: critical, ...SEVERITY_CONFIG.critical },
    { count: warning, ...SEVERITY_CONFIG.warning },
    { count: info, ...SEVERITY_CONFIG.info },
  ];

  return (
    <div className="mt-2 flex items-center gap-2.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-[10px]">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.dot}`} />
          <span className={item.color}>{item.count}</span>
          <span className="text-[var(--text-muted)]">{item.label.toLowerCase()}</span>
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function CareCommandCenterPage() {
  const { orgId } = useOrg();
  const snapshot = useCareCommandStore((s) => s.snapshot);
  const snapshotLoading = useCareCommandStore((s) => s.snapshotLoading);
  const fetchSnapshot = useCareCommandStore((s) => s.fetchSnapshot);

  const [liveTime, setLiveTime] = useState<string>("");

  // Fetch snapshot on mount
  useEffect(() => {
    if (orgId) fetchSnapshot(orgId);
  }, [orgId, fetchSnapshot]);

  // Live clock
  useEffect(() => {
    setLiveTime(_liveTimestamp());
    const interval = setInterval(() => setLiveTime(_liveTimestamp()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const loading = snapshotLoading && !snapshot;
  const s = snapshot;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative p-6 lg:p-8">
      {/* Stealth noise overlay */}
      <div className="stealth-noise" />

      {/* Radial glow — subtle white/neutral atmosphere */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ──────────────────────────── Page Header ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_STEALTH }}
        className="relative mb-8"
      >
        {/* Overline */}
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            CARE COMMAND CENTER
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
          Care Dashboard
        </h1>

        {/* Subtitle */}
        <p className="mt-1.5 border-l-2 border-[var(--brand)]/30 pl-2.5 text-[12px] text-[var(--text-muted)]">
          {liveTime}
          {s && (
            <>
              {" — "}
              <span className="text-[var(--text-primary)]">{s.participants.active}</span> active participants
            </>
          )}
        </p>
      </motion.div>

      {/* ──────────────────────────── Bento Grid ───────────────────────────── */}
      <div className="relative grid grid-cols-12 gap-3">
        {/* ═══════════ Row 1 — Key Metrics ═══════════ */}
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="skeleton-shimmer mb-3 h-3 w-20 rounded" />
                <div className="skeleton-shimmer mb-2 h-8 w-16 rounded" />
                <div className="skeleton-shimmer h-3 w-32 rounded" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Active Participants */}
            <_MetricCard
              icon={<Users size={16} />}
              label="Active Participants"
              value={s?.participants.active ?? 0}
              accent="brand"
              delay={0.1}
            />

            {/* Today's Shifts */}
            <_MetricCard
              icon={<Clock size={16} />}
              label="Today's Shifts"
              value={s?.shifts.today ?? 0}
              subStats={[
                {
                  label: "scheduled",
                  value: s?.shifts.scheduled ?? 0,
                  color: "text-sky-400",
                },
                {
                  label: "active",
                  value: s?.shifts.in_progress ?? 0,
                  color: "text-emerald-400",
                },
                {
                  label: "completed",
                  value: s?.shifts.completed ?? 0,
                  color: "text-zinc-400",
                },
              ]}
              accent="emerald"
              delay={0.16}
            />

            {/* Sentinel Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_STEALTH, delay: 0.22 }}
              className={`r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)] ${
                (s?.sentinel.critical ?? 0) > 0
                  ? "shadow-[0_0_20px_-4px_rgba(244,63,94,0.15)]"
                  : ""
              }`}
              style={{ boxShadow: (s?.sentinel.critical ?? 0) > 0 ? undefined : "var(--shadow-inset-bevel)" }}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    (s?.sentinel.critical ?? 0) > 0
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-[var(--ghost-emerald)] text-[var(--brand)]"
                  }`}
                >
                  <Shield size={16} />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Sentinel Alerts
                </span>
              </div>
              <div className="mb-1 font-mono text-[28px] font-semibold tracking-tighter text-white">
                {s?.sentinel.total ?? 0}
              </div>
              <_SeverityDots
                critical={s?.sentinel.critical ?? 0}
                warning={s?.sentinel.warning ?? 0}
                info={s?.sentinel.info ?? 0}
              />
            </motion.div>

            {/* Budget Utilization */}
            <_MetricCard
              icon={<Wallet size={16} />}
              label="Budget Utilization"
              value={`${(s?.budget.utilization_pct ?? 0).toFixed(1)}%`}
              progress={s?.budget.utilization_pct ?? 0}
              accent={
                (s?.budget.utilization_pct ?? 0) > 90
                  ? "rose"
                  : (s?.budget.utilization_pct ?? 0) > 75
                    ? "amber"
                    : "brand"
              }
              delay={0.28}
            />
          </>
        )}

        {/* ═══════════ Row 2 — Intelligence Panels ═══════════ */}
        {loading ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="r-card col-span-6 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="skeleton-shimmer mb-4 h-4 w-32 rounded" />
                <div className="skeleton-shimmer h-56 rounded" />
              </div>
            ))}
          </>
        ) : (
          <>
            <_ClinicalPulseCard
              clinical={s?.clinical ?? null}
              loading={snapshotLoading}
              delay={0.34}
            />
            <_SentinelFeedCard
              alerts={s?.sentinel.recent ?? []}
              loading={snapshotLoading}
              delay={0.4}
            />
          </>
        )}

        {/* ═══════════ Row 3 — Quick Access ═══════════ */}
        <_QuickAccessCard
          emoji="📊"
          title="Clinical Timeline"
          subtitle="Unified patient history — observations, medications, notes"
          href="/dashboard/care/clinical-timeline"
          delay={0.46}
        />
        <_QuickAccessCard
          emoji="🛡️"
          title="Compliance Hub"
          subtitle="Sentinel · Credentials · Audit trails"
          href="/dashboard/care/compliance-hub"
          delay={0.52}
        />
        <_QuickAccessCard
          emoji="💰"
          title="Funding Engine"
          subtitle="Budget tracking · Claims · NDIS billing"
          href="/dashboard/care/funding-engine"
          delay={0.58}
        />
        <_QuickAccessCard
          emoji="📋"
          title="Roster Intelligence"
          subtitle="SCHADS-aware scheduling & dispatch"
          href="/dashboard/care/roster-intelligence"
          delay={0.64}
        />

        {/* ═══════════ Row 4 — Quick Stats Bar ═══════════ */}
        {loading ? (
          <div
            className="r-card col-span-12 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="skeleton-shimmer h-8 rounded" />
          </div>
        ) : (
          <_StatBar
            delay={0.7}
            items={[
              {
                icon: <Target size={13} />,
                label: "Care Plans Active",
                value: s?.care_plans.active ?? 0,
                color: "text-emerald-400",
              },
              {
                icon: <TrendingUp size={13} />,
                label: "Goals In Progress",
                value: s?.care_plans.needs_review ?? 0,
                color: "text-[var(--brand)]",
              },
              {
                icon: <AlertTriangle size={13} />,
                label: "Credentials Expiring",
                value: s?.credentials.expiring_30d ?? 0,
                color:
                  (s?.credentials.expiring_30d ?? 0) > 0
                    ? "text-amber-400"
                    : "text-[var(--text-muted)]",
              },
              {
                icon: <Zap size={13} />,
                label: "Open Incidents",
                value: s?.incidents.total ?? 0,
                color:
                  (s?.incidents.critical ?? 0) > 0
                    ? "text-rose-400"
                    : "text-[var(--text-muted)]",
              },
              {
                icon: <Brain size={13} />,
                label: "Claims Submitted",
                value: s?.claims.total_submitted ?? 0,
                color: "text-sky-400",
              },
            ]}
          />
        )}

        {/* ═══════════ Row 5 — Financial Summary ═══════════ */}
        {!loading && s && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_STEALTH, delay: 0.76 }}
            className="col-span-12"
          >
            <div className="grid grid-cols-4 gap-3">
              {/* Budget Total */}
              <div
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--ghost-emerald)]">
                    <Wallet size={12} className="text-[var(--brand)]" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Total Budget
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.total)}
                </div>
              </div>

              {/* Consumed */}
              <div
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                    <Activity size={12} className="text-emerald-400" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Consumed
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.consumed)}
                </div>
              </div>

              {/* Quarantined */}
              <div
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                    <AlertTriangle size={12} className="text-amber-400" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Quarantined
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.quarantined)}
                </div>
              </div>

              {/* Available */}
              <div
                className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10">
                    <TrendingUp size={12} className="text-sky-400" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Available
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.available)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ Row 6 — Claims Summary ═══════════ */}
        {!loading && s && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_STEALTH, delay: 0.82 }}
            className="col-span-12"
          >
            <div
              className="r-card border border-[var(--border-base)] bg-[var(--surface-1)] p-4"
              style={{ boxShadow: "var(--shadow-inset-bevel)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Brain size={14} className="text-violet-400" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  CLAIMS PIPELINE
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">Total Claims</span>
                  <div className="mt-0.5 font-mono text-lg font-semibold text-white">
                    {_formatNumber(s.claims.total_count)}
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">Total Submitted</span>
                  <div className="mt-0.5 font-mono text-lg font-semibold text-sky-400">
                    {_formatCurrency(s.claims.total_submitted)}
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">Total Paid</span>
                  <div className="mt-0.5 font-mono text-lg font-semibold text-emerald-400">
                    {_formatCurrency(s.claims.total_paid)}
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">Rejected</span>
                  <div
                    className={`mt-0.5 font-mono text-lg font-semibold ${
                      s.claims.total_rejected > 0 ? "text-rose-400" : "text-zinc-400"
                    }`}
                  >
                    {_formatCurrency(s.claims.total_rejected)}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
