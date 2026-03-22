/**
 * @page /dashboard/finance/iworkr-connect
 * @status COMPLETE
 * @description Stripe Connect onboarding and payment terminal dashboard
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Download,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  BarChart3,
  Users,
  Settings,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  X,
  Copy,
  Check,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getConnectStatus,
  getConnectBalance,
  getConnectTransactions,
  getConnectPayouts,
  getConnectStats,
  getNetworkCustomers,
  triggerOnboarding,
  exportStatementCsv,
  type ConnectStatus,
  type ConnectBalance,
  type ConnectTransaction,
  type ConnectPayout,
  type ConnectStats,
  type NetworkCustomer,
} from "@/app/actions/iworkr-connect";

// ─── Utility helpers ──────────────────────────────────────────────────────

function fmtAUD(cents: number, compact = false): string {
  const dollars = cents / 100;
  if (compact && dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(dollars);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 24 * 3600 * 1000) {
    return `Today, ${d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diff < 48 * 3600 * 1000) {
    return `Yesterday, ${d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const GRADE_CONFIG = {
  A: { label: "Grade A", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: ShieldCheck, pulse: false },
  B: { label: "Grade B", color: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: Shield, pulse: false },
  C: { label: "Grade C", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Shield, pulse: false },
  D: { label: "Grade D", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: ShieldAlert, pulse: false },
  F: { label: "Grade F — Default Risk", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", icon: ShieldAlert, pulse: true },
};

// ─── Trust Badge Component ────────────────────────────────────────────────

function TrustBadge({ grade, onClick }: { grade: string; onClick?: () => void }) {
  const cfg = GRADE_CONFIG[grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.A;
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-opacity hover:opacity-80 ${cfg.bg} ${cfg.border} ${cfg.color} ${cfg.pulse ? "animate-pulse" : ""}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {cfg.label}
    </button>
  );
}

// ─── Trust Slide-Over ─────────────────────────────────────────────────────

function TrustSlideOver({
  customer,
  onClose,
}: {
  customer: NetworkCustomer | null;
  onClose: () => void;
}) {
  const ni = customer?.networkIdentity;
  const grade = ni?.trustGrade ?? "A";
  const cfg = GRADE_CONFIG[grade as keyof typeof GRADE_CONFIG] ?? GRADE_CONFIG.A;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {customer && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 h-full w-[420px] z-50 flex flex-col bg-[#0a0a0a] border-l border-white/[0.08] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Network Trust Profile</p>
                <h3 className="text-[15px] font-semibold text-white mt-0.5">{customer.name}</h3>
              </div>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Grade Banner */}
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div>
                  <p className={`font-mono text-[18px] font-bold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-[11px] text-zinc-500">Trust Score: {ni?.trustScore ?? 100}/100</p>
                </div>
              </div>

              {/* Risk Summary */}
              {ni && grade !== "A" && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {grade === "F" ? (
                      <>This identity hash is connected to <span className="font-semibold text-white">{ni.workspaceCount} other provider{ni.workspaceCount !== 1 ? "s" : ""}</span> on the iWorkr network. They currently have an aggregated overdue balance exceeding <span className="font-semibold text-rose-400">{ni.totalInvoicesOverdue} invoice{ni.totalInvoicesOverdue !== 1 ? "s" : ""} overdue</span>{ni.totalCollections > 0 ? ` and ${ni.totalCollections} collection${ni.totalCollections !== 1 ? "s" : ""} filed` : ""}. Proceed with caution and consider requiring upfront payments.</>
                    ) : grade === "C" || grade === "D" ? (
                      <>This identity has <span className="font-semibold text-amber-400">{ni.totalInvoicesOverdue} overdue invoice{ni.totalInvoicesOverdue !== 1 ? "s" : ""}</span> across the network. Payment is typically delayed but eventually resolved. Consider requiring a deposit.</>
                    ) : (
                      <>This identity has occasional late payments on the network but consistently resolves outstanding balances. Standard payment terms apply.</>
                    )}
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              {ni && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Network Workspaces", value: ni.workspaceCount },
                    { label: "Invoices Overdue", value: ni.totalInvoicesOverdue, alert: ni.totalInvoicesOverdue > 0 },
                    { label: "Chargebacks Filed", value: ni.totalChargebacks, alert: ni.totalChargebacks > 0 },
                    { label: "Sent to Collections", value: ni.totalCollections, alert: ni.totalCollections > 0 },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{stat.label}</p>
                      <p className={`font-mono text-[18px] font-semibold mt-0.5 ${stat.alert ? "text-rose-400" : "text-white"}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Outstanding */}
              {ni && ni.totalOutstanding > 0 && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-rose-400 mb-1">Outstanding Across Network</p>
                  <p className="font-mono text-[20px] font-bold text-rose-400">{fmtAUD(ni.totalOutstanding * 100)}</p>
                </div>
              )}

              {!ni && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <p className="text-[12px] font-medium text-zinc-300">No Network Record</p>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    This customer has no history in the iWorkr network yet. They will be tracked anonymously as invoices are processed.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Onboarding Vault ─────────────────────────────────────────────────────

function OnboardingVault({ orgId, onSuccess }: { orgId: string; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await triggerOnboarding(orgId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Failed to start onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[600px]"
      >
        {/* Logo mark */}
        <div className="flex justify-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
            <Zap className="w-7 h-7 text-emerald-400" />
          </div>
        </div>

        <h1 className="text-center text-[26px] font-light tracking-tight text-white mb-3">
          Activate iWorkr Payments
        </h1>
        <p className="text-center text-[14px] text-zinc-400 max-w-[440px] mx-auto leading-relaxed mb-8">
          Get paid instantly. Automate reconciliations. Protect your business with the Universal Trust Engine.
        </p>

        {/* Value propositions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Zap, label: "Instant Payouts", desc: "Direct to your bank account" },
            { icon: Shield, label: "Trust Engine", desc: "Know your clients' payment history" },
            { icon: BarChart3, label: "Live Ledger", desc: "Real-time financial dashboard" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <div className="flex justify-center mb-2">
                <Icon className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-[12px] font-medium text-zinc-200">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-[13px] font-semibold text-black transition-all hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Preparing secure connection…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Securely Link Bank Account
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-zinc-600 mt-4">
          Powered by Stripe Connect · Bank-grade encryption · No fees to activate
        </p>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 mt-6">
          {["KYC/AML Compliant", "256-bit Encryption", "PCI DSS Level 1"].map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Telemetry Ribbon ─────────────────────────────────────────────────────

function TelemetryRibbon({
  balance,
  stats,
  loading,
}: {
  balance: ConnectBalance | null;
  stats: ConnectStats | null;
  loading: boolean;
}) {
  const Skeleton = () => <div className="h-5 w-24 animate-pulse rounded bg-white/[0.05]" />;

  const metrics = [
    {
      label: "AVAILABLE TO PAYOUT",
      value: loading ? null : balance ? fmtAUD(balance.availableCents) : "$0.00",
      color: "text-emerald-400",
    },
    {
      label: "NEXT PAYOUT",
      value: loading ? null : stats?.nextPayoutDate ?? "No pending payouts",
      sub: stats?.nextPayoutAmount ? fmtAUD(stats.nextPayoutAmount) : null,
      color: "text-white",
    },
    {
      label: "7-DAY GROSS VOLUME",
      value: loading ? null : stats ? fmtAUD(stats.volume7Day) : "$0.00",
      color: "text-white",
    },
    {
      label: "DISPUTE RATE",
      value: loading ? null : stats ? `${stats.disputeRate.toFixed(2)}%` : "0.00%",
      color: stats && stats.disputeRate > 1 ? "text-rose-500 animate-pulse" : "text-white",
      alert: stats ? stats.disputeRate > 1 : false,
    },
  ];

  return (
    <div className="flex h-[72px] w-full items-center border-b border-white/[0.05] bg-zinc-950/30 px-8 gap-8">
      {metrics.map((m, i) => (
        <div key={m.label} className={`${i > 0 ? "border-l border-white/[0.05] pl-8" : ""} min-w-0`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{m.label}</p>
          {loading ? (
            <Skeleton />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className={`font-mono text-[20px] font-semibold leading-tight ${m.color}`}>{m.value}</p>
              {m.sub && <p className="font-mono text-[12px] text-zinc-500">{m.sub}</p>}
              {m.alert && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Transaction Ledger ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    succeeded: { label: "Succeeded", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    pending: { label: "Processing", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    failed: { label: "Failed", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    refunded: { label: "Refunded", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
    disputed: { label: "Disputed", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" },
  };
  const s = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

function TransactionLedger({ transactions, loading }: { transactions: ConnectTransaction[]; loading: boolean }) {
  const cols = [
    { label: "TRANSACTION & DATE", w: "w-[25%]" },
    { label: "CUSTOMER", w: "w-[20%]" },
    { label: "GROSS", w: "w-[13%] text-right" },
    { label: "FEE", w: "w-[10%] text-right" },
    { label: "NET", w: "w-[14%] text-right" },
    { label: "STATUS", w: "w-[18%]" },
  ];

  if (loading) {
    return (
      <div className="flex-1 px-8 pt-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-white/[0.04]">
            <div className="h-4 w-40 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-4 w-28 animate-pulse rounded bg-white/[0.05]" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-white/[0.05]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Table header */}
      <div className="sticky top-0 flex items-center gap-4 border-b border-white/[0.06] bg-[#050505]/90 px-8 py-2.5 backdrop-blur-sm z-10">
        {cols.map((c) => (
          <div key={c.label} className={`${c.w} font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-semibold`}>
            {c.label}
          </div>
        ))}
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <DollarSign className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-[14px] text-zinc-400">No transactions yet</p>
          <p className="text-[12px] text-zinc-600 mt-1">Payments will appear here as they are processed</p>
        </div>
      ) : (
        <div>
          {transactions.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 border-b border-white/[0.04] px-8 py-3.5 hover:bg-white/[0.02] transition-colors group"
            >
              {/* Transaction & Date */}
              <div className="w-[25%] min-w-0">
                <p className="font-mono text-[12px] text-zinc-200 truncate">{t.invoiceRef ?? t.id.slice(-12)}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(t.createdAt)}</p>
              </div>
              {/* Customer */}
              <div className="w-[20%] min-w-0">
                <p className="text-[12px] text-zinc-300 truncate">{t.customerName ?? "—"}</p>
                {t.customerEmail && <p className="text-[11px] text-zinc-600 truncate">{t.customerEmail}</p>}
              </div>
              {/* Gross */}
              <div className="w-[13%] text-right">
                <p className="font-mono text-[13px] text-white">{fmtAUD(t.amount)}</p>
              </div>
              {/* Fee */}
              <div className="w-[10%] text-right">
                <p className="font-mono text-[12px] text-zinc-500">−{fmtAUD(t.fee)}</p>
              </div>
              {/* Net */}
              <div className="w-[14%] text-right">
                <p className="font-mono text-[13px] font-semibold text-emerald-400">{fmtAUD(t.net)}</p>
              </div>
              {/* Status */}
              <div className="w-[18%]">
                <StatusBadge status={t.status} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payouts Tab ──────────────────────────────────────────────────────────

function PayoutsTab({ orgId }: { orgId: string }) {
  const [payouts, setPayouts] = useState<ConnectPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    getConnectPayouts(orgId).then((p) => { setPayouts(p); setLoading(false); });
  }, [orgId]);

  const handleTriggerPayout = async () => {
    setTriggering(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      await fetch(`${supabaseUrl}/functions/v1/process-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const updated = await getConnectPayouts(orgId);
      setPayouts(updated);
    } finally {
      setTriggering(false);
    }
  };

  const statusConfig: Record<string, string> = {
    paid: "text-emerald-400",
    pending: "text-amber-400",
    in_transit: "text-blue-400",
    failed: "text-rose-400",
    canceled: "text-zinc-500",
  };

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[14px] font-semibold text-white">Payout History</h3>
          <p className="text-[12px] text-zinc-500 mt-0.5">Funds transferred to your linked bank account</p>
        </div>
        <button
          onClick={handleTriggerPayout}
          disabled={triggering}
          className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          {triggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          Instant Payout
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Clock className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-[14px] text-zinc-400">No payouts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-5 py-3.5">
              <div>
                <p className="font-mono text-[12px] text-zinc-300">{p.id}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Arrival: {new Date(p.arrivalDate * 1000).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[15px] font-semibold text-white">{fmtAUD(p.amount)}</p>
                <p className={`font-mono text-[11px] uppercase tracking-widest mt-0.5 ${statusConfig[p.status] ?? "text-zinc-500"}`}>
                  {p.status.replace("_", " ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Network Customers Tab ────────────────────────────────────────────────

function NetworkCustomersTab({ orgId }: { orgId: string }) {
  const [customers, setCustomers] = useState<NetworkCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<NetworkCustomer | null>(null);

  useEffect(() => {
    getNetworkCustomers(orgId).then((c) => { setCustomers(c); setLoading(false); });
  }, [orgId]);

  const riskCounts = {
    A: customers.filter((c) => c.networkIdentity?.trustGrade === "A").length,
    F: customers.filter((c) => c.networkIdentity?.trustGrade === "F").length,
    noRecord: customers.filter((c) => !c.networkIdentity).length,
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Summary bar */}
      <div className="flex items-center gap-6 px-8 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[12px] text-zinc-400">{riskCounts.A} Grade A</span>
        </div>
        {riskCounts.F > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[12px] text-zinc-400">{riskCounts.F} Grade F — High Risk</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-600" />
          <span className="text-[12px] text-zinc-400">{riskCounts.noRecord} No Network Record</span>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] px-8 py-2.5">
        {[
          { label: "CUSTOMER", w: "w-[30%]" },
          { label: "TRUST GRADE", w: "w-[22%]" },
          { label: "INVOICED", w: "w-[16%] text-right" },
          { label: "PAID", w: "w-[16%] text-right" },
          { label: "NETWORK WORKSPACES", w: "w-[16%] text-right" },
        ].map((c) => (
          <div key={c.label} className={`${c.w} font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-semibold`}>
            {c.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-white/[0.03] px-8 py-3.5">
              <div className="h-4 w-36 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-4 w-24 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Users className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-[14px] text-zinc-400">No customers yet</p>
        </div>
      ) : (
        customers.map((customer) => {
          const grade = customer.networkIdentity?.trustGrade ?? null;
          return (
            <div key={customer.id} className="flex items-center gap-4 border-b border-white/[0.04] px-8 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="w-[30%] min-w-0">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{customer.name}</p>
                {customer.email && <p className="text-[11px] text-zinc-500 truncate">{customer.email}</p>}
              </div>
              <div className="w-[22%]">
                {grade ? (
                  <TrustBadge grade={grade} onClick={() => setSelectedCustomer(customer)} />
                ) : (
                  <span className="font-mono text-[11px] text-zinc-600">No record</span>
                )}
              </div>
              <div className="w-[16%] text-right">
                <p className="font-mono text-[13px] text-zinc-300">{fmtAUD(customer.totalInvoiced * 100)}</p>
              </div>
              <div className="w-[16%] text-right">
                <p className="font-mono text-[13px] text-emerald-400">{fmtAUD(customer.totalPaid * 100)}</p>
              </div>
              <div className="w-[16%] text-right">
                <p className="font-mono text-[12px] text-zinc-500">
                  {customer.networkIdentity?.workspaceCount ?? "—"}
                </p>
              </div>
            </div>
          );
        })
      )}

      <TrustSlideOver customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────

function ConnectSettingsTab({ orgId, status }: { orgId: string; status: ConnectStatus }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const openStripeDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const { url } = await res.json();
      if (url) window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  };

  const copyAccountId = () => {
    if (status.stripeAccountId) {
      navigator.clipboard.writeText(status.stripeAccountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-auto px-8 py-6 space-y-4 max-w-2xl">
      <h3 className="text-[14px] font-semibold text-white">Connection Settings</h3>

      {/* Account status */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${status.chargesEnabled ? "bg-emerald-500/10" : "bg-zinc-800"}`}>
              {status.chargesEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-zinc-500" />}
            </div>
            <div>
              <p className="text-[13px] font-medium text-zinc-200">Payment Processing</p>
              <p className="text-[11px] text-zinc-500">{status.chargesEnabled ? "Active — accepting payments" : "Pending verification"}</p>
            </div>
          </div>
          <div className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${status.chargesEnabled ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700"}`}>
            {status.chargesEnabled ? "ENABLED" : "PENDING"}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${status.payoutsEnabled ? "bg-emerald-500/10" : "bg-zinc-800"}`}>
              {status.payoutsEnabled ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-zinc-500" />}
            </div>
            <div>
              <p className="text-[13px] font-medium text-zinc-200">Bank Payouts</p>
              <p className="text-[11px] text-zinc-500">{status.payoutsEnabled ? "Active — funds transfer to your bank" : "Pending bank account verification"}</p>
            </div>
          </div>
          <div className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${status.payoutsEnabled ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-zinc-500 bg-zinc-800 border-zinc-700"}`}>
            {status.payoutsEnabled ? "ENABLED" : "PENDING"}
          </div>
        </div>
      </div>

      {/* Account ID */}
      {status.stripeAccountId && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Stripe Account ID</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[12px] text-zinc-300">{status.stripeAccountId}</p>
            <button onClick={copyAccountId} className="ml-auto flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Stripe Express Dashboard */}
      <button
        onClick={openStripeDashboard}
        disabled={loading}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-50"
      >
        <div>
          <p className="text-[13px] font-medium text-zinc-200">Stripe Express Dashboard</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Access detailed payout schedules, tax documents, and bank account settings</p>
        </div>
        {loading ? <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" /> : <ExternalLink className="w-4 h-4 text-zinc-500" />}
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────

type Tab = "overview" | "payouts" | "customers" | "settings";

export default function IWorkrConnectPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [balance, setBalance] = useState<ConnectBalance | null>(null);
  const [transactions, setTransactions] = useState<ConnectTransaction[]>([]);
  const [stats, setStats] = useState<ConnectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [successToast, setSuccessToast] = useState(false);

  const loadData = useCallback(async (oid: string) => {
    const connectStatus = await getConnectStatus(oid);
    setStatus(connectStatus);
    setLoading(false);

    if (connectStatus.isActivated) {
      const [bal, txs, st] = await Promise.all([
        getConnectBalance(oid),
        getConnectTransactions(oid),
        getConnectStats(oid),
      ]);
      setBalance(bal);
      setTransactions(txs);
      setStats(st);
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadData(orgId);
  }, [orgId, loadData]);

  // Handle setup=success redirect from Stripe
  useEffect(() => {
    if (searchParams.get("setup") === "success" && orgId) {
      setSuccessToast(true);
      router.replace("/dashboard/finance/iworkr-connect");
      setTimeout(() => setSuccessToast(false), 4000);
      // Re-fetch status after short delay (webhook may not have fired yet)
      setTimeout(() => { if (orgId) loadData(orgId); }, 2000);
    }
  }, [searchParams, orgId, router, loadData]);

  const handleExport = async () => {
    if (!orgId) return;
    const { csv } = await exportStatementCsv(orgId);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iworkr-connect-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "payouts", label: "Payouts" },
    { id: "customers", label: "Network Customers" },
    { id: "settings", label: "Settings" },
  ];

  // Show onboarding vault if not activated
  if (!loading && status && !status.isActivated) {
    return (
      <div className="flex h-full flex-col bg-[#050505]">
        <OnboardingVault orgId={orgId ?? ""} onSuccess={() => { if (orgId) loadData(orgId); }} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505] overflow-hidden">
      {/* Success Toast */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/80 backdrop-blur-sm px-5 py-3 text-[13px] font-medium text-emerald-300 shadow-2xl"
          >
            <CheckCircle2 className="w-4 h-4" />
            iWorkr Connect activated! Your bank account is now linked.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.05] px-8">
        {/* Breadcrumb + Tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">Finance</span>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">iWorkr Connect</span>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/[0.06] text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open("/pay", "_blank")}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Payment Page
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-[12px] text-zinc-200 transition-colors hover:bg-white/[0.08]"
          >
            <Download className="w-3.5 h-3.5" />
            Export Statement
          </button>
        </div>
      </div>

      {/* Telemetry Ribbon */}
      <TelemetryRibbon balance={balance} stats={stats} loading={loading || txLoading} />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "overview" && (
          <TransactionLedger transactions={transactions} loading={txLoading} />
        )}
        {activeTab === "payouts" && orgId && (
          <PayoutsTab orgId={orgId} />
        )}
        {activeTab === "customers" && orgId && (
          <NetworkCustomersTab orgId={orgId} />
        )}
        {activeTab === "settings" && orgId && status && (
          <ConnectSettingsTab orgId={orgId} status={status} />
        )}
      </div>
    </div>
  );
}
