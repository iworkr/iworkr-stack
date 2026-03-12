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

const STAGGER_CHILDREN = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

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
// Shimmer skeleton
// ═══════════════════════════════════════════════════════════════════════════════

function _Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.04] ${className}`}
    />
  );
}

function _ShimmerCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-5 ${className}`}
    >
      <_Shimmer className="mb-3 h-3 w-20" />
      <_Shimmer className="mb-2 h-8 w-16" />
      <_Shimmer className="h-3 w-32" />
    </div>
  );
}

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
  accent?: "blue" | "emerald" | "rose" | "amber";
  glow?: boolean;
  delay?: number;
}

function _MetricCard({
  icon,
  label,
  value,
  subStats,
  progress,
  accent = "blue",
  glow = false,
  delay = 0,
}: MetricCardProps) {
  const accentMap = {
    blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", bar: "bg-blue-500", glowShadow: "shadow-[0_0_20px_-4px_rgba(59,130,246,0.15)]" },
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", bar: "bg-emerald-500", glowShadow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.15)]" },
    rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", bar: "bg-rose-500", glowShadow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.2)]" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", bar: "bg-amber-500", glowShadow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.15)]" },
  };
  const a = accentMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_STEALTH, delay }}
      className={`col-span-3 rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-5 transition-colors hover:border-white/[0.08] ${
        glow ? a.glowShadow : ""
      }`}
    >
      {/* Icon + label */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.bg} ${a.text}`}>
          {icon}
        </div>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="mb-1 text-2xl font-semibold tracking-tight text-white">
        {typeof value === "number" ? _formatNumber(value) : value}
      </div>

      {/* Sub-stats */}
      {subStats && subStats.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {subStats.map((s) => (
            <span key={s.label} className="text-[11px] text-zinc-500">
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
            <span className="text-[10px] text-zinc-600">0%</span>
            <span className={`text-[10px] font-medium ${a.text}`}>{progress.toFixed(1)}%</span>
            <span className="text-[10px] text-zinc-600">100%</span>
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
      className="col-span-6 rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Heart size={14} className="text-rose-400" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-blue-400/60">
          CLINICAL PULSE
        </span>
      </div>

      {loading || !clinical ? (
        <div className="grid grid-cols-2 gap-4">
          <_Shimmer className="h-24" />
          <_Shimmer className="h-24" />
          <_Shimmer className="col-span-2 h-16" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* MAR Compliance Ring */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
            <span className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
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
            <span className="mt-1 text-[10px] text-zinc-600">
              {clinical.mar_entries_24h} entries today
            </span>
          </div>

          {/* Observations & Notes */}
          <div className="flex flex-col gap-3">
            {/* Observations */}
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Observations 24h
                </span>
                <Eye size={12} className="text-sky-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold text-white">
                  {clinical.observations_24h}
                </span>
                {clinical.abnormal_observations > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                    <AlertTriangle size={9} />
                    {clinical.abnormal_observations} abnormal
                  </span>
                )}
              </div>
            </div>

            {/* Progress notes */}
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Progress Notes 7d
                </span>
                <ClipboardList size={12} className="text-emerald-400" />
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {clinical.progress_notes_7d}
              </div>
            </div>
          </div>

          {/* Mood Distribution */}
          <div className="col-span-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
            <span className="mb-2.5 block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Mood Distribution
            </span>
            {Object.keys(clinical.mood_distribution).length === 0 ? (
              <span className="text-[11px] text-zinc-600">No mood data recorded yet</span>
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
                      <span className="text-[8px] capitalize text-zinc-600">{config.label}</span>
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
      className="col-span-6 rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-amber-400" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-blue-400/60">
            LIVE SENTINEL FEED
          </span>
        </div>
        <Link
          href="/dashboard/care/compliance-hub"
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-blue-400"
        >
          View All
          <ChevronRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <_Shimmer key={i} className="h-12" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Shield size={24} className="mb-2 text-emerald-400/40" />
          <span className="text-[12px] text-zinc-500">All clear — no active alerts</span>
          <span className="mt-1 text-[10px] text-zinc-600">
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
                  duration: 0.4,
                  ease: EASE_STEALTH,
                  delay: delay + 0.1 + idx * 0.06,
                }}
                className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  isCritical
                    ? "border-rose-500/10 bg-rose-500/[0.03] shadow-[0_0_12px_-2px_rgba(244,63,94,0.08)]"
                    : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.06]"
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
                    <span className="flex-shrink-0 text-[10px] text-zinc-600">
                      {_relativeTime(alert.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.bg} ${sev.color} ${sev.border} border`}
                    >
                      {sev.label}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] capitalize text-zinc-500">
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
        <div className="flex h-full flex-col justify-between rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4 transition-all hover:border-blue-500/20 hover:bg-blue-500/[0.02] hover:shadow-[0_0_20px_-6px_rgba(59,130,246,0.08)]">
          <div>
            <span className="mb-2 block text-lg">{emoji}</span>
            <h3 className="text-[13px] font-medium text-zinc-200 group-hover:text-white">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{subtitle}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] text-zinc-600 transition-colors group-hover:text-blue-400">
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.05] bg-[#0A0A0A] px-4 py-3">
        {items.map((item, idx) => (
          <div key={item.label} className="flex items-center">
            {idx > 0 && (
              <div className="mx-3 h-4 w-px bg-white/[0.06]" />
            )}
            <div className="flex items-center gap-2">
              <span className={`${item.color || "text-zinc-500"}`}>{item.icon}</span>
              <span className="text-[11px] text-zinc-500">{item.label}</span>
              <span className="text-[12px] font-medium text-zinc-300">
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
          <span className="text-zinc-600">{item.label.toLowerCase()}</span>
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
    <div className="relative min-h-screen p-6 lg:p-8" style={{ backgroundColor: "#050505" }}>
      {/* Stealth noise overlay */}
      <div className="stealth-noise" />

      {/* Radial glow — subtle blue atmosphere */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-72"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(59,130,246,0.03) 0%, transparent 60%)",
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
          <span className="font-mono text-[9px] font-bold uppercase tracking-[3px] text-blue-400/60">
            NIGHTINGALE COMMAND
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Care Command Center
        </h1>

        {/* Subtitle with blue left border */}
        <p className="mt-1.5 border-l-2 border-blue-500/30 pl-2.5 text-[12px] text-zinc-500">
          {liveTime}
          {s && (
            <>
              {" — "}
              <span className="text-zinc-400">{s.participants.active}</span> active participants
            </>
          )}
        </p>
      </motion.div>

      {/* ──────────────────────────── Bento Grid ───────────────────────────── */}
      <div className="relative grid grid-cols-12 gap-3">
        {/* ═══════════ Row 1 — Key Metrics ═══════════ */}
        {loading ? (
          <>
            <_ShimmerCard className="col-span-3" />
            <_ShimmerCard className="col-span-3" />
            <_ShimmerCard className="col-span-3" />
            <_ShimmerCard className="col-span-3" />
          </>
        ) : (
          <>
            {/* Active Participants */}
            <_MetricCard
              icon={<Users size={16} />}
              label="Active Participants"
              value={s?.participants.active ?? 0}
              accent="blue"
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
              className={`col-span-3 rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-5 transition-colors hover:border-white/[0.08] ${
                (s?.sentinel.critical ?? 0) > 0
                  ? "shadow-[0_0_20px_-4px_rgba(244,63,94,0.15)]"
                  : ""
              }`}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    (s?.sentinel.critical ?? 0) > 0
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  <Shield size={16} />
                </div>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Sentinel Alerts
                </span>
              </div>
              <div className="mb-1 text-2xl font-semibold tracking-tight text-white">
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
                    : "blue"
              }
              delay={0.28}
            />
          </>
        )}

        {/* ═══════════ Row 2 — Intelligence Panels ═══════════ */}
        {loading ? (
          <>
            <_ShimmerCard className="col-span-6 !h-72" />
            <_ShimmerCard className="col-span-6 !h-72" />
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
          <_ShimmerCard className="col-span-12" />
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
                color: "text-blue-400",
              },
              {
                icon: <AlertTriangle size={13} />,
                label: "Credentials Expiring",
                value: s?.credentials.expiring_30d ?? 0,
                color:
                  (s?.credentials.expiring_30d ?? 0) > 0
                    ? "text-amber-400"
                    : "text-zinc-500",
              },
              {
                icon: <Zap size={13} />,
                label: "Open Incidents",
                value: s?.incidents.total ?? 0,
                color:
                  (s?.incidents.critical ?? 0) > 0
                    ? "text-rose-400"
                    : "text-zinc-500",
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
              <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                    <Wallet size={12} className="text-blue-400" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Total Budget
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.total)}
                </div>
              </div>

              {/* Consumed */}
              <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                    <Activity size={12} className="text-emerald-400" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Consumed
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.consumed)}
                </div>
              </div>

              {/* Quarantined */}
              <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                    <AlertTriangle size={12} className="text-amber-400" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Quarantined
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {_formatCurrency(s.budget.quarantined)}
                </div>
              </div>

              {/* Available */}
              <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10">
                    <TrendingUp size={12} className="text-sky-400" />
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Available
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
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
            <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Brain size={14} className="text-violet-400" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-blue-400/60">
                  CLAIMS PIPELINE
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-zinc-500">Total Claims</span>
                  <div className="mt-0.5 text-lg font-semibold text-white">
                    {_formatNumber(s.claims.total_count)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Total Submitted</span>
                  <div className="mt-0.5 text-lg font-semibold text-sky-400">
                    {_formatCurrency(s.claims.total_submitted)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Total Paid</span>
                  <div className="mt-0.5 text-lg font-semibold text-emerald-400">
                    {_formatCurrency(s.claims.total_paid)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Rejected</span>
                  <div
                    className={`mt-0.5 text-lg font-semibold ${
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

      {/* ──────────────────────────── Footer Tag ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_STEALTH, delay: 0.9 }}
        className="mt-8 flex items-center justify-center gap-2"
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        <span className="font-mono text-[9px] uppercase tracking-[3px] text-zinc-700">
          Nightingale · Powered by iWorkr
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </motion.div>
    </div>
  );
}
