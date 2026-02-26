"use client";

import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from "framer-motion";
import {
  Truck,
  Package,
  ClipboardList,
  Grid3X3,
  List,
  Search,
  DollarSign,
  AlertTriangle,
  Wrench,
  Plus,
  ScanBarcode,
  TrendingUp,
  ArrowRight,
  Cog,
  Box,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAssetsStore, type AssetsTab, type ViewMode } from "@/lib/assets-store";
import { useAuthStore } from "@/lib/auth-store";
import { FleetGrid } from "@/components/assets/fleet-grid";
import { InventoryTable } from "@/components/assets/inventory-table";
import { AuditLog } from "@/components/assets/audit-log";
import { AssetDrawer } from "@/components/assets/asset-drawer";
import { StockModal } from "@/components/assets/stock-modal";
import { ScannerOverlay } from "@/components/assets/scanner-overlay";
import { scanLookup } from "@/app/actions/assets";
import { type Asset } from "@/lib/assets-data";

/* ── Tab Config ─────────────────────────────────────────── */

const tabs: { id: AssetsTab; label: string; icon: typeof Truck }[] = [
  { id: "fleet", label: "Fleet & Tools", icon: Truck },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "audits", label: "Audits", icon: ClipboardList },
];

/* ── Animated Counter ───────────────────────────────────── */

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

/* ── Mini Sparkline ─────────────────────────────────────── */

function Sparkline({ data, color = "#10B981", width = 64, height = 20 }: { data: number[]; color?: string; width?: number; height?: number }) {
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
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
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
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <polygon
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
    </svg>
  );
}

/* ── Empty State ────────────────────────────────────────── */

function DepotEmptyState({
  icon: Icon,
  title,
  subtitle,
  cta,
  onCta,
}: {
  icon: typeof Truck;
  title: string;
  subtitle: string;
  cta?: string;
  onCta?: () => void;
}) {
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
          <div className="absolute inset-0 rounded-2xl border border-white/[0.04] animate-signal-pulse" />
          <div className="absolute inset-2 rounded-xl border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.6s" }} />
          <motion.div
            className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
            animate={{ top: ["20%", "80%", "20%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Icon size={16} strokeWidth={1.5} className="text-zinc-600" />
          </div>
        </div>
      </motion.div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[260px] text-[12px] text-zinc-600">{subtitle}</p>
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-none transition-all duration-200 hover:bg-emerald-500"
        >
          <Plus size={12} />
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Scanning Loader ────────────────────────────────────── */

function ScanningLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Box size={20} strokeWidth={1} className="text-zinc-700" />
        <motion.div
          className="absolute inset-x-1 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"
          animate={{ top: ["15%", "85%", "15%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="text-[12px] text-zinc-600">Scanning depot…</p>
    </div>
  );
}

/* ── Status Config ──────────────────────────────────────── */

const statusConfig: Record<string, { dot: string; label: string; text: string; bg: string }> = {
  available: { dot: "bg-emerald-500", label: "Available", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  assigned: { dot: "bg-sky-400", label: "On Job", text: "text-sky-400", bg: "bg-sky-500/10" },
  maintenance: { dot: "bg-rose-500", label: "Broken", text: "text-rose-400", bg: "bg-rose-500/10" },
};

const categoryIconMap: Record<string, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

/* ── Page ───────────────────────────────────────────────── */

export default function AssetsPage() {
  const router = useRouter();
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;
  const {
    assets,
    stock,
    auditLog,
    overview,
    activeTab,
    viewMode,
    searchQuery,
    loading,
    setActiveTab,
    setViewMode,
    setSearchQuery,
  } = useAssetsStore();

  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"asset" | "stock" | null>(null);
  const [prefillSerial, setPrefillSerial] = useState("");
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [kpiFilter, setKpiFilter] = useState<"all" | "low_stock" | "maintenance">("all");

  const handleNewItem = () => {
    if (activeTab === "inventory") setStockModalOpen(true);
    else setAssetDrawerOpen(true);
  };

  const handleScanOpen = (target: "asset" | "stock") => {
    setScanTarget(target);
    setScannerOpen(true);
  };

  const handleScanResult = useCallback(async (code: string) => {
    setScannerOpen(false);
    if (!orgId) return;
    const result = await scanLookup(orgId, code);
    if (result.data) {
      if (result.data.type === "asset") {
        router.push(`/dashboard/assets/${result.data.item.id}`);
      } else if (result.data.type === "stock") {
        setActiveTab("inventory");
        setSearchQuery(result.data.item.name || code);
      } else {
        if (scanTarget === "stock" || activeTab === "inventory") {
          setPrefillBarcode(code);
          setPrefillName("");
          setStockModalOpen(true);
        } else {
          setPrefillSerial(code);
          setAssetDrawerOpen(true);
        }
      }
    }
  }, [orgId, scanTarget, activeTab, router, setActiveTab, setSearchQuery]);

  /* ── Keyboard ──────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        handleScanOpen(activeTab === "inventory" ? "stock" : "asset");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab]);

  /* ── Stats ─────────────────────────────────────────────── */
  const totalValue = useMemo(() => assets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0), [assets]);
  const lowStockCount = useMemo(() => stock.filter((s) => s.currentQty <= s.minLevel).length, [stock]);
  const maintenanceCount = useMemo(() => assets.filter((a) => a.status === "maintenance").length, [assets]);

  /* ── Filtering ─────────────────────────────────────────── */
  const filteredAssets = useMemo(() => {
    let list = assets;
    if (kpiFilter === "maintenance") list = list.filter((a) => a.status === "maintenance");
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.assignee && a.assignee.toLowerCase().includes(q))
    );
  }, [assets, searchQuery, kpiFilter]);

  const filteredStock = useMemo(() => {
    let list = stock;
    if (kpiFilter === "low_stock") list = list.filter((s) => s.currentQty <= s.minLevel);
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        s.supplier.toLowerCase().includes(q)
    );
  }, [stock, searchQuery, kpiFilter]);

  const filteredAudit = useMemo(() => {
    if (!searchQuery) return auditLog;
    const q = searchQuery.toLowerCase();
    return auditLog.filter(
      (e) =>
        e.assetName.toLowerCase().includes(q) ||
        e.assetTag.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [auditLog, searchQuery]);

  const valueSparkData = useMemo(() => [180, 195, 200, 210, 215, 220, totalValue / 1000], [totalValue]);

  /* ── Tab direction ─────────────────────────────────────── */
  const tabOrder: AssetsTab[] = ["fleet", "inventory", "audits"];
  const prevTabRef = useRef(activeTab);
  const [tabDir, setTabDir] = useState<"left" | "right">("right");

  useEffect(() => {
    const prevIdx = tabOrder.indexOf(prevTabRef.current);
    const nextIdx = tabOrder.indexOf(activeTab);
    setTabDir(nextIdx >= prevIdx ? "right" : "left");
    prevTabRef.current = activeTab;
  }, [activeTab]);

  const slideVariants = {
    enter: (dir: "left" | "right") => ({ opacity: 0, x: dir === "right" ? 16 : -16 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: "left" | "right") => ({ opacity: 0, x: dir === "right" ? -16 : 16 }),
  };

  /* ── KPI click handlers ────────────────────────────────── */
  const handleLowStockClick = () => {
    if (kpiFilter === "low_stock") {
      setKpiFilter("all");
    } else {
      setKpiFilter("low_stock");
      setActiveTab("inventory");
    }
  };

  const handleMaintenanceClick = () => {
    if (kpiFilter === "maintenance") {
      setKpiFilter("all");
    } else {
      setKpiFilter("maintenance");
      setActiveTab("fleet");
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRightIcon size={10} className="text-zinc-700" />
              <span className="font-medium text-white">Assets</span>
            </div>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {assets.length} assets
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stealth Search */}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search serial #, tag..."
                  className="w-36 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !searchQuery && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>

            {/* Scan */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleScanOpen(activeTab === "inventory" ? "stock" : "asset")}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-zinc-500 transition-all duration-200 hover:bg-emerald-500/[0.06] hover:text-emerald-400"
            >
              <ScanBarcode size={14} />
              <span className="hidden sm:inline">Scan</span>
            </motion.button>

            {/* View toggle (fleet only) */}
            {activeTab === "fleet" && (
              <div className="flex rounded-lg bg-white/[0.03]">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-l-lg px-2 py-1 transition-all duration-150 ${
                    viewMode === "grid"
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <Grid3X3 size={13} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-r-lg px-2 py-1 transition-all duration-150 ${
                    viewMode === "list"
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <List size={13} />
                </button>
              </div>
            )}

            {/* New Item */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleNewItem}
              className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white shadow-none transition-all duration-200 hover:bg-emerald-500"
            >
              <Plus size={13} strokeWidth={2.5} />
              New Item
            </motion.button>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {/* Total Value */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="group flex items-center gap-3 rounded-xl bg-zinc-900/30 px-4 py-3 transition-all duration-200 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <DollarSign size={14} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Total Value</div>
              <div className="font-mono text-[18px] font-semibold tracking-tight text-emerald-400">
                <AnimatedNumber value={totalValue} />
              </div>
            </div>
            <Sparkline data={valueSparkData} color="#10B981" width={56} height={20} />
          </motion.div>

          {/* Low Stock */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            onClick={handleLowStockClick}
            className={`group flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-900/30 px-4 py-3 transition-all duration-200 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${
              lowStockCount > 0 ? "animate-lowstock-pulse" : ""
            } ${kpiFilter === "low_stock" ? "ring-1 ring-amber-500/30" : ""}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <AlertTriangle size={14} className={`transition-colors ${lowStockCount > 0 ? "text-amber-500" : "text-zinc-600"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Low Stock</div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-[18px] font-semibold tracking-tight ${lowStockCount > 0 ? "text-amber-500" : "text-zinc-400"}`}>
                  {lowStockCount}
                </span>
                <span className="text-[10px] text-zinc-600">items</span>
              </div>
            </div>
            {lowStockCount > 0 && (
              <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
                Alert
              </span>
            )}
          </motion.div>

          {/* Maintenance */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            onClick={handleMaintenanceClick}
            className={`group flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-900/30 px-4 py-3 transition-all duration-200 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${
              kpiFilter === "maintenance" ? "ring-1 ring-rose-500/30" : ""
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Wrench size={14} className={`transition-colors ${maintenanceCount > 0 ? "text-rose-400" : "text-zinc-600"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Maintenance</div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-[18px] font-semibold tracking-tight ${maintenanceCount > 0 ? "text-rose-400" : "text-zinc-400"}`}>
                  {maintenanceCount}
                </span>
                <span className="text-[10px] text-zinc-600">units</span>
              </div>
            </div>
            {maintenanceCount > 0 && (
              <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-medium text-rose-400">
                Active
              </span>
            )}
          </motion.div>
        </div>

        {/* ── Tabs (Sliding Pill) ────────────────────────── */}
        <div className="flex gap-0.5 px-5 pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setKpiFilter("all"); }}
                className={`relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[12px] transition-colors duration-150 ${
                  isActive ? "font-medium text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="assets-tab-pill"
                    className="absolute inset-0 rounded-md bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon size={13} strokeWidth={1.5} />
                  {tab.label}
                </span>
              </button>
            );
          })}
          {kpiFilter !== "all" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setKpiFilter("all")}
              className="ml-2 flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            >
              Filtered: {kpiFilter === "low_stock" ? "Low Stock" : "Maintenance"}
              <span className="ml-1 text-zinc-600">✕</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading ? (
          <ScanningLoader />
        ) : (
          <AnimatePresence mode="wait" custom={tabDir}>
            {/* FLEET TAB */}
            {activeTab === "fleet" && (
              <motion.div
                key="fleet"
                custom={tabDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {filteredAssets.length === 0 ? (
                  <DepotEmptyState
                    icon={Truck}
                    title={kpiFilter === "maintenance" ? "No assets in maintenance" : "The depot is empty"}
                    subtitle={searchQuery ? "No assets match your search." : kpiFilter === "maintenance" ? "All assets are operational." : "Assets will appear here once added."}
                    cta={!searchQuery && kpiFilter === "all" ? "Add First Asset" : undefined}
                    onCta={!searchQuery && kpiFilter === "all" ? () => setAssetDrawerOpen(true) : undefined}
                  />
                ) : viewMode === "grid" ? (
                  <FleetGrid assets={filteredAssets} />
                ) : (
                  <FleetListView assets={filteredAssets} />
                )}
              </motion.div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === "inventory" && (
              <motion.div
                key="inventory"
                custom={tabDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {filteredStock.length === 0 ? (
                  <DepotEmptyState
                    icon={Package}
                    title={kpiFilter === "low_stock" ? "No low stock items" : "Inventory is clear"}
                    subtitle={searchQuery ? "No items match your search." : kpiFilter === "low_stock" ? "All stock levels are healthy." : "Stock items will appear here once added."}
                    cta={!searchQuery && kpiFilter === "all" ? "Add First Item" : undefined}
                    onCta={!searchQuery && kpiFilter === "all" ? () => setStockModalOpen(true) : undefined}
                  />
                ) : (
                  <InventoryTable items={filteredStock} />
                )}
              </motion.div>
            )}

            {/* AUDITS TAB */}
            {activeTab === "audits" && (
              <motion.div
                key="audits"
                custom={tabDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {filteredAudit.length === 0 ? (
                  <DepotEmptyState
                    icon={ClipboardList}
                    title="No audit entries"
                    subtitle="Activity will be logged automatically."
                  />
                ) : (
                  <AuditLog entries={filteredAudit} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── Drawers / Modals / Scanner ───────────────────── */}
      <AssetDrawer
        open={assetDrawerOpen}
        onClose={() => { setAssetDrawerOpen(false); setPrefillSerial(""); }}
        onScanRequest={() => handleScanOpen("asset")}
        prefillSerial={prefillSerial}
      />
      <StockModal
        open={stockModalOpen}
        onClose={() => { setStockModalOpen(false); setPrefillBarcode(""); setPrefillName(""); }}
        onScanRequest={() => handleScanOpen("stock")}
        prefillBarcode={prefillBarcode}
        prefillName={prefillName}
      />
      <ScannerOverlay
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />
    </div>
  );
}

/* ── Fleet List View ────────────────────────────────────── */

function FleetListView({ assets }: { assets: Asset[] }) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-4 py-1.5 rounded-t-xl">
        <div className="w-8" />
        <div className="w-20 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Tag</div>
        <div className="min-w-0 flex-1 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Name</div>
        <div className="w-24 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
        <div className="w-28 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Assignee</div>
        <div className="w-28 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Location</div>
        <div className="w-20 px-2 text-right text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Value</div>
        <div className="w-16 px-2 text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Service</div>
        <div className="w-8" />
      </div>

      <div>
        {assets.map((asset, i) => {
          const status = statusConfig[asset.status];
          const CatIcon = categoryIconMap[asset.category] || Cog;

          return (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
              className="group flex cursor-pointer items-center border-b border-white/[0.03] px-4 transition-colors duration-100 hover:bg-white/[0.02]"
              style={{ height: 48 }}
            >
              <div className="w-8">
                <CatIcon size={14} strokeWidth={1.2} className="text-zinc-700 transition-colors group-hover:text-zinc-500" />
              </div>
              <div className="w-20 px-2 font-mono text-[10px] text-zinc-600">{asset.tag}</div>
              <div className="min-w-0 flex-1 px-2 truncate text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">
                {asset.name}
              </div>
              {/* Status pill */}
              <div className="w-24 px-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${status.bg} ${status.text}`}>
                  <span className={`h-1 w-1 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
              <div className="w-28 px-2 flex items-center gap-1.5">
                {asset.assignee ? (
                  <>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-semibold text-zinc-400">
                      {asset.assigneeInitials || "?"}
                    </div>
                    <span className="truncate text-[10px] text-zinc-500">{asset.assignee.split(" ")[0]}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-700">—</span>
                )}
              </div>
              <div className="w-28 px-2 truncate text-[10px] text-zinc-600">{asset.location || "—"}</div>
              <div className="w-20 px-2 text-right font-mono text-[11px] text-zinc-400">
                ${asset.purchasePrice.toLocaleString()}
              </div>
              <div className="w-16 px-2">
                <div className="h-[3px] rounded-full bg-white/[0.04]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      asset.serviceDuePercent >= 90 ? "bg-rose-500" :
                      asset.serviceDuePercent >= 70 ? "bg-amber-500" :
                      "bg-emerald-500/60"
                    }`}
                    style={{ width: `${asset.serviceDuePercent}%` }}
                  />
                </div>
              </div>
              <div className="w-8 text-right">
                <ArrowRight size={11} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
