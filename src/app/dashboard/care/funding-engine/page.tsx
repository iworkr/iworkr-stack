"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Receipt,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  X,
  Search,
  Filter,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PieChart,
  BarChart3,
  Banknote,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  BUDGET_CATEGORY_CONFIG,
  useBudgetByCategory,
} from "@/lib/care-command-store";
import {
  fetchBudgetAllocationsAction,
  fetchClaimBatchesAction,
  fetchClaimLineItemsAction,
  fetchNDISCatalogueAction,
} from "@/app/actions/care";

/* ═══════════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════════ */

type FundingTab = "budget" | "claims" | "pricing";

interface ClaimLineItem {
  id: string;
  organization_id: string;
  claim_batch_id: string | null;
  shift_id: string | null;
  participant_id: string;
  funder_id: string | null;
  ndis_item_number: string | null;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  region_modifier: number | null;
  gst_amount: number;
  status: "draft" | "approved" | "submitted" | "paid" | "rejected" | "written_off";
  rejection_code: string | null;
  rejection_reason: string | null;
  service_date: string;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
  participant_profiles?: { id: string; ndis_number: string | null };
}

interface ClaimBatch {
  id: string;
  organization_id: string;
  batch_number: string | null;
  status: string;
  total_claims: number;
  total_amount: number;
  successful_claims: number;
  failed_claims: number;
  paid_amount: number;
  submitted_at: string | null;
  proda_reference: string | null;
  created_at: string;
}

interface NDISCatalogueItem {
  id: string;
  support_item_number: string;
  support_item_name: string;
  unit: string;
  national_price: number;
  remote_price: number | null;
  very_remote_price: number | null;
  support_category: string;
  registration_group_name: string | null;
  effective_from: string;
  effective_to: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Config
   ═══════════════════════════════════════════════════════════════════════════════ */

const TABS: { key: FundingTab; label: string; icon: React.ElementType }[] = [
  { key: "budget", label: "Budget Overview", icon: PieChart },
  { key: "claims", label: "Claims & Billing", icon: Receipt },
  { key: "pricing", label: "NDIS Pricing", icon: Banknote },
];

const CLAIM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  approved: { label: "Approved", color: "text-[var(--brand)]", bg: "bg-[color-mix(in_srgb,var(--brand),transparent_90%)]", border: "border-white/[0.08]" },
  submitted: { label: "Submitted", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  paid: { label: "Paid", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rejected: { label: "Rejected", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  written_off: { label: "Written Off", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

const PRICING_CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "Core", label: "Core" },
  { key: "Capacity Building", label: "Capacity Building" },
  { key: "Capital", label: "Capital" },
];

const ease = [0.16, 1, 0.3, 1] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

function fmt(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtExact(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.round((value / total) * 100), 100);
}

function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════════════════════════════════════════ */

function MetricSkeleton() {
  return (
    <div className="r-card border border-white/[0.05] bg-white/[0.02] p-6 space-y-4">
      <div className="h-3 w-24 rounded skeleton-shimmer" />
      <div className="h-8 w-40 rounded skeleton-shimmer" />
      <div className="h-2 w-full rounded-full skeleton-shimmer" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 px-4">
          <div className="h-4 w-20 rounded skeleton-shimmer" />
          <div className="h-4 w-32 rounded skeleton-shimmer flex-1" />
          <div className="h-4 w-16 rounded skeleton-shimmer" />
          <div className="h-4 w-20 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Utilization Ring (SVG)
   ═══════════════════════════════════════════════════════════════════════════════ */

function UtilizationRing({ percentage, size = 96 }: { percentage: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const color =
    percentage >= 90
      ? "stroke-rose-500"
      : percentage >= 75
        ? "stroke-amber-500"
        : "stroke-[var(--brand)]";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-lg font-bold text-zinc-100 tabular-nums">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Stacked Bar
   ═══════════════════════════════════════════════════════════════════════════════ */

function StackedBar({
  consumed,
  quarantined,
  total,
  barColor,
}: {
  consumed: number;
  quarantined: number;
  total: number;
  barColor: string;
}) {
  const consumedPct = pct(consumed, total);
  const quarantinedPct = pct(quarantined, total);

  return (
    <div className="relative h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
        initial={{ width: "0%" }}
        animate={{ width: `${consumedPct}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
      {quarantinedPct > 0 && (
        <motion.div
          className="absolute inset-y-0 rounded-full opacity-50"
          style={{
            left: `${consumedPct}%`,
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 2px,
              rgba(255,255,255,0.15) 2px,
              rgba(255,255,255,0.15) 4px
            )`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${quarantinedPct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Budget Overview Tab
   ═══════════════════════════════════════════════════════════════════════════════ */

function BudgetOverviewTab({ orgId }: { orgId: string }) {
  const { allocations, allocationsLoading, fetchAllocations } = useCareCommandStore();
  const budgetByCategory = useBudgetByCategory();

  useEffect(() => {
    fetchAllocations(orgId);
  }, [orgId, fetchAllocations]);

  /* ── Totals ───── */
  const totals = useMemo(() => {
    const total = allocations.reduce((s, a) => s + a.total_budget, 0);
    const consumed = allocations.reduce((s, a) => s + a.consumed_budget, 0);
    const quarantined = allocations.reduce((s, a) => s + a.quarantined_budget, 0);
    const available = total - consumed - quarantined;
    const utilization = pct(consumed, total);
    return { total, consumed, quarantined, available, utilization };
  }, [allocations]);

  /* ── Per-participant grouped ───── */
  const participantRows = useMemo(() => {
    const grouped: Record<
      string,
      { name: string; total: number; consumed: number; quarantined: number; categories: Record<string, { total: number; consumed: number }> }
    > = {};

    for (const a of allocations) {
      const pid = a.participant_id;
      if (!grouped[pid]) {
        grouped[pid] = {
          name: a.participant_name || pid.slice(0, 8),
          total: 0,
          consumed: 0,
          quarantined: 0,
          categories: {},
        };
      }
      grouped[pid].total += a.total_budget;
      grouped[pid].consumed += a.consumed_budget;
      grouped[pid].quarantined += a.quarantined_budget;
      if (!grouped[pid].categories[a.category]) {
        grouped[pid].categories[a.category] = { total: 0, consumed: 0 };
      }
      grouped[pid].categories[a.category].total += a.total_budget;
      grouped[pid].categories[a.category].consumed += a.consumed_budget;
    }

    return Object.entries(grouped)
      .map(([id, data]) => ({
        id,
        ...data,
        utilization: pct(data.consumed, data.total),
        overCommitted: data.consumed + data.quarantined > data.total,
      }))
      .sort((a, b) => b.utilization - a.utilization);
  }, [allocations]);

  const [sortAsc, setSortAsc] = useState(false);
  const sortedParticipants = useMemo(
    () => (sortAsc ? [...participantRows].reverse() : participantRows),
    [participantRows, sortAsc],
  );

  if (allocationsLoading) {
    return (
      <div className="space-y-6 p-5">
        <MetricSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  const categories = (["core", "capacity_building", "capital"] as const).filter(
    (c) => budgetByCategory[c],
  );

  return (
    <div className="space-y-6 p-5">
      {/* ── Hero Metric Card ───── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="r-card border border-white/[0.06] bg-white/[0.02] p-6 md:p-8"
        style={{ boxShadow: "var(--shadow-inset-bevel)" }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          {/* Ring + total */}
          <div className="flex items-center gap-5">
            <UtilizationRing percentage={totals.utilization} size={96} />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                Total Budget
              </p>
              <p className="font-mono text-[28px] font-semibold text-white tabular-nums tracking-tighter">
                {fmt(totals.total)}
              </p>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                {totals.utilization}% utilization
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden md:block h-16 w-px bg-white/[0.06]" />

          {/* Breakdown columns */}
          <div className="grid grid-cols-3 gap-6 md:gap-10 flex-1 w-full">
            {/* Consumed */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Consumed
                </p>
              </div>
              <p className="font-mono text-xl font-semibold text-emerald-400 tabular-nums">
                {fmt(totals.consumed)}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct(totals.consumed, totals.total)}%` }}
                  transition={{ duration: 0.8, ease, delay: 0.3 }}
                />
              </div>
              <p className="font-mono text-[10px] text-zinc-600 mt-1 tabular-nums">
                {pct(totals.consumed, totals.total)}%
              </p>
            </div>

            {/* Committed / Quarantined */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Committed
                </p>
              </div>
              <p className="font-mono text-xl font-semibold text-amber-400 tabular-nums">
                {fmt(totals.quarantined)}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-amber-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct(totals.quarantined, totals.total)}%` }}
                  transition={{ duration: 0.8, ease, delay: 0.4 }}
                />
              </div>
              <p className="font-mono text-[10px] text-zinc-600 mt-1 tabular-nums">
                {pct(totals.quarantined, totals.total)}%
              </p>
            </div>

            {/* Available */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-zinc-400" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Available
                </p>
              </div>
              <p className="font-mono text-xl font-semibold text-zinc-300 tabular-nums">
                {fmt(totals.available)}
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-zinc-400"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct(totals.available, totals.total)}%` }}
                  transition={{ duration: 0.8, ease, delay: 0.5 }}
                />
              </div>
              <p className="font-mono text-[10px] text-zinc-600 mt-1 tabular-nums">
                {pct(totals.available, totals.total)}%
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Category Breakdown ───── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((catKey, idx) => {
          const config = BUDGET_CATEGORY_CONFIG[catKey];
          const data = budgetByCategory[catKey];
          if (!data) return null;
          const available = data.total - data.consumed - data.quarantined;

          return (
            <motion.div
              key={catKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08, duration: 0.5, ease }}
              className="r-card border border-white/[0.06] bg-white/[0.02] p-5"
              style={{ boxShadow: "var(--shadow-inset-bevel)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-sm ${config.bar}`} />
                  <h3 className={`text-[13px] font-semibold ${config.color}`}>{config.label}</h3>
                </div>
                <p className="font-mono text-[12px] text-zinc-400 tabular-nums font-medium">
                  {fmt(data.total)}
                </p>
              </div>

              <StackedBar
                consumed={data.consumed}
                quarantined={data.quarantined}
                total={data.total}
                barColor={config.bar}
              />

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                    Consumed
                  </p>
                  <p className="font-mono text-[13px] text-zinc-300 tabular-nums">
                    {fmt(data.consumed)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                    Committed
                  </p>
                  <p className="font-mono text-[13px] text-zinc-300 tabular-nums">
                    {fmt(data.quarantined)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">
                    Available
                  </p>
                  <p className="font-mono text-[13px] text-zinc-300 tabular-nums font-medium">
                    {fmt(available)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Per-Participant Table ───── */}
      {participantRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease }}
          className="r-card border border-white/[0.06] bg-white/[0.02] overflow-hidden"
          style={{ boxShadow: "var(--shadow-inset-bevel)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
            <h3 className="text-[13px] font-semibold text-zinc-200">
              Participant Budgets
            </h3>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-zinc-300 transition-colors font-mono"
            >
              Utilization
              {sortAsc ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_1fr] items-center gap-4 px-5 py-2.5 border-b border-white/[0.04] bg-[var(--surface-1)]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Participant</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Total Budget</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Utilization</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Category Breakdown</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-white/[0.03]">
            <AnimatePresence>
              {sortedParticipants.map((row, idx) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.3 }}
                  className={`grid grid-cols-[1fr_100px_80px_1fr] items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors ${
                    row.overCommitted
                      ? "border-l-2 border-l-rose-500/40 bg-rose-500/[0.02]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] text-zinc-200 truncate">{row.name}</span>
                    {row.overCommitted && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    )}
                  </div>

                  <span className="font-mono text-[12px] text-zinc-300 tabular-nums text-right">
                    {fmt(row.total)}
                  </span>

                  <span
                    className={`font-mono text-[12px] tabular-nums text-right font-medium ${
                      row.utilization >= 90
                        ? "text-rose-400"
                        : row.utilization >= 75
                          ? "text-amber-400"
                          : "text-zinc-300"
                    }`}
                  >
                    {row.utilization}%
                  </span>

                  {/* Mini category bars */}
                  <div className="flex items-center gap-2">
                    {(["core", "capacity_building", "capital"] as const).map((cat) => {
                      const catData = row.categories[cat];
                      if (!catData) return null;
                      const catConfig = BUDGET_CATEGORY_CONFIG[cat];
                      return (
                        <div key={cat} className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className={`h-1.5 w-1.5 rounded-full ${catConfig.bar} flex-shrink-0`} />
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${catConfig.bar}`}
                              style={{ width: `${pct(catData.consumed, catData.total)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {participantRows.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Wallet className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-600">No budget allocations found</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Claims & Billing Tab
   ═══════════════════════════════════════════════════════════════════════════════ */

function ClaimsBillingTab({ orgId }: { orgId: string }) {
  const [claimLines, setClaimLines] = useState<ClaimLineItem[]>([]);
  const [batches, setBatches] = useState<ClaimBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [linesData, batchesData] = await Promise.all([
        fetchClaimLineItemsAction(orgId),
        fetchClaimBatchesAction(orgId),
      ]);
      setClaimLines((linesData ?? []) as ClaimLineItem[]);
      setBatches((batchesData ?? []) as ClaimBatch[]);
    } catch (err) {
      console.error("Failed to load claims data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Stats ───── */
  const stats = useMemo(() => {
    const totalSubmitted = claimLines
      .filter((c) => ["submitted", "paid", "rejected"].includes(c.status))
      .reduce((s, c) => s + c.total_amount, 0);
    const totalPaid = claimLines
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + c.total_amount, 0);
    const totalRejected = claimLines
      .filter((c) => c.status === "rejected")
      .reduce((s, c) => s + c.total_amount, 0);
    const pendingCount = claimLines.filter((c) =>
      ["draft", "approved", "submitted"].includes(c.status),
    ).length;

    return { totalSubmitted, totalPaid, totalRejected, pendingCount };
  }, [claimLines]);

  /* ── Filtered lines ───── */
  const filteredLines = useMemo(() => {
    if (statusFilter === "all") return claimLines;
    return claimLines.filter((c) => c.status === statusFilter);
  }, [claimLines, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-6 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {/* ── Stats Row ───── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Total Submitted",
            value: fmt(stats.totalSubmitted),
            icon: FileText,
            color: "text-zinc-300",
            border: "border-white/[0.06]",
          },
          {
            label: "Paid",
            value: fmt(stats.totalPaid),
            icon: CheckCircle2,
            color: "text-emerald-400",
            border: "border-emerald-500/20",
          },
          {
            label: "Rejected",
            value: fmt(stats.totalRejected),
            icon: X,
            color: "text-rose-400",
            border: "border-rose-500/20",
          },
          {
            label: "Pending",
            value: String(stats.pendingCount),
            icon: Clock,
            color: "text-amber-400",
            border: "border-amber-500/20",
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.4, ease }}
            className={`r-card border ${stat.border} bg-white/[0.02] p-4`}
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {stat.label}
              </p>
            </div>
            <p className={`font-mono text-[28px] font-semibold tabular-nums tracking-tighter ${stat.color}`}>
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Filter + Action Row ───── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {["all", "draft", "approved", "submitted", "paid", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-white/[0.06] text-white border border-white/[0.08]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {s === "all" ? "All" : (CLAIM_STATUS_CONFIG[s]?.label || s)}
            </button>
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-zinc-200 transition-colors rounded-lg"
        >
          <Receipt className="w-3.5 h-3.5" />
          Generate PRODA Batch
        </motion.button>
      </div>

      {/* ── Claims Table ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease }}
        className="r-card border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        style={{ boxShadow: "var(--shadow-inset-bevel)" }}
      >
        {/* Header */}
        <div className="grid grid-cols-[90px_1fr_100px_1fr_60px_70px_80px_80px] items-center gap-2 px-5 py-2.5 border-b border-white/[0.05] bg-[var(--surface-1)]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Date</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Participant</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">NDIS Item</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Description</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Qty</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Rate</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Total</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Status</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.03] max-h-[480px] overflow-y-auto scrollbar-none">
          {filteredLines.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Receipt className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-600">No claim line items found</p>
            </div>
          )}

          <AnimatePresence>
            {filteredLines.map((line) => {
              const statusCfg = CLAIM_STATUS_CONFIG[line.status] || CLAIM_STATUS_CONFIG.draft;
              const isExpanded = expandedRow === line.id;
              const isRejected = line.status === "rejected";

              return (
                <motion.div key={line.id} layout>
                  <div
                    className={`grid grid-cols-[90px_1fr_100px_1fr_60px_70px_80px_80px] items-center gap-2 px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.03] ${
                      isRejected ? "bg-rose-500/[0.02]" : ""
                    }`}
                    onClick={() => isRejected && setExpandedRow(isExpanded ? null : line.id)}
                  >
                    <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                      {dateShort(line.service_date)}
                    </span>

                    <span className="text-[12px] text-zinc-300 truncate">
                      {line.participant_profiles?.ndis_number || line.participant_id.slice(0, 8)}
                    </span>

                    <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                      {line.ndis_item_number || "—"}
                    </span>

                    <span className="text-[12px] text-zinc-400 truncate">
                      {line.description}
                    </span>

                    <span className="font-mono text-[11px] text-zinc-300 tabular-nums text-right">
                      {line.quantity}
                    </span>

                    <span className="font-mono text-[11px] text-zinc-300 tabular-nums text-right">
                      {fmtExact(line.unit_rate)}
                    </span>

                    <span className="font-mono text-[12px] text-zinc-100 tabular-nums text-right font-medium">
                      {fmtExact(line.total_amount)}
                    </span>

                    <div className="flex justify-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Rejection detail */}
                  <AnimatePresence>
                    {isExpanded && isRejected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 py-3 bg-rose-500/[0.04] border-t border-rose-500/10">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                            <div>
                              {line.rejection_code && (
                                <p className="font-mono text-[11px] text-rose-400 mb-0.5">
                                  Code: {line.rejection_code}
                                </p>
                              )}
                              <p className="text-[12px] text-zinc-400">
                                {line.rejection_reason || "No rejection reason provided."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Batch History (collapsed summary) ───── */}
      {batches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease }}
          className="r-card border border-white/[0.06] bg-white/[0.02] p-5"
          style={{ boxShadow: "var(--shadow-inset-bevel)" }}
        >
          <h3 className="text-[13px] font-semibold text-zinc-200 mb-3">
            PRODA Batch History
          </h3>
          <div className="space-y-2">
            {batches.slice(0, 5).map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-zinc-300">
                    {batch.batch_number || batch.id.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {batch.total_claims} claims
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-zinc-300 tabular-nums">
                    {fmtExact(batch.total_amount)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      batch.status === "reconciled"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : batch.status === "failed"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : batch.status === "submitted" || batch.status === "processing"
                            ? "bg-white/[0.06] text-zinc-300 border border-white/[0.08]"
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}
                  >
                    {batch.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   NDIS Pricing Tab
   ═══════════════════════════════════════════════════════════════════════════════ */

function NDISPricingTab({ orgId }: { orgId: string }) {
  const [catalogue, setCatalogue] = useState<NDISCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchCatalogue = useCallback(async () => {
    setLoading(true);
    try {
      const search = searchQuery.trim() || undefined;
      const category = categoryFilter === "all" ? undefined : categoryFilter;
      const data = await fetchNDISCatalogueAction(search, category);
      setCatalogue((data ?? []) as NDISCatalogueItem[]);
      if (!lastSynced) setLastSynced(new Date().toISOString());
    } catch (err) {
      console.error("Failed to load NDIS catalogue:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, lastSynced]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCatalogue();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchCatalogue]);

  const handleSync = async () => {
    setSyncing(true);
    // Simulated sync — in production this calls supabase.functions.invoke("sync-ndis-catalogue")
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(false);
    setLastSynced(new Date().toISOString());
    fetchCatalogue();
  };

  const categoryColor = (cat: string): string => {
    const lower = cat.toLowerCase();
    if (lower.includes("core")) return "text-zinc-300 bg-white/[0.06] border-white/[0.08]";
    if (lower.includes("capacity")) return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    if (lower.includes("capital")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  };

  return (
    <div className="space-y-5 p-5">
      {/* ── Search + Filters ───── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              type="text"
              placeholder="Search item number or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all font-mono"
            />
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-1.5">
            {PRICING_CATEGORY_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setCategoryFilter(f.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === f.key
                    ? "bg-white/[0.06] text-white border border-white/[0.08]"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-3">
          {lastSynced && (
            <p className="text-[11px] text-zinc-600 font-mono">
              Synced {dateShort(lastSynced)}
            </p>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-[12px] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Catalogue"}
          </button>
        </div>
      </div>

      {/* ── Catalogue Table ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease }}
        className="r-card border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        style={{ boxShadow: "var(--shadow-inset-bevel)" }}
      >
        {/* Header */}
        <div className="grid grid-cols-[110px_1fr_70px_90px_130px_100px] items-center gap-3 px-5 py-2.5 border-b border-white/[0.05] bg-[var(--surface-1)]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Item Number</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Item Name</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Unit</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Rate</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Category</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Effective From</span>
        </div>

        {/* Loading */}
        {loading && <TableSkeleton rows={8} />}

        {/* Empty */}
        {!loading && catalogue.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Banknote className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-[13px] text-zinc-600">
              {searchQuery ? "No items match your search" : "No catalogue items loaded"}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && catalogue.length > 0 && (
          <div className="divide-y divide-white/[0.03] max-h-[520px] overflow-y-auto scrollbar-none">
            {catalogue.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.015, duration: 0.3 }}
                className="grid grid-cols-[110px_1fr_70px_90px_130px_100px] items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]"
              >
                <span className="font-mono text-[12px] text-zinc-300 tabular-nums font-medium">
                  {item.support_item_number}
                </span>

                <span className="text-[12px] text-zinc-300 truncate">
                  {item.support_item_name}
                </span>

                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {item.unit}
                </span>

                <span className="font-mono text-[12px] text-zinc-100 tabular-nums text-right font-medium">
                  {fmtExact(item.national_price)}
                </span>

                <span
                  className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryColor(
                    item.support_category,
                  )}`}
                >
                  {item.support_category}
                </span>

                <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                  {dateShort(item.effective_from)}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && catalogue.length > 0 && (
          <div className="px-5 py-2.5 border-t border-white/[0.05] flex items-center justify-between">
            <p className="font-mono text-[10px] text-zinc-600">
              Showing {catalogue.length} items
            </p>
            {catalogue.length >= 100 && (
              <p className="text-[10px] text-zinc-600">
                Refine your search to see more results
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════════════════════════ */

function FundingEmptyState() {
  return (
    <div className="stealth-empty-state">
      <div className="relative mb-6">
        <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
        <div className="stealth-empty-state-icon animate-zen-breathe">
          <Wallet className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
      <h3 className="stealth-empty-state-title">Funding Engine</h3>
      <p className="stealth-empty-state-desc">
        Connect your organization to start tracking NDIS budgets, claims, and pricing.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function FundingEnginePage() {
  const { orgId, loading: orgLoading } = useOrg();
  const [activeTab, setActiveTab] = useState<FundingTab>("budget");

  if (orgLoading) {
    return (
      <div className="flex h-full flex-col bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="px-5 py-6 space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-32 rounded skeleton-shimmer" />
            <div className="h-6 w-48 rounded skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex h-full flex-col bg-[var(--background)]">
        <div className="stealth-noise" />
        <FundingEmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Neutral radial glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Sticky Header ────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <span>Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-300">Funding & Claims</span>
            </div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">
              FUNDING & CLAIMS
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ────── */}
      <div className="flex items-center border-b border-white/[0.06] bg-[var(--surface-1)] px-5">
        <div className="flex items-center gap-1 py-1.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative rounded-md px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                  isActive
                    ? "font-medium text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="funding-tab-pill"
                    className="absolute inset-0 rounded-md bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease }}
          >
            {activeTab === "budget" && <BudgetOverviewTab orgId={orgId} />}
            {activeTab === "claims" && <ClaimsBillingTab orgId={orgId} />}
            {activeTab === "pricing" && <NDISPricingTab orgId={orgId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
