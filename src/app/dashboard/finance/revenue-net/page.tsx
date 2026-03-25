/**
 * @page /dashboard/finance/revenue-net
 * @status COMPLETE
 * @auth REQUIRED — Admin/Manager
 * @description Project Revenue-Net Command Center: Dunning dashboard, mandate
 *   management, auto-charge monitoring, manual sweep controls, and suspension
 *   overview. Real-time stats with Hermes-Matrix integration visibility.
 * @lastAudit 2026-03-24
 */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  CreditCard,
  AlertTriangle,
  Ban,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  TrendingUp,
  ArrowUpRight,
  Play,
  RotateCcw,
  Loader2,
  UserX,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchDunningStatsAction,
  fetchDunningInvoicesAction,
  triggerManualSweepAction,
  resetDunningAction,
  liftSuspensionAction,
  type DunningStats,
  type DunningInvoice,
} from "@/app/actions/revenue-net";

const statusColors: Record<string, string> = {
  NONE: "text-white/40",
  FAIL_1: "text-amber-400",
  FAIL_2: "text-orange-400",
  FAIL_3: "text-red-400",
  SENT_TO_COLLECTIONS: "text-red-500",
};

const statusLabels: Record<string, string> = {
  NONE: "Clear",
  FAIL_1: "Fail 1 — Retry Pending",
  FAIL_2: "Fail 2 — Urgent",
  FAIL_3: "Fail 3 — Suspended",
  SENT_TO_COLLECTIONS: "Collections",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-white",
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-white/40 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

export default function RevenueNetPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);
  const [stats, setStats] = useState<DunningStats | null>(null);
  const [invoices, setInvoices] = useState<DunningInvoice[]>([]);
  const [filter, setFilter] = useState<
    "all" | "FAIL_1" | "FAIL_2" | "FAIL_3" | "SENT_TO_COLLECTIONS"
  >("all");
  const [loading, setLoading] = useState(true);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [statsRes, invRes] = await Promise.all([
        fetchDunningStatsAction(orgId),
        fetchDunningInvoicesAction(orgId, filter),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (invRes.data) setInvoices(invRes.data);
    } finally {
      setLoading(false);
    }
  }, [orgId, filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSweep = async () => {
    if (!orgId) return;
    setSweepLoading(true);
    setSweepResult(null);
    try {
      const { data, error } = await triggerManualSweepAction(orgId);
      if (error) {
        setSweepResult({ error });
      } else {
        setSweepResult(data);
        refresh();
      }
    } finally {
      setSweepLoading(false);
    }
  };

  const handleResetDunning = async (invoiceId: string) => {
    if (!orgId) return;
    setActionLoading(invoiceId);
    try {
      await resetDunningAction(orgId, invoiceId);
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleLiftSuspension = async (clientId: string) => {
    if (!orgId) return;
    setActionLoading(clientId);
    try {
      await liftSuspensionAction(orgId, clientId);
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryInvoice = async (invoiceId: string) => {
    if (!orgId) return;
    setActionLoading(`retry_${invoiceId}`);
    try {
      await triggerManualSweepAction(orgId, invoiceId);
      refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const copySecureLink = (clientId: string) => {
    const url = `${window.location.origin}/secure/mandate/${clientId}`;
    navigator.clipboard.writeText(url);
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-white/40">Select a workspace to continue.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-semibold text-white">Revenue-Net</h1>
          </div>
          <p className="text-sm text-white/40">
            Automated dunning, off-session charging, and debt collection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 text-sm transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={handleSweep}
            disabled={sweepLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sweepLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run Manual Sweep
          </button>
        </div>
      </div>

      {/* ─── Sweep Result Banner ────────────────────────────── */}
      <AnimatePresence>
        {sweepResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`rounded-xl border p-4 ${
              sweepResult.error
                ? "bg-red-500/10 border-red-500/20"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {sweepResult.error ? (
              <p className="text-sm text-red-400">{sweepResult.error}</p>
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-emerald-400 font-medium">
                  Sweep Complete
                </span>
                <span className="text-white/50">
                  Charged: {sweepResult.charged || 0}
                </span>
                <span className="text-white/50">
                  Processing: {sweepResult.processing || 0}
                </span>
                <span className="text-white/50">
                  Failed: {sweepResult.failed || 0}
                </span>
                <span className="text-white/50">
                  Skipped: {sweepResult.skipped || 0}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Stats Grid ─────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Active Mandates"
            value={stats.active_mandates}
            icon={CreditCard}
            color="text-emerald-400"
          />
          <StatCard
            label="Pending Charges"
            value={stats.pending_charges}
            icon={Clock}
            color="text-blue-400"
          />
          <StatCard
            label="Auto-Collected (30d)"
            value={`$${Number(stats.auto_collected_30d).toLocaleString(
              undefined,
              { minimumFractionDigits: 2 }
            )}`}
            icon={TrendingUp}
            color="text-emerald-400"
          />
          <StatCard
            label="Suspended Clients"
            value={stats.suspended_clients}
            icon={UserX}
            color={
              stats.suspended_clients > 0 ? "text-red-400" : "text-white/40"
            }
          />
        </div>
      )}

      {/* ─── Dunning Waterfall Pipeline ─────────────────────── */}
      {stats && (
        <div className="bg-[#0A0A0A] rounded-xl border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-3">
            Dunning Pipeline
          </p>
          <div className="flex items-center gap-2">
            {[
              {
                label: "Fail 1",
                count: stats.dunning_fail_1,
                color: "bg-amber-500",
              },
              {
                label: "Fail 2",
                count: stats.dunning_fail_2,
                color: "bg-orange-500",
              },
              {
                label: "Fail 3",
                count: stats.dunning_fail_3,
                color: "bg-red-500",
              },
              {
                label: "Collections",
                count: stats.collections,
                color: "bg-red-700",
              },
            ].map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 rounded-lg p-3 bg-white/[0.02] border border-white/[0.06] ${
                    stage.count > 0 ? "ring-1 ring-inset" : ""
                  }`}
                  style={{
                    boxShadow:
                      stage.count > 0
                        ? `inset 0 0 0 1px ${stage.color.replace("bg-", "")}`
                        : undefined,
                  }}
                >
                  <p className="text-xs text-white/40">{stage.label}</p>
                  <p className="text-lg font-mono font-semibold text-white">
                    {stage.count}
                  </p>
                </div>
                {i < 3 && (
                  <ChevronRight className="w-4 h-4 text-white/10 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Filter Tabs ────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-[#0A0A0A] rounded-xl border border-white/[0.06] p-1">
        {(
          [
            "all",
            "FAIL_1",
            "FAIL_2",
            "FAIL_3",
            "SENT_TO_COLLECTIONS",
          ] as const
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "SENT_TO_COLLECTIONS"
                ? "Collections"
                : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* ─── Dunning Invoice Table ──────────────────────────── */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Invoice
                </th>
                <th className="text-left text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Client
                </th>
                <th className="text-right text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Amount
                </th>
                <th className="text-center text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Last Error
                </th>
                <th className="text-center text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Retry
                </th>
                <th className="text-right text-xs text-white/40 font-medium uppercase tracking-wide px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="w-5 h-5 text-white/20 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-white/30 text-sm"
                  >
                    <Shield className="w-8 h-8 mx-auto mb-2 text-emerald-500/30" />
                    No dunning invoices. All clients are in good standing.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-white/80">
                        {inv.display_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {inv.client_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/80">
                      ${Number(inv.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.dunning_status] || "text-white/40"}`}
                      >
                        {inv.dunning_status === "FAIL_3" ||
                        inv.dunning_status === "SENT_TO_COLLECTIONS" ? (
                          <XCircle className="w-3 h-3" />
                        ) : inv.dunning_status !== "NONE" ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {statusLabels[inv.dunning_status] || inv.dunning_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs max-w-[200px] truncate">
                      {inv.last_charge_error || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-white/40">
                      {inv.auto_charge_date
                        ? new Date(inv.auto_charge_date).toLocaleDateString(
                            "en-AU",
                            { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRetryInvoice(inv.id)}
                          disabled={actionLoading === `retry_${inv.id}`}
                          title="Retry charge now"
                          className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-emerald-400 transition-colors"
                        >
                          {actionLoading === `retry_${inv.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleResetDunning(inv.id)}
                          disabled={actionLoading === inv.id}
                          title="Reset dunning status"
                          className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-amber-400 transition-colors"
                        >
                          {actionLoading === inv.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copySecureLink(inv.client_id)}
                          title="Copy secure mandate link"
                          className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-blue-400 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {(inv.dunning_status === "FAIL_3" ||
                          inv.dunning_status === "SENT_TO_COLLECTIONS") && (
                          <button
                            onClick={() =>
                              handleLiftSuspension(inv.client_id)
                            }
                            disabled={actionLoading === inv.client_id}
                            title="Lift financial suspension"
                            className="p-1.5 rounded hover:bg-white/[0.06] text-white/30 hover:text-green-400 transition-colors"
                          >
                            {actionLoading === inv.client_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
