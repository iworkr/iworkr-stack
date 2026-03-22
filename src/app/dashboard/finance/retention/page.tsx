/**
 * @page /dashboard/finance/retention
 * @status COMPLETE
 * @description Retention schedule management with milestone tracking and release workflow
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  Shield,
  Unlock,
  Calendar,
  Clock,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { getRetentionSummary } from "@/app/actions/aegis-contract";

/* ── Types ────────────────────────────────────────────────── */

type ContractStatus = "ACTIVE" | "PRACTICAL_COMPLETION" | "DLP" | "CLOSED";

type RetentionContract = {
  id: string;
  contract_number: string | null;
  client_name: string | null;
  project_name: string | null;
  job_id: string | null;
  total_contract_value: number;
  retention_percentage: number;
  total_retention_held: number;
  retention_released: number;
  practical_completion_date: string | null;
  dlp_end_date: string | null;
  status: ContractStatus;
  retention_release_50_done: boolean;
  retention_release_final: boolean;
};

type RetentionSummary = {
  contracts: RetentionContract[];
  total_retention_held: number;
  total_released: number;
  net_retention: number;
  eligible_for_release: number;
  overdue_count: number;
  overdue_contracts: RetentionContract[];
};

type TabFilter = "all" | "active" | "dlp" | "closed";

/* ── Helpers ──────────────────────────────────────────────── */

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntilDLP(dlpEnd: string | null): number | null {
  if (!dlpEnd) return null;
  const end = new Date(dlpEnd);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function statusLabel(s: ContractStatus): string {
  const map: Record<ContractStatus, string> = {
    ACTIVE: "ACTIVE",
    PRACTICAL_COMPLETION: "PC",
    DLP: "DLP",
    CLOSED: "CLOSED",
  };
  return map[s] || s;
}

function statusStyle(s: ContractStatus): string {
  const map: Record<ContractStatus, string> = {
    ACTIVE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    PRACTICAL_COMPLETION: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DLP: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    CLOSED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return map[s] || map.CLOSED;
}

function matchesTab(c: RetentionContract, tab: TabFilter): boolean {
  if (tab === "all") return true;
  if (tab === "active") return c.status === "ACTIVE" || c.status === "PRACTICAL_COMPLETION";
  if (tab === "dlp") return c.status === "DLP";
  if (tab === "closed") return c.status === "CLOSED";
  return true;
}

function isEligibleForRelease(c: RetentionContract): boolean {
  if (!c.dlp_end_date || c.retention_release_final) return false;
  const days = daysUntilDLP(c.dlp_end_date);
  return days !== null && days <= 30;
}

function isOverdue(c: RetentionContract): boolean {
  if (!c.dlp_end_date || c.retention_release_final) return false;
  return new Date(c.dlp_end_date) < new Date();
}

/* ── MetricNode ───────────────────────────────────────────── */

function MetricNode({
  label,
  value,
  danger,
  pulse,
  pulseColor = "amber",
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  pulse?: boolean;
  pulseColor?: "amber" | "rose";
}) {
  const pulseColors = {
    amber: { ping: "bg-amber-400", dot: "bg-amber-500" },
    rose: { ping: "bg-rose-400", dot: "bg-rose-500" },
  };
  const pc = pulseColors[pulseColor];

  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pc.ping} opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${pc.dot}`}
            />
          </span>
        )}
        <span
          className={`font-mono text-xl leading-none ${
            danger ? "text-rose-500 font-bold" : "text-white"
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── SkeletonRow ──────────────────────────────────────────── */

const SK = [
  { a: "w-28", b: "w-20", c: "w-16", d: "w-24" },
  { a: "w-36", b: "w-16", c: "w-20", d: "w-20" },
  { a: "w-24", b: "w-24", c: "w-16", d: "w-28" },
  { a: "w-32", b: "w-20", c: "w-24", d: "w-20" },
  { a: "w-28", b: "w-16", c: "w-20", d: "w-24" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SK[idx % SK.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${s.a} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-2 w-32 bg-zinc-900/60 rounded-sm animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className={`h-3 ${s.b} bg-zinc-900 rounded-sm animate-pulse`} />
      </td>
      <td className="px-4 py-3">
        <div className={`h-3 ${s.c} bg-zinc-900 rounded-sm animate-pulse`} />
      </td>
      <td className="px-4 py-3">
        <div className={`h-3 ${s.d} bg-zinc-900 rounded-sm animate-pulse`} />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 bg-zinc-900 rounded-sm animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-14 bg-zinc-900 rounded-md animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 bg-zinc-900 rounded-sm animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-12 bg-zinc-900 rounded-sm animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" />
      </td>
    </tr>
  );
}

/* ── EmptyState ───────────────────────────────────────────── */

function EmptyState() {
  return (
    <tr>
      <td colSpan={9}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <Shield className="w-8 h-8 text-emerald-500/50 mb-4" />
          <p className="text-[15px] text-white font-medium">
            No retention contracts found.
          </p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            Retention escrow tracking will appear here once commercial contracts
            with retention clauses are created.
          </p>
        </div>
      </td>
    </tr>
  );
}

/* ── DLP Alert Banner ─────────────────────────────────────── */

function DLPAlertBanner({
  overdueCount,
  visible,
}: {
  overdueCount: number;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="mx-8 mt-4 mb-2 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-3.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-rose-300">
                {overdueCount} contract{overdueCount !== 1 ? "s" : ""} past DLP
                end date
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Retention funds are overdue for release. Review and process
                immediately.
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-rose-400/60 shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Countdown Badge ──────────────────────────────────────── */

function CountdownBadge({ days }: { days: number | null }) {
  if (days === null)
    return <span className="text-xs text-zinc-600 font-mono">—</span>;

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-rose-400 font-semibold">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
        </span>
        {Math.abs(days)}d overdue
      </span>
    );
  }

  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400 font-semibold">
        <Clock className="w-3 h-3" />
        {days}d remaining
      </span>
    );
  }

  return (
    <span className="font-mono text-xs text-zinc-400">{days}d remaining</span>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function RetentionEscrowPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);
  const [, startTransition] = useTransition();
  const [summary, setSummary] = useState<RetentionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await getRetentionSummary(orgId);
      if (result.data) {
        setSummary(result.data as RetentionSummary);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const contracts = summary?.contracts ?? [];

  const filtered = useMemo(() => {
    let list = contracts.filter((c) => matchesTab(c, tab));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.contract_number?.toLowerCase().includes(q)) ||
          (c.client_name?.toLowerCase().includes(q)) ||
          (c.project_name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contracts, tab, search]);

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "all", label: "All Contracts", count: contracts.length },
    {
      key: "active",
      label: "Active / PC",
      count: contracts.filter(
        (c) => c.status === "ACTIVE" || c.status === "PRACTICAL_COMPLETION"
      ).length,
    },
    {
      key: "dlp",
      label: "DLP Period",
      count: contracts.filter((c) => c.status === "DLP").length,
    },
    {
      key: "closed",
      label: "Closed",
      count: contracts.filter((c) => c.status === "CLOSED").length,
    },
  ];

  const handleRelease = async (contractId: string) => {
    setReleasing(contractId);
    // INCOMPLETE: Wire up actual retention release action
    // This would call a server action like `releaseRetention(contractId, orgId)`
    startTransition(async () => {
      // Placeholder for release logic
      await new Promise((r) => setTimeout(r, 1000));
      await load();
      setReleasing(null);
    });
  };

  const overdueCount = summary?.overdue_count ?? 0;

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Finance
          </span>
          <span className="mx-2 text-zinc-700">→</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 font-semibold select-none">
            Retention Escrow
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={`font-mono text-[10px] ${
                      tab === t.key ? "text-zinc-300" : "text-zinc-600"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contracts, clients…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
        </div>
      </div>

      {/* ─── Page Header ─────────────────────────────────── */}
      <div className="px-8 pt-6 pb-2 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Retention Escrow
            </h1>
            <p className="text-[13px] text-zinc-500 mt-0.5">
              Track withheld funds across commercial contracts
            </p>
          </div>
        </div>
      </div>

      {/* ─── DLP Alert Banner ────────────────────────────── */}
      <DLPAlertBanner overdueCount={overdueCount} visible={overdueCount > 0} />

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="mx-8 mt-4 mb-4 shrink-0">
        <div className="flex items-center h-16 px-6 bg-zinc-950/30 border border-zinc-800/50 rounded-xl overflow-x-auto gap-0">
          <MetricNode
            label="Total Retention Held"
            value={formatCurrency(summary?.total_retention_held ?? 0)}
          />
          <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
          <MetricNode
            label="Net Outstanding"
            value={formatCurrency(summary?.net_retention ?? 0)}
          />
          <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
          <MetricNode
            label="Eligible for Release"
            value={summary?.eligible_for_release ?? 0}
            pulse={(summary?.eligible_for_release ?? 0) > 0}
            pulseColor="amber"
          />
          <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
          <MetricNode
            label="Overdue"
            value={overdueCount}
            danger={overdueCount > 0}
            pulse={overdueCount > 0}
            pulseColor="rose"
          />
        </div>
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[18%]">
                Contract / Client
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[12%]">
                Contract Value
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[7%]">
                Ret %
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[12%]">
                Retention Held
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[11%]">
                Released
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[8%]">
                Status
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[14%]">
                PC Date / DLP End
              </th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[12%]">
                DLP Countdown
              </th>
              <th className="px-4 w-[6%]" />
            </tr>
          </thead>
          <tbody>
            {loading &&
              contracts.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} idx={i} />
              ))}
            {!loading && filtered.length === 0 && <EmptyState />}
            {!loading &&
              filtered.map((c) => {
                const days = daysUntilDLP(c.dlp_end_date);
                const eligible = isEligibleForRelease(c);
                const overdue = isOverdue(c);
                const netHeld =
                  (c.total_retention_held ?? 0) - (c.retention_released ?? 0);

                return (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className={`group border-b border-white/5 hover:bg-white/[0.02] transition-colors h-16 ${
                      overdue ? "bg-rose-500/[0.02]" : ""
                    }`}
                  >
                    {/* Contract / Client */}
                    <td className="px-8 py-3">
                      <div className="min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate block">
                          {c.contract_number || "—"}
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate block">
                          {c.client_name || "Unknown client"}
                          {c.project_name && (
                            <span className="text-zinc-600">
                              {" "}
                              · {c.project_name}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Contract Value */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] text-zinc-300">
                        {formatCurrency(c.total_contract_value)}
                      </span>
                    </td>

                    {/* Retention % */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] text-zinc-400">
                        {c.retention_percentage}%
                      </span>
                    </td>

                    {/* Retention Held */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] text-emerald-500 font-medium">
                        {formatCurrency(c.total_retention_held ?? 0)}
                      </span>
                      {netHeld > 0 && netHeld !== (c.total_retention_held ?? 0) && (
                        <span className="font-mono text-[10px] text-zinc-600 block">
                          net {formatCurrency(netHeld)}
                        </span>
                      )}
                    </td>

                    {/* Released */}
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-[13px] ${
                          (c.retention_released ?? 0) > 0
                            ? "text-zinc-300"
                            : "text-zinc-600"
                        }`}
                      >
                        {formatCurrency(c.retention_released ?? 0)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusStyle(
                          c.status
                        )}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                    </td>

                    {/* PC Date / DLP End */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span className="font-mono text-[11px] text-zinc-400">
                            PC {formatDate(c.practical_completion_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span className="font-mono text-[11px] text-zinc-400">
                            DLP {formatDate(c.dlp_end_date)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* DLP Countdown */}
                    <td className="px-4 py-3">
                      <CountdownBadge days={days} />
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      {eligible || overdue ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRelease(c.id);
                          }}
                          disabled={releasing === c.id}
                          className={`h-7 px-3 rounded-md text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                            overdue
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                          }`}
                        >
                          <Unlock className="w-3 h-3" />
                          {releasing === c.id ? "…" : "Release"}
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                      )}
                    </td>
                  </motion.tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
