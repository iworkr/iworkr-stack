"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Heart,
  Users,
  Wallet,
  AlertTriangle,
  ClipboardList,
  Clock,
  ChevronRight,
  Eye,
  FileText,
  Calendar,
  BadgeCheck,
  DollarSign,
  Brain,
  Activity,
  Lightbulb,
  Pill,
  Building2,
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

const MOOD_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  happy: { bg: "bg-emerald-500", text: "text-emerald-400", label: "Happy" },
  content: { bg: "bg-sky-500", text: "text-sky-400", label: "Content" },
  neutral: { bg: "bg-zinc-500", text: "text-zinc-400", label: "Neutral" },
  anxious: { bg: "bg-amber-500", text: "text-amber-400", label: "Anxious" },
  distressed: { bg: "bg-rose-500", text: "text-rose-400", label: "Distressed" },
  sad: { bg: "bg-violet-500", text: "text-violet-400", label: "Sad" },
  agitated: { bg: "bg-orange-500", text: "text-orange-400", label: "Agitated" },
};

const NAV_ITEMS = [
  {
    icon: <Shield size={16} />,
    title: "Care Command",
    description: "Clinical timeline, observations & shift management",
    href: "/dashboard/care/clinical-timeline",
    color: "text-[var(--brand)]",
    bg: "bg-[var(--ghost-emerald)]",
  },
  {
    icon: <DollarSign size={16} />,
    title: "Funding & Claims",
    description: "Budget tracking, claims pipeline & NDIS billing",
    href: "/dashboard/care/funding-engine",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: <BadgeCheck size={16} />,
    title: "Compliance Hub",
    description: "Sentinel alerts, credentials & audit trails",
    href: "/dashboard/care/compliance-hub",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: <Calendar size={16} />,
    title: "Roster",
    description: "SCHADS-aware scheduling & dispatch",
    href: "/dashboard/care/roster-intelligence",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: <Calendar size={16} />,
    title: "Leave Engine",
    description: "Equinox triage board, emergency sick calls and cover automation",
    href: "/dashboard/team/leave",
    color: "text-orange-300",
    bg: "bg-orange-500/10",
  },
  {
    icon: <ClipboardList size={16} />,
    title: "Routines",
    description: "Task definition library for participant and shared house operations",
    href: "/dashboard/care/routines",
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
  },
  {
    icon: <Building2 size={16} />,
    title: "Facilities",
    description: "SIL house matrix, resident linking, and shared responsibility visibility",
    href: "/dashboard/care/facilities",
    color: "text-zinc-300",
    bg: "bg-white/5",
  },
  {
    icon: <Activity size={16} />,
    title: "Daily Ops",
    description: "Live triage feed with critical overdue alerts and export controls",
    href: "/dashboard/care/daily-ops",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
  },
  {
    icon: <Users size={16} />,
    title: "Participants",
    description: "Care plans, goals & participant profiles",
    href: "/dashboard/care/participants",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: <ClipboardList size={16} />,
    title: "Progress Notes",
    description: "Structured shift notes, goal tracking & follow-ups",
    href: "/dashboard/care/progress-notes",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  {
    icon: <FileText size={16} />,
    title: "Shift Templates",
    description: "Dynamic Rosetta builder for clock-out compliance gates",
    href: "/dashboard/care/templates",
    color: "text-cyan-300",
    bg: "bg-cyan-500/10",
  },
  {
    icon: <Eye size={16} />,
    title: "Shift Note Review",
    description: "Post-shift triage board for flagged and exempt submissions",
    href: "/dashboard/care/notes",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  {
    icon: <Shield size={16} />,
    title: "Compliance Readiness",
    description: "Ironclad telemetry score and proactive remediation controls",
    href: "/dashboard/compliance/readiness",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: <BadgeCheck size={16} />,
    title: "Auditor Portals",
    description: "Provision secure, time-bound external data rooms",
    href: "/dashboard/compliance/audits",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: <Pill size={16} />,
    title: "Medications",
    description: "Digital MAR, PRN tracking & missed dose alerts",
    href: "/dashboard/care/medications",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: <Brain size={16} />,
    title: "Behaviour & Safety",
    description: "BSPs, behaviour events & restrictive practices register",
    href: "/dashboard/care/behaviour",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: <Lightbulb size={16} />,
    title: "Quality & CI",
    description: "Continuous improvement, policy governance & audit",
    href: "/dashboard/care/quality",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

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

function _formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function _liveDate(): string {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Skeleton helpers
// ═══════════════════════════════════════════════════════════════════════════════

function _Skeleton({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Row 1 — KPI Strip Cards
// ═══════════════════════════════════════════════════════════════════════════════

function _ParticipantsCard({ snapshot, loading, delay }: { snapshot: CareSnapshot | null; loading: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)]"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ghost-emerald)] text-[var(--brand)]">
          <Users size={16} />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Participants
        </span>
      </div>
      {loading ? (
        <_Skeleton className="h-8 w-16" />
      ) : (
        <>
          <div className="font-mono text-[28px] font-semibold tracking-tighter text-white">
            {snapshot?.participants.active ?? 0}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
            active participants
          </div>
        </>
      )}
    </motion.div>
  );
}

function _ShiftsCard({ snapshot, loading, delay }: { snapshot: CareSnapshot | null; loading: boolean; delay: number }) {
  const s = snapshot?.shifts;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)]"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Clock size={16} />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Today&apos;s Shifts
        </span>
      </div>
      {loading ? (
        <_Skeleton className="h-8 w-16" />
      ) : (
        <>
          <div className="font-mono text-[28px] font-semibold tracking-tighter text-white">
            {s?.today ?? 0}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-sky-400">{s?.scheduled ?? 0}</span> scheduled
            </span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-emerald-400">{s?.in_progress ?? 0}</span> active
            </span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-zinc-400">{s?.completed ?? 0}</span> done
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

function _ClinicalPulseCard({ snapshot, loading, delay }: { snapshot: CareSnapshot | null; loading: boolean; delay: number }) {
  const c = snapshot?.clinical;
  const compliance = c?.mar_compliance_pct ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)]"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
          <Heart size={16} />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Clinical Pulse
        </span>
      </div>
      {loading ? (
        <_Skeleton className="h-8 w-16" />
      ) : (
        <>
          <div className="font-mono text-[28px] font-semibold tracking-tighter text-white">
            {c?.observations_24h ?? 0}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
            observations today
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--text-muted)]">MAR</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, compliance)}%` }}
                transition={{ duration: 1, ease: EASE_STEALTH, delay: delay + 0.3 }}
                className={`h-full rounded-full ${
                  compliance >= 95 ? "bg-emerald-500" : compliance >= 80 ? "bg-amber-500" : "bg-rose-500"
                }`}
              />
            </div>
            <span
              className={`font-mono text-[11px] font-medium ${
                compliance >= 95 ? "text-emerald-400" : compliance >= 80 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {compliance.toFixed(0)}%
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

function _BudgetCard({ snapshot, loading, delay }: { snapshot: CareSnapshot | null; loading: boolean; delay: number }) {
  const pct = snapshot?.budget.utilization_pct ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-3 border border-[var(--border-base)] bg-[var(--surface-1)] p-5 transition-colors hover:border-[var(--border-active)]"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
          <Wallet size={16} />
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Budget Utilization
        </span>
      </div>
      {loading ? (
        <_Skeleton className="h-8 w-16" />
      ) : (
        <>
          <div className="font-mono text-[28px] font-semibold tracking-tighter text-white">
            {pct.toFixed(1)}%
          </div>
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, pct)}%` }}
                transition={{ duration: 1, ease: EASE_STEALTH, delay: delay + 0.3 }}
                className={`h-full rounded-full ${
                  pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-[var(--brand)]"
                }`}
              />
            </div>
            <div className="mt-1 flex justify-between">
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {_formatCurrency(snapshot?.budget.consumed ?? 0)} used
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {_formatCurrency(snapshot?.budget.total ?? 0)} total
              </span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Row 2 — Sentinel Feed
// ═══════════════════════════════════════════════════════════════════════════════

function _SentinelFeed({
  alerts,
  loading,
  delay,
}: {
  alerts: SentinelAlert[];
  loading: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-8 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-amber-400" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Live Sentinel Feed
          </span>
        </div>
        <Link
          href="/dashboard/care/compliance-hub"
          className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
        >
          View All <ChevronRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <_Skeleton key={i} className="h-12" />
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
                transition={{ delay: delay + idx * 0.04, duration: 0.25, ease: EASE_STEALTH }}
                className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  isCritical
                    ? "border-rose-500/10 bg-rose-500/[0.03] shadow-[0_0_12px_-2px_rgba(244,63,94,0.08)]"
                    : "border-[var(--border-base)] bg-white/[0.02] hover:border-[var(--border-active)]"
                }`}
              >
                {/* Severity dot */}
                <div className="mt-1.5 flex-shrink-0">
                  <span
                    className={`block h-2 w-2 rounded-full ${sev.dot} ${isCritical ? "animate-pulse" : ""}`}
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
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.color} ${sev.border}`}
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
// Row 2 — Quick Stats Panel
// ═══════════════════════════════════════════════════════════════════════════════

function _QuickStats({
  snapshot,
  loading,
  delay,
}: {
  snapshot: CareSnapshot | null;
  loading: boolean;
  delay: number;
}) {
  const stats = [
    {
      icon: <AlertTriangle size={13} />,
      label: "Incidents",
      items: [
        { value: snapshot?.incidents.critical ?? 0, sub: "critical", color: "text-rose-400" },
        { value: snapshot?.incidents.high ?? 0, sub: "high", color: "text-amber-400" },
        { value: snapshot?.incidents.total ?? 0, sub: "total", color: "text-zinc-300" },
      ],
    },
    {
      icon: <BadgeCheck size={13} />,
      label: "Credentials",
      items: [
        { value: snapshot?.credentials.expiring_30d ?? 0, sub: "expiring 30d", color: "text-amber-400" },
        { value: snapshot?.credentials.expired ?? 0, sub: "expired", color: "text-rose-400" },
      ],
    },
    {
      icon: <ClipboardList size={13} />,
      label: "Care Plans",
      items: [
        { value: snapshot?.care_plans.active ?? 0, sub: "active", color: "text-emerald-400" },
        { value: snapshot?.care_plans.needs_review ?? 0, sub: "needs review", color: "text-amber-400" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="r-card col-span-4 border border-[var(--border-base)] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Eye size={12} className="text-[var(--brand)]" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Quick Stats
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <_Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.map((group) => (
            <div
              key={group.label}
              className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[var(--text-muted)]">{group.icon}</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {group.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {group.items.map((item) => (
                  <span key={item.sub} className="font-mono text-[11px] text-[var(--text-muted)]">
                    <span className={`font-medium ${item.color}`}>{item.value}</span> {item.sub}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Row 3 — Quick Access Navigation Grid
// ═══════════════════════════════════════════════════════════════════════════════

function _QuickAccessGrid({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: EASE_STEALTH }}
      className="col-span-12"
    >
      <div className="mb-3 flex items-center gap-2">
        <FileText size={12} className="text-[var(--text-muted)]" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Quick Access
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {NAV_ITEMS.map((item, idx) => (
          <Link key={item.href} href={item.href} className="group block">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + idx * 0.05, duration: 0.3, ease: EASE_STEALTH }}
              className="r-card flex h-full flex-col border border-[var(--border-base)] bg-[var(--surface-1)] p-4 transition-all hover:border-[var(--border-active)] hover:bg-[var(--surface-2)]"
              style={{ boxShadow: "var(--shadow-inset-bevel)" }}
            >
              <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                {item.icon}
              </div>
              <h3 className="text-[13px] font-medium text-zinc-200 group-hover:text-white">
                {item.title}
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                {item.description}
              </p>
              <div className="mt-auto flex items-center gap-1 pt-3 text-[10px] text-[var(--text-muted)] transition-colors group-hover:text-[var(--brand)]">
                Open <ChevronRight size={10} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.div>
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
  const fetchAlerts = useCareCommandStore((s) => s.fetchAlerts);

  const [liveDate, setLiveDate] = useState<string>("");

  // Fetch snapshot + alerts on mount
  useEffect(() => {
    if (orgId) {
      fetchSnapshot(orgId);
      fetchAlerts(orgId);
    }
  }, [orgId, fetchSnapshot, fetchAlerts]);

  // Live date
  useEffect(() => {
    setLiveDate(_liveDate());
  }, []);

  const loading = snapshotLoading && !snapshot;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative p-6 lg:p-8">
      {/* Stealth noise overlay */}
      <div className="stealth-noise" />

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ──────────────────────────── Page Header ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_STEALTH }}
        className="relative mb-6 flex items-center justify-between"
      >
        <div>
          <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            COMMAND CENTER
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            Care Dashboard
          </h1>
          <p
            className="mt-1 border-l-2 pl-2 text-[12px] text-[var(--text-muted)]"
            style={{ borderColor: "var(--brand)" }}
          >
            {liveDate}
            {snapshot && (
              <>
                {" — "}
                <span className="text-white">{snapshot.participants.active}</span> active participants
              </>
            )}
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">Live</span>
        </div>
      </motion.div>

      {/* ──────────────────────────── Bento Grid ───────────────────────────── */}
      <div className="relative grid grid-cols-12 gap-3">
        {/* ═══════════ Row 1 — KPI Strip (4 × col-span-3) ═══════════ */}
        <_ParticipantsCard snapshot={snapshot} loading={loading} delay={0.1} />
        <_ShiftsCard snapshot={snapshot} loading={loading} delay={0.15} />
        <_ClinicalPulseCard snapshot={snapshot} loading={loading} delay={0.2} />
        <_BudgetCard snapshot={snapshot} loading={loading} delay={0.25} />

        {/* ═══════════ Row 2 — Sentinel Feed + Quick Stats ═══════════ */}
        <_SentinelFeed
          alerts={snapshot?.sentinel.recent ?? []}
          loading={loading}
          delay={0.3}
        />
        <_QuickStats snapshot={snapshot} loading={loading} delay={0.35} />

        {/* ═══════════ Row 3 — Quick Access Grid ═══════════ */}
        <_QuickAccessGrid delay={0.4} />
      </div>
    </div>
  );
}
