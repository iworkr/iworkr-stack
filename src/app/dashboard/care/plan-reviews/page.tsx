"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  ChevronRight,
  FileText,
  SlidersHorizontal,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter } from "next/navigation";
import { listPlanReviewDirectoryAction } from "@/app/actions/plan-reviews";

/* ── Types ────────────────────────────────────────────── */

interface DirectoryEntry {
  participant_id: string;
  name: string;
  ndis_number: string | null;
  plan_start: string | null;
  plan_end: string | null;
  total_budget: number;
  consumed_budget: number;
  utilization_percent: number;
  agreement_status: string | null;
  latest_report_id: string | null;
  latest_report_status: string | null;
  latest_report_title: string | null;
}

type TabKey = "all" | "expiring" | "overutilized";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expiring", label: "Approaching Expiry" },
  { key: "overutilized", label: "Overutilized" },
];

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBudget(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}k`;
  return `$${amount.toLocaleString()}`;
}

function getUtilizationColor(pct: number): string {
  if (pct > 95) return "bg-rose-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function getUtilizationTextColor(pct: number): string {
  if (pct > 95) return "text-rose-400";
  if (pct >= 80) return "text-amber-400";
  return "text-zinc-400";
}

/* ── Status Badge ─────────────────────────────────────── */

const REVIEW_STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft:                    { label: "Draft",             bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  aggregating:              { label: "Aggregating",       bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20" },
  pending_manager_review:   { label: "Pending Review",    bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  finalized:                { label: "Finalized",         bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  archived:                 { label: "Archived",          bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
};

function ReviewStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
        No Review
      </span>
    );
  }
  const c = REVIEW_STATUS_MAP[status] || REVIEW_STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}

/* ── Budget Utilization Bar ───────────────────────────── */

function BudgetUtilizationBar({ total, consumed, percent }: { total: number; consumed: number; percent: number }) {
  if (total === 0) {
    return <span className="font-mono text-[11px] text-zinc-600">No plan</span>;
  }
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-[11px] text-zinc-300">
          {formatBudget(consumed)}
        </span>
        <span className="font-mono text-[11px] text-zinc-600">/</span>
        <span className="font-mono text-[11px] text-zinc-500">
          {formatBudget(total)}
        </span>
        <span className={`font-mono text-[11px] ml-1 ${getUtilizationTextColor(percent)}`}>
          ({percent}%)
        </span>
      </div>
      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL_WIDTHS = [
  { name: "w-24", dates: "w-36", bar: "w-28", badge: "w-20" },
  { name: "w-32", dates: "w-32", bar: "w-24", badge: "w-16" },
  { name: "w-20", dates: "w-40", bar: "w-32", badge: "w-20" },
  { name: "w-28", dates: "w-28", bar: "w-20", badge: "w-24" },
  { name: "w-36", dates: "w-36", bar: "w-28", badge: "w-16" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const w = SKEL_WIDTHS[idx % SKEL_WIDTHS.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className={`h-3 ${w.name} bg-zinc-900 rounded-sm animate-pulse`} />
            <div className="h-2 w-16 bg-zinc-900/60 rounded-sm animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${w.dates} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${w.bar} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-1.5 w-full max-w-[120px] bg-zinc-900 rounded-full animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-5 ${w.badge} bg-zinc-900 rounded-md animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 my-6">
          <FileText className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-sm text-zinc-500">
            {hasFilters ? "No participants match your filters." : "No participants with NDIS plans found."}
          </p>
          {hasFilters && (
            <button
              onClick={onClear}
              className="mt-3 text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function PlanReviewsDirectoryPage() {
  const { orgId } = useOrg();
  const router = useRouter();

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  const loadDirectory = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await listPlanReviewDirectoryAction(orgId);
      setEntries((data as DirectoryEntry[]) ?? []);
    } catch (err) {
      console.error("Failed to load plan review directory:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  /* ── Tab counts ──────────────────────────────────────── */
  const tabCounts = useMemo(() => {
    const now = new Date();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    return {
      all: entries.length,
      expiring: entries.filter((e) => {
        if (!e.plan_end) return false;
        const end = new Date(e.plan_end);
        const diff = end.getTime() - now.getTime();
        return diff > 0 && diff < sixtyDaysMs;
      }).length,
      overutilized: entries.filter((e) => e.utilization_percent > 90).length,
    };
  }, [entries]);

  /* ── Filtered entries ────────────────────────────────── */
  const filtered = useMemo(() => {
    const now = new Date();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    let list = entries;

    if (tab === "expiring") {
      list = list.filter((e) => {
        if (!e.plan_end) return false;
        const end = new Date(e.plan_end);
        const diff = end.getTime() - now.getTime();
        return diff > 0 && diff < sixtyDaysMs;
      });
    } else if (tab === "overutilized") {
      list = list.filter((e) => e.utilization_percent > 90);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.ndis_number?.toLowerCase().includes(q)) ||
          (e.latest_report_title?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [entries, tab, search]);

  const hasFilters = search.length > 0 || tab !== "all";

  const handleRowClick = (entry: DirectoryEntry) => {
    router.push(`/dashboard/care/plan-reviews/${entry.participant_id}`);
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumb + Pill Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none whitespace-nowrap">
            Funding & Plan Reviews
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "text-white bg-white/10 shadow-sm font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{tabCounts[t.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Search + Filter + CTA */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={() => router.push("/dashboard/care/plan-reviews/build")}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New Review
          </button>
        </div>
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Participant</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Plan Dates</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Budget Utilization</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Review Status</th>
              <th className="px-4 w-[10%]" />
            </tr>
          </thead>
          <tbody>
            {/* Loading Skeletons */}
            {loading && entries.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            )}

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <EmptyState
                hasFilters={hasFilters}
                onClear={() => { setSearch(""); setTab("all"); }}
              />
            )}

            {/* Data Rows */}
            {!loading && filtered.map((entry) => {
              const initials = getInitials(entry.name);
              const planEndDays = daysUntil(entry.plan_end);
              const isExpiring = planEndDays !== null && planEndDays > 0 && planEndDays < 60;
              const isExpired = planEndDays !== null && planEndDays <= 0;

              return (
                <tr
                  key={entry.participant_id}
                  onClick={() => handleRowClick(entry)}
                  className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                >
                  {/* Col 1: Participant */}
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-xs text-zinc-400 font-medium select-none">{initials}</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate">{entry.name}</span>
                        <span className="text-[10px] font-mono text-zinc-600 truncate">
                          {entry.ndis_number ? `NDIS ${entry.ndis_number}` : `ID: ${entry.participant_id.slice(0, 8)}`}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Col 2: Plan Dates */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-zinc-300 whitespace-nowrap">
                        {entry.plan_start && entry.plan_end
                          ? `${formatDate(entry.plan_start)} – ${formatDate(entry.plan_end)}`
                          : "—"
                        }
                      </span>
                      {isExpiring && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                      {isExpired && <Clock className="w-3 h-3 text-rose-500 shrink-0" />}
                    </div>
                  </td>

                  {/* Col 3: Budget Utilization */}
                  <td className="px-4 py-3">
                    <BudgetUtilizationBar
                      total={entry.total_budget}
                      consumed={entry.consumed_budget}
                      percent={entry.utilization_percent}
                    />
                  </td>

                  {/* Col 4: Review Status */}
                  <td className="px-4 py-3">
                    <ReviewStatusBadge status={entry.latest_report_status} />
                  </td>

                  {/* Col 5: Chevron */}
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
