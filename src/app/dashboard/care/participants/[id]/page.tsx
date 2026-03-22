/**
 * @page /dashboard/care/participants/[id]
 * @status COMPLETE
 * @description Participant detail — profile, contacts, documents, care plan, coordination log, and portal invite
 * @dataSource server-action: participants + portal-family + coordination actions
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Shield,
  Heart,
  DollarSign,
  FileText,
  Upload,
  MapPin,
  Phone,
  Mail,
  Building2,
  AlertTriangle,
  Activity,
  ChevronRight,
  Calendar,
  Plus,
  Wallet,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useQuery } from "@tanstack/react-query";
import {
  fetchParticipantDossier,
  fetchBudgetTelemetry,
  fetchClinicalTimeline,
  type ParticipantWithBudget,
} from "@/app/actions/participants";
import { inviteFamilyPortalMember } from "@/app/actions/portal-family";
import { getParticipantCoordinationLogsAction } from "@/app/actions/coordination";
import { formatNDISNumber } from "@/lib/ndis-utils";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { MedicationsBox, GoalsBox, FundsManagementBox, CarePlansBox, ServiceAgreementsBox, CareBlueprintBox } from "@/components/care/participant-detail-sections";
import { CareBlueprintBuilder } from "@/components/care/care-blueprint-builder";

/* ═══════════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════════ */

interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  summary: string;
  worker_name: string;
  worker_avatar?: string | null;
  timestamp: string;
  evv_start?: string | null;
  evv_end?: string | null;
}

interface BudgetData {
  total: number;
  consumed: number;
  quarantined: number;
  remaining: number;
  by_category: { category: string; total: number; consumed: number; quarantined: number }[];
  burn_rate: number;
  days_elapsed: number;
  days_total: number;
}

interface CoordinationLogEntry {
  id: string;
  start_time: string;
  billable_units: number;
  activity_type: string;
  case_note: string;
  total_charge: number;
  status: string;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════════ */

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active: { label: "Active", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  pending_agreement: { label: "Pending Agreement", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  discharged: { label: "Discharged", bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
};

const TIMELINE_TYPE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  progress_note: { label: "Progress Note", color: "text-blue-400", dot: "bg-blue-500" },
  observation: { label: "Observation", color: "text-amber-400", dot: "bg-amber-500" },
  incident: { label: "Incident", color: "text-rose-400", dot: "bg-rose-500" },
  medication: { label: "Medication", color: "text-purple-400", dot: "bg-purple-500" },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bar: string }> = {
  core: { label: "Core", color: "text-blue-400", bar: "bg-blue-500" },
  capacity_building: { label: "Capacity Building", color: "text-violet-400", bar: "bg-violet-500" },
  capital: { label: "Capital", color: "text-emerald-400", bar: "bg-emerald-500" },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

function fmtMoney(amount: number): string {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6", "#A855F7",
  "#D946EF", "#F43F5E", "#0EA5E9", "#10B981",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getBurnRateStatus(rate: number): { label: string; color: string } {
  if (rate >= 1.15) return { label: "Over-spending", color: "text-rose-400" };
  if (rate >= 0.85) return { label: "On Track", color: "text-emerald-400" };
  return { label: "Under-spending", color: "text-amber-400" };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Budget Ring Component
   ═══════════════════════════════════════════════════════════════════════════════ */

function BudgetRing({
  total,
  consumed,
  quarantined,
}: {
  total: number;
  consumed: number;
  quarantined: number;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const consumedPct = total > 0 ? consumed / total : 0;
  const quarantinedPct = total > 0 ? quarantined / total : 0;
  const consumedDash = circumference * consumedPct;
  const quarantinedDash = circumference * quarantinedPct;

  return (
    <svg viewBox="0 0 160 160" className="w-36 h-36">
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#27272a"
        strokeWidth="10"
      />
      <motion.circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#3B82F6"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${consumedDash} ${circumference}`}
        strokeDashoffset={0}
        transform="rotate(-90 80 80)"
        initial={{ strokeDasharray: `0 ${circumference}` }}
        animate={{ strokeDasharray: `${consumedDash} ${circumference}` }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <motion.circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#F59E0B"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${quarantinedDash} ${circumference}`}
        strokeDashoffset={-consumedDash}
        transform="rotate(-90 80 80)"
        initial={{ strokeDasharray: `0 ${circumference}` }}
        animate={{
          strokeDasharray: `${quarantinedDash} ${circumference}`,
        }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      />
      <text
        x="80"
        y="76"
        textAnchor="middle"
        className="fill-white text-lg font-bold"
      >
        {Math.round((1 - consumedPct - quarantinedPct) * 100)}%
      </text>
      <text
        x="80"
        y="94"
        textAnchor="middle"
        className="fill-zinc-500 text-[10px]"
      >
        remaining
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════════════════════════════════════════ */

function DossierSkeleton() {
  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Top bar skeleton */}
      <div className="border-b border-zinc-800/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
          <div className="h-6 w-48 rounded skeleton-shimmer" />
          <div className="h-6 w-24 rounded-full skeleton-shimmer ml-3" />
        </div>
      </div>

      {/* Bento grid skeleton */}
      <div className="p-6 grid grid-cols-4 gap-4">
        {/* Clinical Hero */}
        <div className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6">
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 rounded-full skeleton-shimmer" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-44 rounded skeleton-shimmer" />
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-4 w-56 rounded skeleton-shimmer" />
              <div className="h-4 w-40 rounded skeleton-shimmer" />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <div className="h-6 w-24 rounded-full skeleton-shimmer" />
            <div className="h-6 w-20 rounded-full skeleton-shimmer" />
          </div>
        </div>

        {/* Budget */}
        <div className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6">
          <div className="flex items-center gap-6">
            <div className="h-36 w-36 rounded-full skeleton-shimmer" />
            <div className="flex-1 space-y-4">
              <div className="h-5 w-36 rounded skeleton-shimmer" />
              <div className="h-4 w-28 rounded skeleton-shimmer" />
              <div className="h-4 w-32 rounded skeleton-shimmer" />
              <div className="h-4 w-24 rounded skeleton-shimmer" />
            </div>
          </div>
        </div>

        {/* Care Network */}
        <div className="col-span-1 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6">
          <div className="space-y-4">
            <div className="h-4 w-28 rounded skeleton-shimmer" />
            <div className="h-16 w-full rounded skeleton-shimmer" />
            <div className="h-16 w-full rounded skeleton-shimmer" />
            <div className="h-16 w-full rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Document Vault */}
        <div className="col-span-1 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6">
          <div className="space-y-3">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded skeleton-shimmer" />
            <div className="h-10 w-full rounded skeleton-shimmer" />
          </div>
        </div>

        {/* Timeline */}
        <div className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6">
          <div className="space-y-3">
            <div className="h-4 w-36 rounded skeleton-shimmer" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <div className="h-8 w-8 rounded-full skeleton-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded skeleton-shimmer" />
                  <div className="h-3 w-full rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Box 1 — Clinical Hero
   ═══════════════════════════════════════════════════════════════════════════════ */

function ClinicalHeroBox({ participant }: { participant: ParticipantWithBudget }) {
  const statusConfig = STATUS_CONFIG[participant.status] || STATUS_CONFIG.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.1 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ backgroundColor: getAvatarColor(participant.client_name || "?") }}>
            <span className="text-2xl font-bold text-white tracking-tight">
              {getInitials(participant.client_name || "?")}
            </span>
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#0A0A0A] flex items-center justify-center">
            <div className={`h-2.5 w-2.5 rounded-full ${participant.status === "active" ? "bg-emerald-400" : "bg-zinc-600"}`} />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-white tracking-tight truncate">
              {participant.client_name}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {statusConfig.label}
            </span>
          </div>

          {participant.preferred_name && (
            <p className="text-[12px] text-zinc-500 mb-2">
              Preferred: <span className="text-zinc-400">{participant.preferred_name}</span>
            </p>
          )}

          <div className="space-y-1.5 mt-3">
            {participant.ndis_number && (
              <div className="flex items-center gap-2">
                <Shield size={13} className="text-zinc-600 shrink-0" />
                <span className="font-mono text-[13px] text-zinc-400 tabular-nums tracking-wider">
                  NDIS {formatNDISNumber(participant.ndis_number)}
                </span>
              </div>
            )}
            {participant.date_of_birth && (
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-zinc-600 shrink-0" />
                <span className="text-[13px] text-zinc-400">
                  DOB {fmtDate(participant.date_of_birth)}
                </span>
              </div>
            )}
            {participant.address && (
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-zinc-600 shrink-0" />
                <span className="text-[13px] text-zinc-400 truncate">
                  {participant.address}
                </span>
              </div>
            )}
            {participant.client_phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-zinc-600 shrink-0" />
                <a
                  href={`tel:${participant.client_phone}`}
                  className="text-[13px] text-zinc-400 hover:text-blue-400 transition-colors"
                >
                  {participant.client_phone}
                </a>
              </div>
            )}
            {participant.client_email && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-zinc-600 shrink-0" />
                <a
                  href={`mailto:${participant.client_email}`}
                  className="text-[13px] text-zinc-400 hover:text-blue-400 transition-colors truncate"
                >
                  {participant.client_email}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {participant.critical_alerts && participant.critical_alerts.length > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle size={13} className="text-rose-400" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-rose-400/70">
              Critical Alerts
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {participant.critical_alerts.map((alert, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                {alert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mobility & Communication badges */}
      {(participant.mobility_status || participant.communication_type) && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {participant.mobility_status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
              <Activity size={12} className="text-zinc-500" />
              {participant.mobility_status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
          )}
          {participant.communication_type && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
              <Heart size={12} className="text-zinc-500" />
              {participant.communication_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Box 2 — Live Budget Telemetry
   ═══════════════════════════════════════════════════════════════════════════════ */

function BudgetTelemetryBox({ budget }: { budget: BudgetData }) {
  const burnStatus = getBurnRateStatus(budget.burn_rate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.15 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-6"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-blue-400" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Budget Telemetry
          </h3>
        </div>
        <span className={`text-[11px] font-semibold ${burnStatus.color}`}>
          {burnStatus.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="shrink-0">
          <BudgetRing
            total={budget.total}
            consumed={budget.consumed}
            quarantined={budget.quarantined}
          />
        </div>

        {/* Data */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
              Total Budget
            </p>
            <p className="font-mono text-xl font-bold text-white tabular-nums tracking-tight">
              {fmtMoney(budget.total)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                Consumed
              </p>
              <p className="font-mono text-[14px] font-semibold text-blue-400 tabular-nums">
                {fmtMoney(budget.consumed)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                Quarantined
              </p>
              <p className="font-mono text-[14px] font-semibold text-amber-400 tabular-nums">
                {fmtMoney(budget.quarantined)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                Remaining
              </p>
              <p className="font-mono text-[14px] font-semibold text-emerald-400 tabular-nums">
                {fmtMoney(budget.remaining)}
              </p>
            </div>
          </div>

          {/* Progress bar for days */}
          {budget.days_total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-zinc-600">
                  Day {budget.days_elapsed} of {budget.days_total}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">
                  {Math.round((budget.days_elapsed / budget.days_total) * 100)}% elapsed
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-zinc-600"
                  initial={{ width: "0%" }}
                  animate={{
                    width: `${Math.min((budget.days_elapsed / budget.days_total) * 100, 100)}%`,
                  }}
                  transition={{ duration: 0.8, ease }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      {budget.by_category.length > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-800/50">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
            Category Breakdown
          </p>
          <div className="space-y-2.5">
            {budget.by_category.map((cat) => {
              const config = CATEGORY_CONFIG[cat.category] || {
                label: cat.category,
                color: "text-zinc-400",
                bar: "bg-zinc-500",
              };
              const pct = cat.total > 0 ? (cat.consumed / cat.total) * 100 : 0;

              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-medium ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                      {fmtMoney(cat.consumed)} / {fmtMoney(cat.total)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${config.bar}`}
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.8, ease, delay: 0.3 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Box 3 — Care Network
   ═══════════════════════════════════════════════════════════════════════════════ */

function CareNetworkBox({ participant }: { participant: ParticipantWithBudget }) {
  const nominee = participant.primary_nominee;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.2 }}
      className="col-span-1 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-blue-400" />
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Care Network
        </h3>
      </div>

      <div className="space-y-4">
        {/* Guardian / Nominee */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-zinc-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Guardian / Nominee
            </span>
          </div>
          {nominee ? (
            <div className="space-y-1">
              <p className="text-[13px] text-zinc-200 font-medium">
                {nominee.name || "—"}
              </p>
              {nominee.relationship && (
                <p className="text-[11px] text-zinc-500">
                  {nominee.relationship}
                </p>
              )}
              {nominee.phone && (
                <a
                  href={`tel:${nominee.phone}`}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-blue-400 transition-colors"
                >
                  <Phone size={10} />
                  {nominee.phone}
                </a>
              )}
              {nominee.email && (
                <a
                  href={`mailto:${nominee.email}`}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-blue-400 transition-colors truncate"
                >
                  <Mail size={10} />
                  {nominee.email}
                </a>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600 italic">Not assigned</p>
          )}
        </div>

        {/* Plan Manager */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={12} className="text-zinc-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Plan Manager
            </span>
          </div>
          {participant.plan_manager_name ? (
            <p className="text-[13px] text-zinc-200 font-medium">
              {participant.plan_manager_name}
            </p>
          ) : (
            <p className="text-[12px] text-zinc-600 italic">
              {participant.management_type === "self_managed"
                ? "Self-Managed"
                : participant.management_type === "ndia_managed"
                  ? "NDIA Managed"
                  : "Not assigned"}
            </p>
          )}
        </div>

        {/* Support Coordinator */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={12} className="text-zinc-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Support Coordinator
            </span>
          </div>
          {participant.support_coordinator_name ? (
            <p className="text-[13px] text-zinc-200 font-medium">
              {participant.support_coordinator_name}
            </p>
          ) : (
            <p className="text-[12px] text-zinc-600 italic">Not assigned</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Box 4 — Document Vault
   ═══════════════════════════════════════════════════════════════════════════════ */

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
  uploaded_at: string;
  url?: string;
}

function DocumentVaultBox({ participant }: { participant: ParticipantWithBudget }) {
  // Placeholder documents — in production these come from Supabase Storage
  const documents: DocumentEntry[] = participant.active_agreement?.document_url
    ? [
        {
          id: "sa-1",
          name: "Service Agreement",
          type: "pdf",
          uploaded_at: participant.active_agreement.start_date || participant.created_at,
          url: participant.active_agreement.document_url,
        },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.25 }}
      className="col-span-1 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5 flex flex-col"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <FileText size={14} className="text-blue-400" />
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Document Vault
        </h3>
      </div>

      {/* Document list */}
      <div className="flex-1 space-y-2">
        {documents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText size={20} className="text-zinc-700 mb-2" />
            <p className="text-[12px] text-zinc-600">No documents uploaded</p>
          </div>
        )}

        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] group hover:bg-white/[0.04] transition-colors"
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-zinc-200 font-medium truncate">
                {doc.name}
              </p>
              <p className="text-[10px] text-zinc-600 font-mono">
                {fmtDate(doc.uploaded_at)}
              </p>
            </div>
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-zinc-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Drag and drop zone */}
      <div className="mt-3 flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-lg border-2 border-dashed border-zinc-800/60 hover:border-zinc-700/60 transition-colors cursor-pointer group">
        <Upload
          size={18}
          className="text-zinc-700 group-hover:text-zinc-500 transition-colors"
        />
        <p className="text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors text-center">
          Drop files here or{" "}
          <span className="text-blue-400/60 group-hover:text-blue-400 transition-colors">
            browse
          </span>
        </p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Box 5 — Clinical Timeline
   ═══════════════════════════════════════════════════════════════════════════════ */

function ClinicalTimelineBox({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.3 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5 flex flex-col max-h-[520px]"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-blue-400" />
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Clinical Timeline
          </h3>
        </div>
        <span className="font-mono text-[10px] text-zinc-600">
          {timeline.length} entries
        </span>
      </div>

      {/* Timeline feed */}
      <div className="flex-1 overflow-y-auto scrollbar-none space-y-1">
        {timeline.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Activity size={20} className="text-zinc-700 mb-2" />
            <p className="text-[12px] text-zinc-600">No clinical records yet</p>
            <p className="text-[11px] text-zinc-700 mt-1">
              Timeline entries will appear as shifts are completed.
            </p>
          </div>
        )}

        <AnimatePresence>
          {timeline.map((entry, i) => {
            const config = TIMELINE_TYPE_CONFIG[entry.type] || {
              label: entry.type,
              color: "text-zinc-400",
              dot: "bg-zinc-500",
            };

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: Math.min(i * 0.03, 0.4),
                  duration: 0.3,
                  ease,
                }}
                className="group flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                {/* Worker avatar */}
                <div className="shrink-0 mt-0.5">
                  {entry.worker_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.worker_avatar}
                      alt={entry.worker_name}
                      className="h-8 w-8 rounded-full object-cover border border-zinc-800"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-zinc-500">
                        {getInitials(entry.worker_name)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold ${config.color}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                    <span className="text-[10px] text-zinc-700">•</span>
                    <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
                      {fmtTime(entry.timestamp)}
                    </span>
                  </div>

                  <p className="text-[13px] text-zinc-200 font-medium">
                    {entry.title}
                  </p>
                  <p className="text-[12px] text-zinc-500 line-clamp-2 mt-0.5">
                    {entry.summary}
                  </p>

                  <p className="text-[11px] text-zinc-600 mt-1">
                    by {entry.worker_name} •{" "}
                    {fmtDate(entry.timestamp)}
                  </p>
                </div>

                {/* Expand hint */}
                <ChevronRight
                  size={14}
                  className="text-zinc-800 group-hover:text-zinc-600 transition-colors mt-1 shrink-0"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function CoordinationLogBox({ logs }: { logs: CoordinationLogEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.35 }}
      className="col-span-4 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Support Coordination Log
        </h3>
        <span className="font-mono text-[10px] text-zinc-600">{logs.length} entries</span>
      </div>
      <div className="space-y-2">
        {logs.map((row) => (
          <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-zinc-200">
                {new Date(row.start_time).toLocaleString("en-AU")} · {(row.billable_units * 0.1).toFixed(1)}h · {row.activity_type}
              </p>
              <p className="font-mono text-[12px] text-emerald-300">${Number(row.total_charge || 0).toFixed(2)}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{row.case_note}</p>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-[12px] text-zinc-600">No support coordination micro-logs yet.</p>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function ParticipantDossierPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId, loading: orgLoading } = useOrg();
  const [blueprintBuilderOpen, setBlueprintBuilderOpen] = useState(false);

  const participantId = params.id as string;

  const { data: participant, isLoading: dossierLoading, isPending: dossierPending, error: dossierError } = useQuery({
    queryKey: queryKeys.participants.dossier(participantId),
    queryFn: () => fetchParticipantDossier(participantId, orgId!),
    enabled: !!orgId && !!participantId,
    staleTime: 60_000,
  });

  const { data: budget } = useQuery({
    queryKey: queryKeys.participants.budget(participantId),
    queryFn: () => fetchBudgetTelemetry(participantId, orgId!),
    enabled: !!orgId && !!participantId,
    staleTime: 2 * 60_000,
  });

  const { data: timelineRaw } = useQuery({
    queryKey: queryKeys.participants.timeline(participantId),
    queryFn: () => fetchClinicalTimeline(participantId, orgId!),
    enabled: !!orgId && !!participantId,
    staleTime: 60_000,
  });
  const timeline = (timelineRaw as TimelineEntry[] | undefined) ?? [];

  const { data: coordinationRaw } = useQuery({
    queryKey: ["participants", "coordination", participantId],
    queryFn: () => getParticipantCoordinationLogsAction({
      organization_id: orgId!,
      participant_id: participantId,
      limit: 20,
    }),
    enabled: !!orgId && !!participantId,
    staleTime: 60_000,
  });
  const coordinationLogs = (coordinationRaw as CoordinationLogEntry[] | undefined) ?? [];

  const loading = dossierLoading || dossierPending;
  const error = dossierError ? dossierError.message : null;

  if (orgLoading || loading) {
    return <DossierSkeleton />;
  }

  if (error || !participant) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="stealth-noise" />
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-zinc-600" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">
            {error || "Participant not found"}
          </h2>
          <p className="text-[13px] text-zinc-500 mb-6">
            The participant you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <button
            onClick={() => router.push("/dashboard/care/participants")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[13px] text-zinc-300 hover:text-white hover:bg-white/[0.1] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Participants
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[participant.status] || STATUS_CONFIG.active;

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Neutral radial glow */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 h-64 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(59,130,246,0.03) 0%, transparent 60%)",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────────
          Top Action Bar
          ───────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease }}
        className="sticky top-0 z-30 border-b border-zinc-800/50 bg-[#050505]/80 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: back + name + status */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/dashboard/care/participants")}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="h-5 w-px bg-zinc-800" />

            <h1 className="text-lg font-bold text-white tracking-tight truncate">
              {participant.client_name}
            </h1>

            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {statusConfig.label}
            </span>
          </div>

          {/* Right: quick actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[12px] font-medium text-rose-400 hover:bg-rose-500/15 transition-colors"
            >
              <AlertTriangle size={13} />
              Log Incident
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
              onClick={() => router.push(`/dashboard/care/participants/${participant.id}/persona`)}
            >
              <Shield size={13} />
              Persona
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
            >
              <Plus size={13} />
              Create Shift
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
              onClick={() => router.push(`/dashboard/care/participants/${participant.id}/finance`)}
            >
              <Wallet size={13} />
              Wallets & Funds
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
              onClick={async () => {
                const email = window.prompt("Invite Family Portal member (email)");
                if (!email || !orgId) return;
                const result = await inviteFamilyPortalMember({
                  organization_id: orgId,
                  participant_id: participant.id,
                  email: email.trim(),
                  relationship_type: "primary_guardian",
                });
                if (!result.success) {
                  window.alert(result.error || "Invitation failed.");
                  return;
                }
                window.alert("Invitation sent.");
              }}
            >
              <Users size={13} />
              Invite to Family Portal
            </motion.button>

            <button className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-600 hover:text-zinc-400">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────────────
          Bento Grid
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 p-6 grid grid-cols-4 gap-4">
        {/* Row 1 */}
        <ClinicalHeroBox participant={participant} />
        <BudgetTelemetryBox
          budget={
            budget || {
              total: 0,
              consumed: 0,
              quarantined: 0,
              remaining: 0,
              by_category: [],
              burn_rate: 0,
              days_elapsed: 0,
              days_total: 0,
            }
          }
        />

        {/* Row 2 */}
        <CareNetworkBox participant={participant} />
        <DocumentVaultBox participant={participant} />
        <ClinicalTimelineBox timeline={timeline} />
        <CoordinationLogBox logs={coordinationLogs} />

        {/* Row 3: Care Blueprint */}
        <CareBlueprintBox
          participantId={participant.id}
          orgId={orgId!}
          onOpenBuilder={() => setBlueprintBuilderOpen(true)}
        />

        {/* Row 4: Care Plans & Service Agreements */}
        <CarePlansBox participantId={participant.id} orgId={orgId!} />
        <ServiceAgreementsBox participantId={participant.id} orgId={orgId!} />

        {/* Row 4: Medications, Goals & Funds */}
        <MedicationsBox participantId={participant.id} orgId={orgId!} />
        <GoalsBox participantId={participant.id} orgId={orgId!} />
        <FundsManagementBox participantId={participant.id} orgId={orgId!} />
      </div>

      {orgId && (
        <CareBlueprintBuilder
          open={blueprintBuilderOpen}
          onClose={() => setBlueprintBuilderOpen(false)}
          participantId={participant.id}
          participantName={participant.client_name || "Participant"}
          orgId={orgId}
        />
      )}
    </div>
  );
}
