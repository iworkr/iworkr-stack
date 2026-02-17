"use client";

import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from "framer-motion";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search,
  Plus,
  Send,
  Copy,
  Trash2,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Building2,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Vault,
} from "lucide-react";
import { type Invoice, type Payout } from "@/lib/data";
import { useFinanceStore, type FinanceTab } from "@/lib/finance-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useShellStore } from "@/lib/shell-store";
import { getQuotes, sendQuote, type Quote } from "@/app/actions/quotes";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Status config (refined palette) ──────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10" },
  sent: { label: "Sent", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/10" },
  paid: { label: "Paid", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  overdue: { label: "Overdue", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/10" },
  voided: { label: "Voided", dot: "bg-zinc-600", text: "text-zinc-600", bg: "bg-zinc-600/10" },
};

const tabs: { id: FinanceTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "quotes", label: "Quotes" },
  { id: "payouts", label: "Payouts" },
];

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Invoice", icon: <FileText size={13} /> },
  { id: "send", label: "Send Invoice", icon: <Send size={13} /> },
  { id: "copy", label: "Copy Link", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "void", label: "Void Invoice", icon: <Trash2 size={13} />, danger: true },
];

/* ── Animated Counter (easeOutExpo, 800ms) ────────────────── */

function AnimatedNumber({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 25 });
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

/* ── Mini Sparkline (SVG) ─────────────────────────────────── */

function Sparkline({ data, color = "#10B981", width = 80, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <polygon
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
    </svg>
  );
}

/* ── Lottie-style Empty State ─────────────────────────────── */

function LedgerEmptyState({ title, subtitle, cta, onCta }: { title: string; subtitle: string; cta?: string; onCta?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        {/* Vault animation rings */}
        <div className="absolute inset-0 rounded-full border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-full border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
        {/* Coin orbit */}
        <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "5s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <DollarSign size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[240px] text-[12px] text-zinc-600">{subtitle}</p>
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-4 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
        >
          <Plus size={12} />
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function FinancePage() {
  const router = useRouter();
  const { invoices, payouts: storePayouts, dailyRevenue: storeDailyRevenue, overview, loading, loaded, activeTab, setActiveTab, focusedIndex, setFocusedIndex, updateInvoiceStatusServer, deleteInvoice, restoreInvoice } = useFinanceStore();
  const { addToast } = useToastStore();
  const { setCreateInvoiceModalOpen } = useShellStore();

  const { orgId } = useOrg();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; invoiceId: string }>({
    open: false, x: 0, y: 0, invoiceId: "",
  });
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "quotes" && orgId && quotes.length === 0) {
      setQuotesLoading(true);
      getQuotes(orgId).then((res) => {
        if (res.data) setQuotes(res.data);
        setQuotesLoading(false);
      });
    }
  }, [activeTab, orgId, quotes.length]);

  const dailyRevenue = storeDailyRevenue;
  const payouts = storePayouts;

  /* ── Computed ────────────────────────────────────────────── */
  const totalRevenueMTD = overview?.revenue_mtd ?? dailyRevenue.reduce((sum, d) => sum + d.amount, 0);
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const totalOverdue = overview?.overdue_amount ?? overdueInvoices.reduce((sum, i) => sum + i.total, 0);
  const stripeBalance = overview?.stripe_balance ?? 4200;
  const avgPayoutDays = overview?.avg_payout_days ?? 2.4;

  const filteredInvoices = useMemo(() => invoices.filter(
    (inv) =>
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase())
  ), [invoices, search]);

  /* ── Chart computation ──────────────────────────────────── */
  const chartW = 900;
  const chartH = 200;
  const pad = 20;
  const maxAmount = dailyRevenue.length > 0 ? Math.max(...dailyRevenue.map((d) => d.amount), 1) : 1;

  const chartPoints = dailyRevenue.map((d, i) => ({
    x: pad + (i / Math.max(dailyRevenue.length - 1, 1)) * (chartW - pad * 2),
    y: chartH - pad - (d.amount / maxAmount) * (chartH - pad * 2),
  }));

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
  const areaPath = chartPoints.length >= 2
    ? `${linePath} L ${last.x} ${chartH} L ${first.x} ${chartH} Z`
    : "";

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
        } else if (e.key === "/" && !showSearch) {
          e.preventDefault();
          setShowSearch(true);
        }
      }
    },
    [activeTab, filteredInvoices, focusedIndex, router, setFocusedIndex, showSearch]
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
      updateInvoiceStatusServer(inv.id, inv.dbId || inv.id, "sent");
      addToast(`${inv.id} sent to ${inv.clientEmail}`);
    } else if (actionId === "copy" && inv.paymentLink) {
      navigator.clipboard?.writeText(inv.paymentLink);
      addToast("Payment link copied");
    } else if (actionId === "void") {
      updateInvoiceStatusServer(inv.id, inv.dbId || inv.id, "voided");
      addToast(`${inv.id} voided`);
    }
  }

  /* ── Sparkline data for payout speed ────────────────────── */
  const payoutSparkData = useMemo(() => [3.2, 2.8, 3.1, 2.5, 2.4, 2.1, 2.4], []);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.05]">
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-medium text-white">Finance</h1>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {invoices.length} invoices
            </span>
            {overdueInvoices.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400">
                <AlertTriangle size={9} />
                {overdueInvoices.length} overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "invoices" && (
              <>
                <AnimatePresence>
                  {showSearch && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 200, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2 py-1">
                        <Search size={12} className="shrink-0 text-zinc-600" />
                        <input
                          autoFocus
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
                          onBlur={() => { if (!search) setShowSearch(false); }}
                          onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); setShowSearch(false); } }}
                          placeholder="Search invoices…"
                          className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                        />
                        {search && (
                          <button onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-400">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!showSearch && (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400"
                  >
                    <Search size={14} />
                  </button>
                )}
              </>
            )}
            {activeTab === "quotes" ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/dashboard/finance/quotes/new")}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-2.5 py-1 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
              >
                <Plus size={12} />
                New Quote
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setCreateInvoiceModalOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-2.5 py-1 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
              >
                <Plus size={12} />
                New Invoice
              </motion.button>
            )}
          </div>
        </div>

        {/* Tabs — minimal underline style */}
        <div className="flex gap-0.5 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-[12px] transition-colors duration-150 ${
                activeTab === tab.id
                  ? "font-medium text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="finance-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[1.5px] rounded-full bg-white"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ══════════════════════════════════════════════════ */}
          {/* OVERVIEW TAB                                       */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {/* ── Hero: Revenue Banner + Area Chart ──────────── */}
              <div className="relative overflow-hidden border-b border-white/[0.04] px-6 pb-4 pt-6">
                {/* Noise texture */}
                <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />

                <div className="relative z-10">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                    <DollarSign size={10} />
                    Total Revenue (MTD)
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[48px] font-semibold tracking-tighter text-white">
                      <AnimatedNumber value={totalRevenueMTD} />
                    </span>
                    {(() => {
                      const growthPct = overview?.revenue_growth ?? null;
                      if (growthPct === null) return null;
                      const isUp = growthPct >= 0;
                      return (
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                          {isUp ? <TrendingUp size={10} /> : <ArrowDownRight size={10} />}
                          {isUp ? "+" : ""}{Math.abs(Math.round(growthPct))}% vs last month
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Chart — draws left to right, gradient fades in after */}
                <div className="relative mt-4">
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Area gradient (fades in after line draws) */}
                    {areaPath && (
                      <motion.path
                        d={areaPath}
                        fill="url(#rev-grad)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.2 }}
                      />
                    )}
                    {/* Line (draws left to right) */}
                    {linePath && (
                      <motion.path
                        d={linePath}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    )}
                    {/* Hover zones + dots */}
                    {chartPoints.map((p, i) => (
                      <g key={i}>
                        <rect
                          x={p.x - (chartW / Math.max(dailyRevenue.length, 1) / 2)}
                          y={0}
                          width={chartW / Math.max(dailyRevenue.length, 1)}
                          height={chartH}
                          fill="transparent"
                          onMouseEnter={() => setHoveredPoint(i)}
                        />
                        {hoveredPoint === i && (
                          <>
                            <line
                              x1={p.x} y1={0} x2={p.x} y2={chartH}
                              stroke="rgba(255,255,255,0.06)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                            <circle cx={p.x} cy={p.y} r={4} fill="#10B981" stroke="#050505" strokeWidth="2" />
                          </>
                        )}
                      </g>
                    ))}
                  </svg>

                  {/* Tooltip */}
                  <AnimatePresence>
                    {hoveredPoint !== null && dailyRevenue[hoveredPoint] && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute z-10 rounded-lg border border-white/[0.08] bg-[#0A0A0A]/95 px-3 py-2 shadow-xl backdrop-blur-xl"
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

                  {/* Minimal X-axis labels */}
                  <div className="mt-1 flex justify-between px-1">
                    {dailyRevenue.length > 0 && (
                      <>
                        <span className="text-[9px] text-zinc-700">{dailyRevenue[0]?.date}</span>
                        {dailyRevenue.length > 4 && (
                          <span className="text-[9px] text-zinc-700">{dailyRevenue[Math.floor(dailyRevenue.length / 2)]?.date}</span>
                        )}
                        <span className="text-[9px] text-zinc-700">{dailyRevenue[dailyRevenue.length - 1]?.date}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Secondary Metrics: Glass/Zinc Cards ────────── */}
              <div className="grid grid-cols-3 gap-4 p-6">
                {/* Stripe Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="group rounded-xl border border-white/[0.05] bg-zinc-900/30 p-5 transition-colors duration-200 hover:border-white/[0.08]"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                    <CreditCard size={11} className="transition-colors duration-200 group-hover:text-zinc-400" />
                    Stripe Balance
                  </div>
                  <div className="mb-1 text-[28px] font-semibold tracking-tight text-white">
                    <AnimatedNumber value={stripeBalance} />
                  </div>
                  <div className="mb-3 text-[11px] text-zinc-600">
                    {(() => {
                      const pending = payouts.find((p) => p.status === "pending" || p.status === "processing");
                      if (!pending?.date) return "Available to payout";
                      const arrival = new Date(pending.date);
                      const today = new Date();
                      const diffDays = Math.ceil((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays <= 0) return "Arriving today";
                      if (diffDays === 1) return "Arriving tomorrow";
                      const dayName = arrival.toLocaleDateString("en-US", { weekday: "long" });
                      return `Arriving ${dayName}`;
                    })()}
                  </div>
                  {/* Thin progress bar */}
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "65%" }}
                      transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full bg-emerald-500/60"
                    />
                  </div>
                </motion.div>

                {/* Overdue */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="rounded-xl border border-white/[0.05] bg-zinc-900/30 p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-wider text-rose-400/60 uppercase">
                    <AlertTriangle size={11} />
                    Overdue
                  </div>
                  <div className="mb-3 text-[28px] font-semibold tracking-tight text-rose-400">
                    <AnimatedNumber value={totalOverdue} />
                  </div>
                  <div className="space-y-1.5">
                    {overdueInvoices.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                        className="group/row flex cursor-pointer items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-rose-500/[0.04]"
                      >
                        <div>
                          <span className="font-mono text-[10px] text-zinc-600">{inv.id}</span>
                          <span className="ml-2 text-[10px] text-zinc-500">{inv.clientName}</span>
                        </div>
                        <span className="text-[10px] font-medium text-rose-400">
                          ${inv.total.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {overdueInvoices.length > 0 && (
                      <button className="mt-1 text-[10px] text-zinc-600 transition-colors hover:text-rose-400">
                        Send Reminders
                      </button>
                    )}
                  </div>
                </motion.div>

                {/* Avg Payout Time */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="rounded-xl border border-white/[0.05] bg-zinc-900/30 p-5"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                    <Clock size={11} />
                    Avg Payout Time
                  </div>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-[28px] font-semibold tracking-tight text-white">{avgPayoutDays}</span>
                    <span className="text-[12px] text-zinc-600">days</span>
                  </div>
                  <div className="mb-3 text-[11px] text-zinc-600">Days to payment</div>
                  {/* Mini sparkline showing payout speed trend */}
                  <div className="mb-2">
                    <Sparkline data={payoutSparkData} color={avgPayoutDays <= 3 ? "#10B981" : "#F59E0B"} />
                  </div>
                  {avgPayoutDays > 0 && (
                    <div className={`flex items-center gap-1 text-[10px] ${avgPayoutDays <= 3 ? "text-emerald-400" : "text-amber-400"}`}>
                      <TrendingUp size={9} />
                      {avgPayoutDays <= 3 ? "Faster than industry avg" : "On par with industry avg"}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* ── Recent Activity (The Ledger preview) ───────── */}
              <div className="px-6 pb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab("invoices")}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    View all <ArrowRight size={9} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {invoices.slice(0, 5).map((inv, i) => {
                    const sc = statusConfig[inv.status];
                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.03, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                        className="group flex cursor-pointer items-center rounded-md px-3 py-2 transition-colors duration-100 hover:bg-white/[0.02]"
                      >
                        {/* Status dot */}
                        <div className="w-6">
                          <span className={`inline-block h-[6px] w-[6px] rounded-full ${sc.dot}`} />
                        </div>
                        <span className="w-20 font-mono text-[11px] text-zinc-600">{inv.id}</span>
                        <span className="flex-1 text-[12px] font-medium text-zinc-300 group-hover:text-white">{inv.clientName}</span>
                        <span className="w-24 text-[11px] text-zinc-600">{inv.issueDate}</span>
                        <span className="w-24 text-right font-mono text-[12px] font-medium text-zinc-200">
                          ${inv.total.toLocaleString()}
                        </span>
                        <ArrowRight size={11} className="ml-2 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* INVOICES TAB — The Ledger                          */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === "invoices" && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Column headers */}
              <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-1.5">
                <div className="w-6" />
                <div className="w-24 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Invoice</div>
                <div className="w-24 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Date</div>
                <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Client</div>
                <div className="w-28 px-2 text-right text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Amount</div>
                <div className="w-8" />
              </div>

              {/* Rows */}
              <div className="flex-1">
                {filteredInvoices.length === 0 && !loading ? (
                  <LedgerEmptyState
                    title="The ledger is empty"
                    subtitle={search ? "Try a different search term." : "Start earning."}
                    cta={!search ? "Create First Invoice" : undefined}
                    onCta={!search ? () => setCreateInvoiceModalOpen(true) : undefined}
                  />
                ) : (
                <AnimatePresence>
                  {filteredInvoices.map((inv, i) => {
                    const sc = statusConfig[inv.status];
                    const isFocused = i === focusedIndex;

                    return (
                      <motion.div
                        key={inv.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => {
                          setFocusedIndex(i);
                          router.push(`/dashboard/finance/invoices/${inv.id}`);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ open: true, x: e.clientX, y: e.clientY, invoiceId: inv.id });
                        }}
                        className={`group flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 ${
                          isFocused ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                        }`}
                        style={{ height: 42 }}
                      >
                        {/* Status dot */}
                        <div className="w-6">
                          <span className={`inline-block h-[6px] w-[6px] rounded-full ${sc.dot}`} />
                        </div>
                        <div className="w-24 px-2 font-mono text-[11px] text-zinc-600 transition-colors group-hover:text-zinc-400">{inv.id}</div>
                        <div className="w-24 px-2 text-[11px] text-zinc-600">{inv.issueDate}</div>
                        <div className="min-w-0 flex-1 px-2 text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">{inv.clientName}</div>
                        <div className="w-28 px-2 text-right font-mono text-[12px] font-medium text-white">
                          ${inv.total.toLocaleString()}
                        </div>
                        <div className="w-8 text-right">
                          <ArrowRight size={11} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* QUOTES TAB                                         */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === "quotes" && (
            <motion.div
              key="quotes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {/* Column headers */}
              <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-1.5">
                <div className="w-6" />
                <div className="w-24 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Quote</div>
                <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Client</div>
                <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Valid Until</div>
                <div className="w-28 px-2 text-right text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Amount</div>
                <div className="w-8" />
              </div>

              {/* Rows */}
              <div className="flex-1">
                {quotes.length === 0 && !quotesLoading ? (
                  <LedgerEmptyState
                    title="No quotes yet"
                    subtitle="Create your first quote to start the sales pipeline."
                    cta="New Quote"
                    onCta={() => router.push("/dashboard/finance/quotes/new")}
                  />
                ) : (
                  <AnimatePresence>
                    {quotes.map((q, i) => {
                      const qStatusConfig: Record<string, { label: string; dot: string }> = {
                        draft: { label: "Draft", dot: "bg-zinc-500" },
                        sent: { label: "Sent", dot: "bg-sky-400" },
                        viewed: { label: "Viewed", dot: "bg-amber-400" },
                        accepted: { label: "Approved", dot: "bg-emerald-400" },
                        rejected: { label: "Declined", dot: "bg-rose-400" },
                        expired: { label: "Expired", dot: "bg-zinc-600" },
                      };
                      const sc = qStatusConfig[q.status] || qStatusConfig.draft;

                      return (
                        <motion.div
                          key={q.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => router.push(`/dashboard/finance/quotes/${q.id}`)}
                          className="group flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 hover:bg-white/[0.02]"
                          style={{ height: 42 }}
                        >
                          <div className="w-6">
                            <span className={`inline-block h-[6px] w-[6px] rounded-full ${sc.dot}`} />
                          </div>
                          <div className="w-24 px-2 font-mono text-[11px] text-zinc-600">{q.display_id}</div>
                          <div className="min-w-0 flex-1 px-2 text-[12px] font-medium text-zinc-300 group-hover:text-white">{q.client_name || "—"}</div>
                          <div className="w-28 px-2 text-[11px] text-zinc-600">
                            {q.valid_until ? new Date(q.valid_until).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—"}
                          </div>
                          <div className="w-28 px-2 text-right font-mono text-[12px] font-medium text-white">
                            ${Number(q.total).toLocaleString()}
                          </div>
                          <div className="w-8 text-right">
                            <ArrowRight size={11} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* PAYOUTS TAB                                        */}
          {/* ══════════════════════════════════════════════════ */}
          {activeTab === "payouts" && (
            <motion.div
              key="payouts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <div className="mb-4 flex items-center gap-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                <Banknote size={12} />
                Bank Transfers
              </div>
              <div className="space-y-2">
                {payouts.length === 0 && !loading && (
                  <LedgerEmptyState
                    title="No payouts yet"
                    subtitle="Payouts will appear here once invoices are paid."
                  />
                )}
                {payouts.map((payout, i) => {
                  const isExpanded = expandedPayout === payout.id;
                  const linkedInvoices = invoices.filter((inv) =>
                    payout.invoiceIds.includes(inv.id)
                  );
                  const psColor =
                    payout.status === "completed"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : payout.status === "processing"
                        ? "text-sky-400 bg-sky-500/10"
                        : "text-amber-400 bg-amber-500/10";

                  return (
                    <motion.div
                      key={payout.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className="overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-900/30"
                    >
                      <button
                        onClick={() => setExpandedPayout(isExpanded ? null : payout.id)}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-white/[0.02]"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
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
                            <ArrowUpRight size={12} className="text-sky-400" />
                          )}
                          <span className="font-mono text-[14px] font-semibold text-white">
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
                            className="border-t border-white/[0.04]"
                          >
                            <div className="px-5 py-3">
                              <div className="mb-2 text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                                Source Invoices
                              </div>
                              <div className="space-y-0.5">
                                {linkedInvoices.map((inv) => (
                                  <div
                                    key={inv.id}
                                    onClick={() => router.push(`/dashboard/finance/invoices/${inv.id}`)}
                                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.02]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-zinc-600">{inv.id}</span>
                                      <span className="text-[11px] text-zinc-400">{inv.clientName}</span>
                                    </div>
                                    <span className="font-mono text-[11px] font-medium text-zinc-300">
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
