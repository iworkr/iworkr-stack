"use client";

import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from "framer-motion";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Plus,
  Send,
  Copy,
  Trash2,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Building2,
  ExternalLink,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { dailyRevenue as mockDailyRevenue, payouts as mockPayouts, type Invoice, type Payout } from "@/lib/data";
import { useFinanceStore, type FinanceTab } from "@/lib/finance-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useShellStore } from "@/lib/shell-store";

/* ── Status config ────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10" },
  sent: { label: "Sent", dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/10" },
  paid: { label: "Paid", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  overdue: { label: "Overdue", dot: "bg-red-400", text: "text-red-400", bg: "bg-red-500/10" },
  voided: { label: "Voided", dot: "bg-zinc-600", text: "text-zinc-600", bg: "bg-zinc-600/10" },
};

const tabs: { id: FinanceTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "payouts", label: "Payouts" },
];

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Invoice", icon: <FileText size={13} /> },
  { id: "send", label: "Send Invoice", icon: <Send size={13} /> },
  { id: "copy", label: "Copy Link", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "void", label: "Void Invoice", icon: <Trash2 size={13} />, danger: true },
];

/* ── Animated Number ──────────────────────────────────────── */

function AnimatedNumber({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => `${prefix}${Math.round(v).toLocaleString()}`);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsub = display.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsub;
  }, [display]);

  return <span ref={ref}>{prefix}0</span>;
}

/* ── Page ─────────────────────────────────────────────────── */

export default function FinancePage() {
  const router = useRouter();
  const { invoices, payouts: storePayouts, dailyRevenue: storeDailyRevenue, overview, activeTab, setActiveTab, focusedIndex, setFocusedIndex, updateInvoiceStatus, deleteInvoice, restoreInvoice } = useFinanceStore();
  const { addToast } = useToastStore();
  const { setCreateInvoiceModalOpen } = useShellStore();

  const [search, setSearch] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; invoiceId: string }>({
    open: false, x: 0, y: 0, invoiceId: "",
  });
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);

  const dailyRevenue = storeDailyRevenue.length > 0 ? storeDailyRevenue : mockDailyRevenue;
  const payouts = storePayouts.length > 0 ? storePayouts : mockPayouts;

  /* ── Computed ────────────────────────────────────────────── */
  const totalRevenueMTD = overview?.revenue_mtd ?? dailyRevenue.reduce((sum, d) => sum + d.amount, 0);
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const totalOverdue = overview?.overdue_amount ?? overdueInvoices.reduce((sum, i) => sum + i.total, 0);
  const stripeBalance = overview?.stripe_balance ?? 4200;
  const avgPayoutDays = overview?.avg_payout_days ?? 2.4;

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Chart computation ──────────────────────────────────── */
  const chartW = 900;
  const chartH = 180;
  const pad = 20;
  const maxAmount = Math.max(...dailyRevenue.map((d) => d.amount), 1);

  const chartPoints = dailyRevenue.map((d, i) => ({
    x: pad + (i / Math.max(dailyRevenue.length - 1, 1)) * (chartW - pad * 2),
    y: chartH - pad - (d.amount / maxAmount) * (chartH - pad * 2),
  }));

  // Smooth bezier path
  function bezierPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
      const cp1y = pts[i].y;
      const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) / 3;
      const cp2y = pts[i + 1].y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return d;
  }

  const linePath = bezierPath(chartPoints);
  const last = chartPoints[chartPoints.length - 1];
  const first = chartPoints[0];
  const areaPath = `${linePath} L ${last?.x || 0} ${chartH} L ${first?.x || 0} ${chartH} Z`;

  /* ── Keyboard ───────────────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (activeTab === "invoices") {
        if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIndex(Math.min(focusedIndex + 1, filteredInvoices.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIndex(Math.max(focusedIndex - 1, 0)); }
        else if (e.key === "Enter") {
          e.preventDefault();
          const inv = filteredInvoices[focusedIndex];
          if (inv) router.push(`/dashboard/finance/invoices/${inv.id}`);
        }
      }
    },
    [activeTab, filteredInvoices, focusedIndex, router, setFocusedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Context menu ───────────────────────────────────────── */
  function handleContextAction(actionId: string) {
    const inv = invoices.find((i) => i.id === ctxMenu.invoiceId);
    if (!inv) return;

    if (actionId === "open") {
      router.push(`/dashboard/finance/invoices/${inv.id}`);
    } else if (actionId === "send") {
      updateInvoiceStatus(inv.id, "sent");
      addToast(`${inv.id} sent to ${inv.clientEmail}`);
    } else if (actionId === "copy" && inv.paymentLink) {
      navigator.clipboard?.writeText(inv.paymentLink);
      addToast("Payment link copied");
    } else if (actionId === "void") {
      updateInvoiceStatus(inv.id, "voided");
      addToast(`${inv.id} voided`, () => {
        updateInvoiceStatus(inv.id, inv.status);
      });
    }
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-medium text-zinc-200">Finance</h1>
            <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] text-zinc-500">
              {invoices.length} invoices
            </span>
            {overdueInvoices.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400">
                <AlertTriangle size={9} />
                {overdueInvoices.length} overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "invoices" && (
              <div className="flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 transition-colors focus-within:border-[rgba(255,255,255,0.15)]">
                <Search size={12} className="text-zinc-600" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
                  placeholder="Search invoices..."
                  className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                />
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setCreateInvoiceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
            >
              <Plus size={12} />
              New Invoice
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-px px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-white text-zinc-200"
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════════ */}
          {/* OVERVIEW TAB                                     */}
          {/* ════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Revenue Banner */}
              <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-6">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-wider text-zinc-600 uppercase">
                  <DollarSign size={11} />
                  Total Revenue (MTD)
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[48px] font-semibold tracking-tighter text-zinc-100">
                    <AnimatedNumber value={totalRevenueMTD} />
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                    <TrendingUp size={10} />
                    ▲ 18% vs last month
                  </span>
                </div>

                {/* Chart */}
                <div className="relative mt-4">
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Area */}
                    <motion.path
                      d={areaPath}
                      fill="url(#rev-grad)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                    {/* Line */}
                    <motion.path
                      d={linePath}
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                    {/* Hover zones + dots */}
                    {chartPoints.map((p, i) => (
                      <g key={i}>
                        <rect
                          x={p.x - (chartW / dailyRevenue.length / 2)}
                          y={0}
                          width={chartW / dailyRevenue.length}
                          height={chartH}
                          fill="transparent"
                          onMouseEnter={() => setHoveredPoint(i)}
                        />
                        {(hoveredPoint === i || dailyRevenue[i].amount > 0) && (
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredPoint === i ? 4 : 2}
                            fill={hoveredPoint === i ? "#22C55E" : "#0a0a0a"}
                            stroke="#22C55E"
                            strokeWidth="1.5"
                          />
                        )}
                        {/* Crosshair */}
                        {hoveredPoint === i && (
                          <line
                            x1={p.x}
                            y1={0}
                            x2={p.x}
                            y2={chartH}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        )}
                      </g>
                    ))}
                  </svg>

                  {/* Tooltip */}
                  <AnimatePresence>
                    {hoveredPoint !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute z-10 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]/90 px-3 py-2 backdrop-blur-xl"
                        style={{
                          left: `${(chartPoints[hoveredPoint].x / chartW) * 100}%`,
                          top: -8,
                          transform: "translateX(-50%)",
                        }}
                      >
                        <div className="text-[11px] font-medium text-zinc-300">
                          {dailyRevenue[hoveredPoint].date}
                        </div>
                        <div className="text-[13px] font-semibold text-emerald-400">
                          ${dailyRevenue[hoveredPoint].amount.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-zinc-600">
                          {dailyRevenue[hoveredPoint].invoiceCount} invoice{dailyRevenue[hoveredPoint].invoiceCount !== 1 ? "s" : ""} paid
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Date labels */}
                  <div className="mt-1 flex justify-between px-1">
                    {dailyRevenue.filter((_, i) => i % 2 === 0).map((d) => (
                      <span key={d.date} className="text-[8px] text-zinc-700">{d.date}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Liquid Assets Grid */}
              <div className="grid grid-cols-3 gap-4 p-6">
                {/* Stripe Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[11px] tracking-wider text-zinc-600 uppercase">
                    <CreditCard size={11} />
                    Stripe Balance
                  </div>
                  <div className="mb-2 text-[24px] font-semibold tracking-tight text-zinc-100">
                    ${stripeBalance.toLocaleString()}
                  </div>
                  <div className="mb-3 text-[11px] text-zinc-600">Arriving Tuesday</div>
                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "65%" }}
                      transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                    />
                  </div>
                  <div className="mt-1 text-[9px] text-zinc-700">Clearing...</div>
                </motion.div>

                {/* Overdue */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[11px] tracking-wider text-red-400/60 uppercase">
                    <AlertTriangle size={11} />
                    Overdue
                  </div>
                  <div className="mb-3 text-[24px] font-semibold tracking-tight text-red-400">
                    ${totalOverdue.toLocaleString()}
                  </div>
                  <div className="space-y-2">
                    {overdueInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                        className="group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-red-500/5"
                      >
                        <div>
                          <span className="font-mono text-[11px] text-zinc-500">{inv.id}</span>
                          <span className="ml-2 text-[11px] text-zinc-400">{inv.clientName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-red-400">
                            ${inv.total.toLocaleString()}
                          </span>
                          <Send
                            size={10}
                            className="text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Avg Payout */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[11px] tracking-wider text-zinc-600 uppercase">
                    <Clock size={11} />
                    Avg Payout Time
                  </div>
                  <div className="mb-1 text-[48px] font-semibold tracking-tighter text-zinc-100">
                    {avgPayoutDays}
                  </div>
                  <div className="text-[12px] text-zinc-600">Days to payment</div>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400">
                    <TrendingUp size={10} />
                    0.3 days faster than average
                  </div>
                </motion.div>
              </div>

              {/* Quick recent */}
              <div className="px-6 pb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab("invoices")}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    View all <ArrowRight size={10} />
                  </button>
                </div>
                <div className="space-y-1">
                  {invoices.slice(0, 5).map((inv, i) => {
                    const sc = statusConfig[inv.status];
                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.03 }}
                        onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                        className="group flex cursor-pointer items-center rounded-lg px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <span className="w-24 font-mono text-[11px] text-zinc-600">{inv.id}</span>
                        <span className="flex-1 text-[12px] text-zinc-400">{inv.clientName}</span>
                        <span className={`mr-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${sc.bg} ${sc.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                        <span className="w-20 text-right text-[12px] font-medium text-zinc-300">
                          ${inv.total.toLocaleString()}
                        </span>
                        <ArrowRight size={12} className="ml-2 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/* INVOICES TAB                                     */}
          {/* ════════════════════════════════════════════════ */}
          {activeTab === "invoices" && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Column headers */}
              <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-2">
                <div className="w-28 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Invoice</div>
                <div className="w-24 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Status</div>
                <div className="min-w-0 flex-1 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Client</div>
                <div className="w-28 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Date</div>
                <div className="w-28 px-2 text-right text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Amount</div>
                <div className="w-8" />
              </div>

              {/* Rows */}
              <div className="flex-1">
                <AnimatePresence>
                  {filteredInvoices.map((inv, i) => {
                    const sc = statusConfig[inv.status];
                    const isFocused = i === focusedIndex;

                    return (
                      <motion.div
                        key={inv.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ delay: i * 0.015, duration: 0.2 }}
                        onClick={() => {
                          setFocusedIndex(i);
                          router.push(`/dashboard/finance/invoices/${inv.id}`);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ open: true, x: e.clientX, y: e.clientY, invoiceId: inv.id });
                        }}
                        className={`group flex cursor-pointer items-center border-b border-[rgba(255,255,255,0.04)] px-5 transition-colors ${
                          isFocused ? "bg-[rgba(255,255,255,0.04)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                        }`}
                        style={{ height: 48 }}
                      >
                        <div className="w-28 px-2 font-mono text-[11px] text-zinc-500">{inv.id}</div>
                        <div className="w-24 px-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${sc.bg} ${sc.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 px-2 text-[12px] text-zinc-400">{inv.clientName}</div>
                        <div className="w-28 px-2 text-[11px] text-zinc-600">{inv.issueDate}</div>
                        <div className="w-28 px-2 text-right text-[12px] font-medium text-zinc-300">
                          ${inv.total.toLocaleString()}
                        </div>
                        <div className="w-8 text-right">
                          <ArrowRight size={12} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════ */}
          {/* PAYOUTS TAB                                      */}
          {/* ════════════════════════════════════════════════ */}
          {activeTab === "payouts" && (
            <motion.div
              key="payouts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <div className="mb-4 flex items-center gap-2 text-[11px] tracking-wider text-zinc-600 uppercase">
                <Banknote size={12} />
                Bank Transfers
              </div>
              <div className="space-y-2">
                {payouts.map((payout, i) => {
                  const isExpanded = expandedPayout === payout.id;
                  const linkedInvoices = invoices.filter((inv) =>
                    payout.invoiceIds.includes(inv.id)
                  );
                  const psColor =
                    payout.status === "completed"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : payout.status === "processing"
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-amber-400 bg-amber-500/10";

                  return (
                    <motion.div
                      key={payout.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
                    >
                      <button
                        onClick={() => setExpandedPayout(isExpanded ? null : payout.id)}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
                          <Building2 size={14} className="text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-medium text-zinc-300">{payout.bank}</div>
                          <div className="text-[11px] text-zinc-600">{payout.date}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${psColor}`}>
                          {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {payout.status === "completed" ? (
                            <ArrowDownRight size={12} className="text-emerald-400" />
                          ) : (
                            <ArrowUpRight size={12} className="text-blue-400" />
                          )}
                          <span className="text-[14px] font-semibold text-zinc-200">
                            ${payout.amount.toLocaleString()}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={14} className="text-zinc-600" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && linkedInvoices.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-[rgba(255,255,255,0.06)]"
                          >
                            <div className="px-5 py-3">
                              <div className="mb-2 text-[10px] tracking-wider text-zinc-600 uppercase">
                                Source Invoices
                              </div>
                              <div className="space-y-1">
                                {linkedInvoices.map((inv) => (
                                  <div
                                    key={inv.id}
                                    onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-zinc-500">{inv.id}</span>
                                      <span className="text-[11px] text-zinc-400">{inv.clientName}</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-zinc-300">
                                      ${inv.total.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context Menu */}
      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={contextItems}
        onSelect={handleContextAction}
        onClose={() => setCtxMenu((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
