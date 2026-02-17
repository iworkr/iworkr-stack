"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  Loader2,
  Plus,
  ScanBarcode,
  TrendingUp,
  ArrowRight,
  X,
  Cog,
  MapPin,
  Box,
} from "lucide-react";
import { useMemo, useState, useCallback, useRef } from "react";
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

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: AssetsTab; label: string; icon: typeof Truck }[] = [
  { id: "fleet", label: "Fleet & Tools", icon: Truck },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "audits", label: "ClipboardList", icon: ClipboardList },
];

/* ── Mini Sparkline ──────────────────────────────────── */

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

/* ── Lottie-style Empty State ────────────────────────── */

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
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        {/* Wireframe crate rings */}
        <div className="absolute inset-0 rounded-2xl border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-xl border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.6s" }} />
        {/* Scanning line */}
        <motion.div
          className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          animate={{ top: ["20%", "80%", "20%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Orbit particle */}
        <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Icon size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[260px] text-[12px] text-zinc-600">{subtitle}</p>
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

/* ── Scanning Loader ─────────────────────────────────── */

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

/* ── Category Icons ──────────────────────────────────── */

const categoryIconMap: Record<string, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

/* ── Status Config ───────────────────────────────────── */

const statusConfig = {
  available: { dot: "bg-emerald-500", label: "Available", text: "text-zinc-500" },
  assigned: { dot: "bg-emerald-400", label: "Assigned", text: "text-zinc-500" },
  maintenance: { dot: "bg-rose-500", label: "Maintenance", text: "text-rose-400" },
};

/* ── Page ─────────────────────────────────────────────── */

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

  /* ── Drawer / Modal / Scanner State ──────────────────── */
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"asset" | "stock" | null>(null);
  const [prefillSerial, setPrefillSerial] = useState("");
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const [prefillName, setPrefillName] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const handleNewItem = () => {
    if (activeTab === "inventory") {
      setStockModalOpen(true);
    } else {
      setAssetDrawerOpen(true);
    }
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

  /* ── Stats (Dynamic from DB) ────────────────────────── */
  const totalValue = useMemo(
    () => assets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0),
    [assets]
  );
  const lowStockCount = useMemo(
    () => stock.filter((s) => s.currentQty <= s.minLevel).length,
    [stock]
  );
  const maintenanceCount = useMemo(
    () => assets.filter((a) => a.status === "maintenance").length,
    [assets]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.assignee && a.assignee.toLowerCase().includes(q))
    );
  }, [assets, searchQuery]);

  const filteredStock = useMemo(() => {
    if (!searchQuery) return stock;
    const q = searchQuery.toLowerCase();
    return stock.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sku.toLowerCase().includes(q) ||
        s.supplier.toLowerCase().includes(q)
    );
  }, [stock, searchQuery]);

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

  /* ── Sparkline mock data ────────────────────────────── */
  const valueSparkData = useMemo(() => [180, 195, 200, 210, 215, 220, totalValue / 1000], [totalValue]);

  /* ── Tab transition direction ───────────────────────── */
  const tabOrder: AssetsTab[] = ["fleet", "inventory", "audits"];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-white/[0.05]">
        {/* Title row */}
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-medium text-white">Assets & Inventory</h1>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {assets.length} assets
            </span>
            {lowStockCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400">
                <AlertTriangle size={9} />
                {lowStockCount} low stock
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search toggle */}
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setShowSearch(false); } }}
                      placeholder="Search assets…"
                      className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-zinc-600 hover:text-zinc-400">
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

            {/* Scan button */}
            <button
              onClick={() => handleScanOpen(activeTab === "inventory" ? "stock" : "asset")}
              className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2.5 text-[11px] text-zinc-500 transition-all duration-150 hover:border-emerald-500/20 hover:text-emerald-400"
            >
              <ScanBarcode size={13} />
              <span className="hidden sm:inline">Scan</span>
            </button>

            {/* View toggle (fleet only) */}
            {activeTab === "fleet" && (
              <div className="flex rounded-md border border-white/[0.06] bg-zinc-900/30">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-l-md px-2 py-1 transition-colors duration-150 ${
                    viewMode === "grid"
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <Grid3X3 size={13} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-r-md px-2 py-1 transition-colors duration-150 ${
                    viewMode === "list"
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  <List size={13} />
                </button>
              </div>
            )}

            {/* New Item — Ghost button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleNewItem}
              className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 text-[11px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <Plus size={13} strokeWidth={2.5} />
              New Item
            </motion.button>
          </div>
        </div>

        {/* ── Header Metrics: Glass Cards ──────────────── */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-4">
          {/* Total Value */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-zinc-900/40 px-4 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <DollarSign size={13} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Total Value</div>
              <div className="text-[16px] font-semibold tracking-tight text-white">
                ${(totalValue / 1000).toFixed(0)}k
              </div>
            </div>
            <Sparkline data={valueSparkData} color="#10B981" width={52} height={18} />
          </motion.div>

          {/* Low Stock */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-zinc-900/40 px-4 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <AlertTriangle size={13} className={`transition-colors ${lowStockCount > 0 ? "text-rose-400" : "text-zinc-600"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Low Stock</div>
              <div className={`text-[16px] font-semibold tracking-tight ${lowStockCount > 0 ? "text-rose-400" : "text-zinc-400"}`}>
                {lowStockCount}
              </div>
            </div>
            {lowStockCount > 0 && (
              <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-medium text-rose-400">
                Alert
              </span>
            )}
          </motion.div>

          {/* In Maintenance */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-zinc-900/40 px-4 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <Wrench size={13} className={`transition-colors ${maintenanceCount > 0 ? "text-amber-400" : "text-zinc-600"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Maintenance</div>
              <div className={`text-[16px] font-semibold tracking-tight ${maintenanceCount > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                {maintenanceCount}
              </div>
            </div>
            {maintenanceCount > 0 && (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
                Active
              </span>
            )}
          </motion.div>
        </div>

        {/* ── Tabs (Emerald underline) ─────────────────── */}
        <div className="flex gap-0.5 px-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-[12px] transition-colors duration-150 ${
                  isActive ? "font-medium text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {tab.id === "audits" ? "Audits" : tab.label}
                {isActive && (
                  <motion.div
                    layoutId="assets-tab-indicator"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ScanningLoader />
        ) : (
          <AnimatePresence mode="wait">
            {/* ── FLEET TAB ──────────────────────────────── */}
            {activeTab === "fleet" && (
              <motion.div
                key="fleet"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {filteredAssets.length === 0 ? (
                  <DepotEmptyState
                    icon={Truck}
                    title="The depot is empty"
                    subtitle={searchQuery ? "No assets match your search." : "Assets will appear here once added."}
                    cta={!searchQuery ? "Add First Asset" : undefined}
                    onCta={!searchQuery ? () => setAssetDrawerOpen(true) : undefined}
                  />
                ) : viewMode === "grid" ? (
                  <FleetGrid assets={filteredAssets} />
                ) : (
                  <FleetListView assets={filteredAssets} />
                )}
              </motion.div>
            )}

            {/* ── INVENTORY TAB ──────────────────────────── */}
            {activeTab === "inventory" && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5"
              >
                {filteredStock.length === 0 ? (
                  <DepotEmptyState
                    icon={Package}
                    title="Inventory is clear"
                    subtitle={searchQuery ? "No items match your search." : "Stock items will appear here once added."}
                    cta={!searchQuery ? "Add First Item" : undefined}
                    onCta={!searchQuery ? () => setStockModalOpen(true) : undefined}
                  />
                ) : (
                  <InventoryTable items={filteredStock} />
                )}
              </motion.div>
            )}

            {/* ── AUDITS TAB ────────────────────────────── */}
            {activeTab === "audits" && (
              <motion.div
                key="audits"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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

      {/* ── Drawers / Modals / Scanner ─────────────────── */}
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

/* ── Fleet List View (High-Density Table) ────────────── */

import { type Asset } from "@/lib/assets-data";

function FleetListView({ assets }: { assets: Asset[] }) {
  const router = useRouter();

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-4 py-1.5 rounded-t-lg">
        <div className="w-8" />
        <div className="w-20 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Tag</div>
        <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Name</div>
        <div className="w-20 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Status</div>
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Assignee</div>
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Location</div>
        <div className="w-16 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Service</div>
        <div className="w-8" />
      </div>

      {/* Rows */}
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
              style={{ height: 40 }}
            >
              {/* Category Icon */}
              <div className="w-8">
                <CatIcon size={14} strokeWidth={1.2} className="text-zinc-700 transition-colors group-hover:text-zinc-500" />
              </div>
              {/* Tag */}
              <div className="w-20 px-2 font-mono text-[10px] text-zinc-600">{asset.tag}</div>
              {/* Name */}
              <div className="min-w-0 flex-1 px-2 truncate text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">
                {asset.name}
              </div>
              {/* Status pip */}
              <div className="w-20 px-2 flex items-center gap-1.5">
                <span className={`inline-block h-[6px] w-[6px] rounded-full ${status.dot}`} />
                <span className={`text-[10px] ${status.text}`}>{status.label}</span>
              </div>
              {/* Assignee */}
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
              {/* Location */}
              <div className="w-28 px-2 truncate text-[10px] text-zinc-600">
                {asset.location || "—"}
              </div>
              {/* Service bar */}
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
              {/* Arrow */}
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
