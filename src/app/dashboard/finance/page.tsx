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
  Download,
  Eye,
  Calendar,
  Zap,
  ExternalLink,
  CheckCircle,
  Loader2,
  Wallet,
  Shield,
} from "lucide-react";
import { type Invoice, type Payout } from "@/lib/data";
import { useFinanceStore, type FinanceTab } from "@/lib/finance-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { useShellStore } from "@/lib/shell-store";
import { getQuotes, type Quote } from "@/app/actions/quotes";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Status config ───────────────────────────────────────── */

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
  { id: "payments", label: "iWorkr Pay" },
];

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Invoice", icon: <FileText size={13} /> },
  { id: "send", label: "Send Invoice", icon: <Send size={13} /> },
  { id: "copy", label: "Copy Link", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "void", label: "Void Invoice", icon: <Trash2 size={13} />, danger: true },
];

/* ── Animated Counter ─────────────────────────────────────── */

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

/* ── Mini Sparkline ───────────────────────────────────────── */

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

/* ── Lottie Empty State ───────────────────────────────────── */

function LedgerEmptyState({ title, subtitle, cta, onCta }: { title: string; subtitle: string; cta?: string; onCta?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[60px]" />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-5"
      >
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-white/[0.04] animate-signal-pulse" />
          <div className="absolute inset-2 rounded-full border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
          <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "5s" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <DollarSign size={16} strokeWidth={1.5} className="text-zinc-600" />
          </div>
        </div>
      </motion.div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[240px] text-[12px] text-zinc-600">{subtitle}</p>
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500"
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
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; invoiceId: string }>({
    open: false, x: 0, y: 0, invoiceId: "",
  });
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [timeframe, setTimeframe] = useState("This Month");

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
  const chartH = 220;
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

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

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

  const payoutSparkData = useMemo(() => [3.2, 2.8, 3.1, 2.5, 2.4, 2.1, 2.4], []);

  /* ── Shared-axis tab direction ───────────────────────────── */
  const tabOrder = tabs.map((t) => t.id);
  const prevTabRef = useRef(activeTab);
  const [tabDir, setTabDir] = useState<"left" | "right">("right");

  useEffect(() => {
    const prevIdx = tabOrder.indexOf(prevTabRef.current);
    const nextIdx = tabOrder.indexOf(activeTab);
    setTabDir(nextIdx >= prevIdx ? "right" : "left");
    prevTabRef.current = activeTab;
  }, [activeTab, tabOrder]);

  const slideVariants = {
    enter: (dir: "left" | "right") => ({
      opacity: 0,
      x: dir === "right" ? 16 : -16,
    }),
    center: { opacity: 1, x: 0 },
    exit: (dir: "left" | "right") => ({
      opacity: 0,
      x: dir === "right" ? -16 : 16,
    }),
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRightIcon size={10} className="text-zinc-700" />
              <span className="font-medium text-white">Finance</span>
            </div>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {invoices.length} invoices
            </span>
            {overdueInvoices.length > 0 && (
              <button
                onClick={() => { setActiveTab("invoices"); }}
                className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400 transition-colors hover:bg-rose-500/15"
              >
                <AlertTriangle size={9} />
                {overdueInvoices.length} overdue
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Stealth Search */}
            {activeTab === "invoices" && (
              <div className="relative flex items-center gap-2">
                <motion.div
                  className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                  initial={false}
                  animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                />
                <div className="flex items-center gap-2 pl-2">
                  <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Search invoices..."
                    className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                  />
                  {!searchFocused && !search && (
                    <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                      <span className="text-[10px]">⌘</span>F
                    </kbd>
                  )}
                </div>
              </div>
            )}

            {/* Timeframe dropdown (stealth) */}
            {activeTab === "overview" && (
              <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300">
                <Calendar size={11} />
                {timeframe}
                <ChevronDown size={10} />
              </button>
            )}

            {/* Primary action */}
            {activeTab === "quotes" ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/dashboard/finance/quotes/new")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500"
              >
                <Plus size={12} />
                New Quote
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/dashboard/finance/invoices/new")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500"
              >
                <Plus size={12} />
                New Invoice
              </motion.button>
            )}
          </div>
        </div>

        {/* Tabs — Sliding Pill */}
        <div className="flex gap-0.5 px-5 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative rounded-md px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                activeTab === tab.id
                  ? "font-medium text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="finance-tab-pill"
                  className="absolute inset-0 rounded-md bg-white/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <AnimatePresence mode="wait" custom={tabDir}>
          {/* ══════════════ OVERVIEW TAB ══════════════════════ */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              custom={tabDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ── Revenue Banner + Chart ──────────────────── */}
              <div className="relative overflow-hidden border-b border-white/[0.03] px-6 pb-4 pt-6">
                <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.012]" />
                {/* Radial glow behind chart */}
                <div className="pointer-events-none absolute bottom-0 left-1/2 h-[200px] w-[400px] -translate-x-1/2 rounded-full bg-emerald-500/[0.04] blur-[80px]" />

                <div className="relative z-10">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                    <DollarSign size={10} />
                    Total Revenue (MTD)
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[48px] font-semibold tracking-tighter text-white">
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

                {/* Revenue chart */}
                <div className="relative mt-4">
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.20" />
                        <stop offset="60%" stopColor="#10B981" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Faint horizontal guides */}
                    {[0.25, 0.5, 0.75].map((ratio) => (
                      <line
                        key={ratio}
                        x1={pad}
                        y1={chartH - pad - ratio * (chartH - pad * 2)}
                        x2={chartW - pad}
                        y2={chartH - pad - ratio * (chartH - pad * 2)}
                        stroke="rgba(255,255,255,0.03)"
                        strokeWidth="1"
                      />
                    ))}
                    {/* Area gradient */}
                    {areaPath && (
                      <motion.path
                        d={areaPath}
                        fill="url(#rev-grad)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.2 }}
                      />
                    )}
                    {/* Line — 3px thick */}
                    {linePath && (
                      <motion.path
                        d={linePath}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    )}
                    {/* Hover zones + crosshair */}
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
                            <line
                              x1={pad} y1={p.y} x2={chartW - pad} y2={p.y}
                              stroke="rgba(255,255,255,0.03)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                            <circle cx={p.x} cy={p.y} r={5} fill="#10B981" stroke="#050505" strokeWidth="2.5" />
                            <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="#10B981" strokeWidth="1" opacity="0.3" />
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
                        className="pointer-events-none absolute z-10 rounded-xl border border-white/[0.06] bg-[#0A0A0A]/95 px-4 py-2.5 shadow-xl backdrop-blur-xl"
                        style={{
                          left: `${(chartPoints[hoveredPoint].x / chartW) * 100}%`,
                          top: -12,
                          transform: "translateX(-50%)",
                        }}
                      >
                        <div className="text-[11px] text-zinc-400">
                          {dailyRevenue[hoveredPoint].date}
                        </div>
                        <div className="font-mono text-[15px] font-semibold text-emerald-400">
                          ${dailyRevenue[hoveredPoint].amount.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-zinc-600">
                          {dailyRevenue[hoveredPoint].invoiceCount} invoice{dailyRevenue[hoveredPoint].invoiceCount !== 1 ? "s" : ""} paid
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* X-axis */}
                  <div className="mt-1 flex justify-between px-1">
                    {dailyRevenue.length > 0 && (
                      <>
                        <span className="font-mono text-[9px] text-zinc-700">{dailyRevenue[0]?.date}</span>
                        {dailyRevenue.length > 4 && (
                          <span className="font-mono text-[9px] text-zinc-700">{dailyRevenue[Math.floor(dailyRevenue.length / 2)]?.date}</span>
                        )}
                        <span className="font-mono text-[9px] text-zinc-700">{dailyRevenue[dailyRevenue.length - 1]?.date}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Metric Cards ────────────────────────────── */}
              <div className="grid grid-cols-3 gap-4 p-6">
                {/* Stripe Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="group rounded-xl bg-zinc-900/30 p-5 transition-all duration-300 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                    <CreditCard size={11} className="transition-colors duration-200 group-hover:text-zinc-400" />
                    Stripe Balance
                  </div>
                  <div className="mb-1 font-mono text-[28px] font-semibold tracking-tight text-white">
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
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  onClick={() => { if (totalOverdue > 0) { setActiveTab("invoices"); } }}
                  className={`group rounded-xl bg-zinc-900/30 p-5 transition-all duration-300 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${totalOverdue > 0 ? "cursor-pointer animate-overdue-pulse" : ""}`}
                >
                  <div className={`mb-3 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase ${totalOverdue > 0 ? "text-rose-400/70" : "text-zinc-600"}`}>
                    <AlertTriangle size={11} />
                    Overdue
                  </div>
                  <div className={`mb-1 font-mono text-[28px] font-semibold tracking-tight ${totalOverdue > 0 ? "text-rose-400" : "text-zinc-500"}`}>
                    <AnimatedNumber value={totalOverdue} />
                  </div>
                  <div className="space-y-1.5">
                    {overdueInvoices.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/finance/invoices/${inv.id}`); }}
                        className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-rose-500/[0.04]"
                      >
                        <div>
                          <span className="font-mono text-[10px] text-zinc-600">{inv.id}</span>
                          <span className="ml-2 text-[10px] text-zinc-500">{inv.clientName}</span>
                        </div>
                        <span className="font-mono text-[10px] font-medium text-rose-400">
                          ${inv.total.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {overdueInvoices.length > 0 && (
                      <button className="mt-1 text-[10px] text-zinc-600 transition-colors hover:text-rose-400">
                        Send Reminders →
                      </button>
                    )}
                  </div>
                </motion.div>

                {/* Avg Payout Time */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="group rounded-xl bg-zinc-900/30 p-5 transition-all duration-300 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                >
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                    <Clock size={11} />
                    Avg Payout Time
                  </div>
                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="font-mono text-[28px] font-semibold tracking-tight text-white">{avgPayoutDays}</span>
                    <span className="text-[12px] text-zinc-600">days</span>
                  </div>
                  <div className="mb-3 text-[11px] text-zinc-600">Days to payment</div>
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

              {/* ── Recent Activity (Ledger preview) ───────── */}
              <div className="px-6 pb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab("invoices")}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-emerald-400"
                  >
                    View all <ArrowRight size={9} />
                  </button>
                </div>

                {/* Column sub-header */}
                <div className="mb-1 flex items-center px-3 py-1">
                  <div className="w-20 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">Status</div>
                  <div className="w-20 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">ID</div>
                  <div className="flex-1 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">Client</div>
                  <div className="w-24 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">Date</div>
                  <div className="w-24 text-right text-[9px] font-bold tracking-widest text-zinc-700 uppercase">Amount</div>
                  <div className="w-6" />
                </div>

                <div className="space-y-0">
                  {invoices.slice(0, 6).map((inv, i) => {
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
                        {/* Status pill */}
                        <div className="w-20">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`h-1 w-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <span className="w-20 font-mono text-[11px] text-zinc-600">{inv.id}</span>
                        <span className="flex-1 text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">{inv.clientName}</span>
                        <span className="w-24 font-mono text-[11px] text-zinc-600">{inv.issueDate}</span>
                        <span className="w-24 text-right font-mono text-[12px] font-medium text-zinc-200">
                          ${inv.total.toLocaleString()}
                        </span>
                        <div className="w-6 text-right">
                          <ArrowRight size={10} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════ INVOICES TAB ══════════════════════ */}
          {activeTab === "invoices" && (
            <motion.div
              key="invoices"
              custom={tabDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Column headers */}
              <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-5 py-1.5">
                <div className="w-20 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                <div className="w-24 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Invoice</div>
                <div className="w-24 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
                <div className="min-w-0 flex-1 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Client</div>
                <div className="w-28 px-2 text-right text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Amount</div>
                <div className="w-20" />
              </div>

              <div className="flex-1">
                {filteredInvoices.length === 0 && !loading ? (
                  <LedgerEmptyState
                    title="The ledger is empty"
                    subtitle={search ? "Try a different search term." : "Start earning."}
                    cta={!search ? "Create First Invoice" : undefined}
                    onCta={!search ? () => router.push("/dashboard/finance/invoices/new") : undefined}
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
                        transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => {
                          setFocusedIndex(i);
                          router.push(`/dashboard/finance/invoices/${inv.id}`);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ open: true, x: e.clientX, y: e.clientY, invoiceId: inv.id });
                        }}
                        className={`group relative flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 ${
                          isFocused ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"
                        }`}
                        style={{ height: 48 }}
                      >
                        {isFocused && (
                          <motion.div
                            layoutId="invoice-focus-spine"
                            className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-emerald-500"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        {/* Status pill */}
                        <div className="w-20 px-2">
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`h-1 w-1 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="w-24 px-2 font-mono text-[11px] text-zinc-500 transition-colors group-hover:text-zinc-400">{inv.id}</div>
                        <div className="w-24 px-2 font-mono text-[11px] text-zinc-600">{inv.issueDate}</div>
                        <div className="min-w-0 flex-1 px-2 text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">{inv.clientName}</div>
                        <div className="w-28 px-2 text-right font-mono text-[12px] font-medium text-white">
                          ${inv.total.toLocaleString()}
                        </div>
                        {/* Hover actions */}
                        <div className="flex w-20 items-center justify-end gap-0.5 px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/finance/invoices/${inv.id}`); }}
                            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                            title="View"
                          >
                            <Eye size={11} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                            title="Download PDF"
                          >
                            <Download size={11} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════ QUOTES TAB ════════════════════════ */}
          {activeTab === "quotes" && (
            <motion.div
              key="quotes"
              custom={tabDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-5 py-1.5">
                <div className="w-20 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                <div className="w-24 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Quote</div>
                <div className="min-w-0 flex-1 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Client</div>
                <div className="w-28 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Valid Until</div>
                <div className="w-28 px-2 text-right text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Amount</div>
                <div className="w-8" />
              </div>

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
                      const qStatusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
                        draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10" },
                        sent: { label: "Sent", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/10" },
                        viewed: { label: "Viewed", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10" },
                        accepted: { label: "Approved", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10" },
                        rejected: { label: "Declined", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/10" },
                        expired: { label: "Expired", dot: "bg-zinc-600", text: "text-zinc-600", bg: "bg-zinc-600/10" },
                      };
                      const sc = qStatusConfig[q.status] || qStatusConfig.draft;

                      return (
                        <motion.div
                          key={q.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => router.push(`/dashboard/finance/quotes/${q.id}`)}
                          className="group flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 hover:bg-white/[0.02]"
                          style={{ height: 48 }}
                        >
                          <div className="w-20 px-2">
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${sc.bg} ${sc.text}`}>
                              <span className={`h-1 w-1 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <div className="w-24 px-2 font-mono text-[11px] text-zinc-500">{q.display_id}</div>
                          <div className="min-w-0 flex-1 px-2 text-[12px] font-medium text-zinc-300 group-hover:text-white">{q.client_name || "—"}</div>
                          <div className="w-28 px-2 font-mono text-[11px] text-zinc-600">
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

          {/* ══════════════ PAYOUTS TAB ═══════════════════════ */}
          {activeTab === "payouts" && (
            <motion.div
              key="payouts"
              custom={tabDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="p-6"
            >
              <div className="mb-4 flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
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
                      className="overflow-hidden rounded-xl bg-zinc-900/30 transition-all duration-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
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
                          <div className="font-mono text-[11px] text-zinc-600">{payout.date}</div>
                        </div>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${psColor}`}>
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
                            className="border-t border-white/[0.03]"
                          >
                            <div className="px-5 py-3">
                              <div className="mb-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
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
          {/* ══════════════ iWORKR PAY TAB ═══════════════════ */}
          {activeTab === "payments" && (
            <motion.div
              key="payments"
              custom={tabDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <ConnectPaymentsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

/* ═══════════════════════════════════════════════════════════
 * ── iWorkr Pay (Stripe Connect) Tab ──────────────────────
 * ═══════════════════════════════════════════════════════════ */

function ConnectPaymentsTab() {
  const org = useOrg();
  const toast = useToastStore();
  const [loading, setLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState<{
    stripe_account_id: string | null;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    connect_onboarded_at: string | null;
  }>({ stripe_account_id: null, charges_enabled: false, payouts_enabled: false, connect_onboarded_at: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [recentPayments, setRecentPayments] = useState<{
    id: string;
    amount_cents: number;
    currency: string;
    status: string;
    payment_method: string;
    client_name: string;
    created_at: string;
  }[]>([]);

  useEffect(() => {
    loadConnectStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.orgId]);

  async function loadConnectStatus() {
    if (!org?.orgId) return;
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", org.orgId)
        .single();
      if (data) {
        const s = (data.settings as Record<string, unknown>) ?? {};
        setConnectStatus({
          stripe_account_id: (s.stripe_account_id as string) || null,
          charges_enabled: (s.charges_enabled as boolean) || false,
          payouts_enabled: (s.payouts_enabled as boolean) || false,
          connect_onboarded_at: (s.connect_onboarded_at as string) || null,
        });

        if (s.charges_enabled) {
          const { data: payments } = await (supabase as any)
            .from("payments")
            .select("id, amount_cents, currency, status, payment_method, client_name, created_at")
            .eq("organization_id", org.orgId)
            .order("created_at", { ascending: false })
            .limit(20);
          if (payments) setRecentPayments(payments);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleSetupConnect() {
    if (!org?.orgId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.orgId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.addToast("Failed to start setup");
    } catch {
      toast.addToast("Something went wrong");
    }
    setActionLoading(false);
  }

  async function handleOpenDashboard() {
    if (!org?.orgId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.orgId }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else toast.addToast("Failed to open dashboard");
    } catch {
      toast.addToast("Something went wrong");
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (!connectStatus.charges_enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
          <div className="relative w-20 h-20 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center">
            <Zap className="w-9 h-9 text-emerald-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight mb-2">Get paid 3× faster with iWorkr Pay</h2>
        <p className="text-[13px] text-zinc-500 text-center max-w-md mb-2 leading-relaxed">
          Accept credit cards, Apple Pay, and Google Pay directly from your invoices and in the field via Tap-to-Pay.
          Funds land in your bank account in 2 business days.
        </p>
        <p className="text-[11px] text-zinc-700 text-center max-w-sm mb-8">
          Standard processing fees apply (2.9% + 30¢). iWorkr charges a 1% platform fee.
        </p>

        <div className="grid grid-cols-3 gap-3 max-w-md w-full mb-10">
          {[
            { icon: <CreditCard size={16} />, label: "Web Invoices", sub: "Clients pay via link" },
            { icon: <Wallet size={16} />, label: "Tap-to-Pay", sub: "NFC field payments" },
            { icon: <Shield size={16} />, label: "PCI Compliant", sub: "Stripe handles cards" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-zinc-950 border border-white/5 p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                {item.icon}
              </div>
              <div className="text-[11px] font-medium text-zinc-300">{item.label}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{item.sub}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSetupConnect}
          disabled={actionLoading}
          className="px-8 py-3 bg-white text-black font-semibold text-sm rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-30 flex items-center gap-2"
        >
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          Setup Payments
        </button>

        {connectStatus.stripe_account_id && !connectStatus.charges_enabled && (
          <p className="text-[11px] text-amber-400 mt-4">
            Onboarding in progress — complete your verification to start accepting payments.
          </p>
        )}
      </div>
    );
  }

  const totalCollected = recentPayments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[13px] text-emerald-400 font-medium">iWorkr Pay Active</span>
          {connectStatus.connect_onboarded_at && (
            <span className="text-[10px] text-zinc-600">
              Since {new Date(connectStatus.connect_onboarded_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={handleOpenDashboard}
          disabled={actionLoading}
          className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white transition-colors"
        >
          {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
          Stripe Dashboard
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-zinc-950 border border-white/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1">Collected</div>
          <div className="font-mono text-xl font-bold text-white">
            ${(totalCollected / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-white/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1">Transactions</div>
          <div className="font-mono text-xl font-bold text-white">
            {recentPayments.filter((p) => p.status === "succeeded").length}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-white/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1">Payouts</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connectStatus.payouts_enabled ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className="text-sm text-zinc-300">{connectStatus.payouts_enabled ? "Enabled" : "Pending"}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent Transactions</h3>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-white/5 overflow-hidden divide-y divide-white/[0.03]">
          {recentPayments.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-600">No transactions yet</p>
              <p className="text-[11px] text-zinc-700 mt-1">Payments will appear here as clients pay your invoices.</p>
            </div>
          )}
          {recentPayments.map((payment) => {
            const statusColor = payment.status === "succeeded"
              ? "text-emerald-400 bg-emerald-500/10"
              : payment.status === "failed"
                ? "text-rose-400 bg-rose-500/10"
                : "text-zinc-400 bg-zinc-500/10";
            return (
              <div key={payment.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  {payment.payment_method === "tap_to_pay" ? (
                    <CreditCard size={14} className="text-zinc-400" />
                  ) : (
                    <FileText size={14} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zinc-300 truncate">{payment.client_name || "—"}</div>
                  <div className="text-[11px] text-zinc-600">{new Date(payment.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                  {payment.status}
                </span>
                <span className="font-mono text-[14px] font-semibold text-white">
                  ${(payment.amount_cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
