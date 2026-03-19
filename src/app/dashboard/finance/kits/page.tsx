"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Trash2, Edit2, Calculator, DollarSign,
  AlertTriangle, ChevronRight, Search, X, Layers, Send,
  CheckCircle2, TrendingUp, Percent
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getKits, createKit, deleteKit, getKitComponents, addKitComponent,
  deleteKitComponent, getKitMarginMath,
  type TradeKit, type KitComponent, type KitMarginMath,
} from "@/app/actions/forge-proposals";

/* ── Helpers ──────────────────────────────────────────── */

const fmt = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(v);

const pct = (v: number) => `${v.toFixed(1)}%`;

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } } as any;
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } as any;
const stagger = { animate: { transition: { staggerChildren: 0.04 } } } as any;

type Tab = "kits" | "builder" | "proposals";

const ITEM_TYPES = [
  { value: "INVENTORY_ITEM", label: "Material" },
  { value: "LABOR_RATE", label: "Labour" },
];

/* ── Page Component ───────────────────────────────────── */

export default function KitsPage() {
  const org = useOrg();
  const orgId = (org as any)?.orgId ?? (org as any)?.id;

  const [tab, setTab] = useState<Tab>("kits");
  const [kits, setKits] = useState<TradeKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Selected kit state
  const [selectedKit, setSelectedKit] = useState<TradeKit | null>(null);
  const [components, setComponents] = useState<KitComponent[]>([]);
  const [marginMath, setMarginMath] = useState<KitMarginMath | null>(null);
  const [compLoading, setCompLoading] = useState(false);

  // New kit form
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKit, setNewKit] = useState({ name: "", description: "", trade_category: "", target_margin_pct: 40 });
  const [newComp, setNewComp] = useState({ label: "", item_type: "INVENTORY_ITEM", quantity: 1, unit_cost: 0, sell_price: 0 });

  const loadKits = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await getKits(orgId);
    setKits(data ?? []);
    setLoading(false);
  }, [orgId]);

  const loadKitDetail = useCallback(async (kit: TradeKit) => {
    if (!orgId) return;
    setCompLoading(true);
    const [compRes, mathRes] = await Promise.all([
      getKitComponents(kit.id, orgId),
      getKitMarginMath(kit.id, orgId),
    ]);
    setComponents(compRes.data ?? []);
    setMarginMath(mathRes.data ?? null);
    setCompLoading(false);
  }, [orgId]);

  useEffect(() => { loadKits(); }, [loadKits]);

  useEffect(() => {
    if (selectedKit) loadKitDetail(selectedKit);
  }, [selectedKit, loadKitDetail]);

  const handleCreateKit = async () => {
    if (!orgId || !newKit.name.trim()) return;
    await createKit({ orgId, ...newKit });
    setNewKit({ name: "", description: "", trade_category: "", target_margin_pct: 40 });
    setShowNewKit(false);
    loadKits();
  };

  const handleDeleteKit = async (id: string) => {
    if (!orgId) return;
    await deleteKit(id, orgId);
    if (selectedKit?.id === id) { setSelectedKit(null); setTab("kits"); }
    loadKits();
  };

  const handleAddComponent = async () => {
    if (!orgId || !selectedKit || !newComp.label.trim()) return;
    await addKitComponent({ kit_id: selectedKit.id, orgId, ...newComp });
    setNewComp({ label: "", item_type: "INVENTORY_ITEM", quantity: 1, unit_cost: 0, sell_price: 0 });
    loadKitDetail(selectedKit);
  };

  const handleDeleteComponent = async (id: string) => {
    if (!orgId || !selectedKit) return;
    await deleteKitComponent(id, orgId);
    loadKitDetail(selectedKit);
  };

  const selectKit = (kit: TradeKit) => {
    setSelectedKit(kit);
    setTab("builder");
  };

  const filtered = kits.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    (k.trade_category ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const activeKits = kits.filter((k) => k.is_active);
  const avgMargin = kits.length > 0 ? kits.reduce((s, k) => s + (k.current_margin_pct ?? 0), 0) / kits.length : 0;

  // Live component math (client-side)
  const liveCost = components.reduce((s, c) => s + c.quantity * c.unit_cost, 0);
  const liveSell = components.reduce((s, c) => s + c.quantity * c.sell_price, 0);
  const targetPct = selectedKit?.target_margin_pct ?? 40;
  const requiredSell = targetPct < 100 ? liveCost / (1 - targetPct / 100) : liveCost;
  const actualMargin = liveSell > 0 ? ((liveSell - liveCost) / liveSell) * 100 : 0;
  const isBelowTarget = actualMargin < targetPct;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "kits", label: "Kits", icon: Package },
    { id: "builder", label: "Kit Builder", icon: Layers },
    { id: "proposals", label: "Proposals", icon: Send },
  ];

  if (!orgId && !loading) {
    return (
      <div className="flex items-center justify-center h-96 text-zinc-500">
        <AlertTriangle className="w-5 h-5 mr-2" /> Unable to load organization.
      </div>
    );
  }

  return (
    <motion.div {...fadeIn} className="min-h-screen bg-[#050505] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-500" />
            Kit Builder &amp; Proposals
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Build reusable trade kits with margin-aware pricing</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-white/5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { if (t.id === "builder" && !selectedKit) return; setTab(t.id); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : t.id === "builder" && !selectedKit
                  ? "text-zinc-600 cursor-not-allowed"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === "kits" && (
          <motion.div key="kits" {...fadeUp} className="space-y-6">
            {/* Stats Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Kits", value: kits.length, icon: Package, color: "text-emerald-500" },
                { label: "Active Kits", value: activeKits.length, icon: CheckCircle2, color: "text-emerald-400" },
                { label: "Avg Margin", value: pct(avgMargin), icon: TrendingUp, color: "text-emerald-300" },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</p>
                    <p className="text-xl font-bold text-white">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search kits…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-zinc-500 hover:text-white" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowNewKit(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> New Kit
              </button>
            </div>

            {/* New Kit Form */}
            <AnimatePresence>
              {showNewKit && (
                <motion.div {...fadeUp} className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Create New Kit</h3>
                    <button onClick={() => setShowNewKit(false)}>
                      <X className="w-4 h-4 text-zinc-500 hover:text-white" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={newKit.name}
                      onChange={(e) => setNewKit({ ...newKit, name: e.target.value })}
                      placeholder="Kit name *"
                      className="px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                    />
                    <input
                      value={newKit.trade_category}
                      onChange={(e) => setNewKit({ ...newKit, trade_category: e.target.value })}
                      placeholder="Trade category (e.g. Plumbing)"
                      className="px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                    />
                    <input
                      value={newKit.description}
                      onChange={(e) => setNewKit({ ...newKit, description: e.target.value })}
                      placeholder="Description"
                      className="px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 sm:col-span-2"
                    />
                    <div className="flex items-center gap-3 sm:col-span-2">
                      <label className="text-xs text-zinc-500 whitespace-nowrap">Target Margin</label>
                      <input
                        type="range" min={5} max={80} step={1}
                        value={newKit.target_margin_pct}
                        onChange={(e) => setNewKit({ ...newKit, target_margin_pct: Number(e.target.value) })}
                        className="flex-1 accent-emerald-500"
                      />
                      <span className="text-sm text-emerald-400 font-mono w-12 text-right">{newKit.target_margin_pct}%</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateKit}
                    disabled={!newKit.name.trim()}
                    className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Kit
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Kit Grid */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No kits found. Create your first kit to get started.</p>
              </div>
            ) : (
              <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((kit) => (
                  <motion.div
                    key={kit.id} {...fadeUp}
                    onClick={() => selectKit(kit)}
                    className={`group relative bg-zinc-900/50 rounded-xl p-5 cursor-pointer transition-all hover:bg-zinc-800/50 border ${
                      kit.margin_warning ? "border-amber-500/30" : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    {kit.margin_warning && (
                      <div className="absolute top-3 right-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                        <Package className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{kit.name}</h3>
                        {kit.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{kit.description}</p>
                        )}
                      </div>
                    </div>

                    {kit.trade_category && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] uppercase tracking-wider font-medium mb-3">
                        {kit.trade_category}
                      </span>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase">Cost</p>
                        <p className="text-xs font-mono text-zinc-300">{fmt(kit.calculated_cost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase">Sell</p>
                        <p className="text-xs font-mono text-zinc-300">{fmt(kit.calculated_sell)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase">Margin</p>
                        <p className={`text-xs font-mono ${kit.margin_warning ? "text-amber-400" : "text-emerald-400"}`}>
                          {pct(kit.current_margin_pct ?? 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        kit.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${kit.is_active ? "bg-emerald-500" : "bg-zinc-600"}`} />
                        {kit.is_active ? "Active" : "Inactive"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteKit(kit.id); }}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === "builder" && selectedKit && (
          <motion.div key="builder" {...fadeUp} className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setTab("kits")}
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to Kits
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Kit Metadata */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-white">Kit Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-zinc-600 uppercase tracking-wide">Name</label>
                      <p className="text-sm text-white font-medium">{selectedKit.name}</p>
                    </div>
                    {selectedKit.description && (
                      <div>
                        <label className="text-[10px] text-zinc-600 uppercase tracking-wide">Description</label>
                        <p className="text-sm text-zinc-400">{selectedKit.description}</p>
                      </div>
                    )}
                    {selectedKit.trade_category && (
                      <div>
                        <label className="text-[10px] text-zinc-600 uppercase tracking-wide">Category</label>
                        <span className="block mt-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs w-fit">
                          {selectedKit.trade_category}
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-zinc-600 uppercase tracking-wide">Target Margin</label>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(targetPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-emerald-400 font-mono">{pct(targetPct)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Components */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-semibold text-white">Components</h3>
                      <span className="text-xs text-zinc-600">({components.length})</span>
                    </div>
                  </div>

                  {compLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                  ) : components.length === 0 ? (
                    <p className="text-sm text-zinc-600 text-center py-6">No components yet. Add one below.</p>
                  ) : (
                    <div className="space-y-2">
                      {components.map((c) => (
                        <div
                          key={c.id}
                          className="group flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white truncate">{c.label || "Unnamed"}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                c.item_type === "LABOR_RATE"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-zinc-700 text-zinc-400"
                              }`}>
                                {c.item_type === "LABOR_RATE" ? "Labour" : "Material"}
                              </span>
                              {c.is_client_selectable && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">Optional</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                            <span className="text-zinc-500">×{c.quantity}</span>
                            <span className="text-zinc-400">{fmt(c.unit_cost)}</span>
                            <span className="text-emerald-400">{fmt(c.sell_price)}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteComponent(c.id)}
                            className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Component Form */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Add Component</p>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <input
                        value={newComp.label}
                        onChange={(e) => setNewComp({ ...newComp, label: e.target.value })}
                        placeholder="Label *"
                        className="col-span-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                      />
                      <select
                        value={newComp.item_type}
                        onChange={(e) => setNewComp({ ...newComp, item_type: e.target.value })}
                        className="px-2 py-2 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/40"
                      >
                        {ITEM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        type="number" min={0} step={1}
                        value={newComp.quantity || ""}
                        onChange={(e) => setNewComp({ ...newComp, quantity: Number(e.target.value) })}
                        placeholder="Qty"
                        className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                      />
                      <input
                        type="number" min={0} step={0.01}
                        value={newComp.unit_cost || ""}
                        onChange={(e) => setNewComp({ ...newComp, unit_cost: Number(e.target.value) })}
                        placeholder="Cost $"
                        className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                      />
                      <input
                        type="number" min={0} step={0.01}
                        value={newComp.sell_price || ""}
                        onChange={(e) => setNewComp({ ...newComp, sell_price: Number(e.target.value) })}
                        placeholder="Sell $"
                        className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                      />
                    </div>
                    <button
                      onClick={handleAddComponent}
                      disabled={!newComp.label.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Component
                    </button>
                  </div>
                </div>

                {/* Margin Mathematics Panel */}
                <div className={`bg-zinc-900/50 rounded-xl p-5 space-y-4 border ${
                  isBelowTarget && components.length > 0 ? "border-amber-500/30" : "border-white/5"
                }`}>
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-white">Margin Mathematics</h3>
                    {isBelowTarget && components.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                        <AlertTriangle className="w-3 h-3" /> Below Target
                      </span>
                    )}
                  </div>

                  {components.length === 0 ? (
                    <p className="text-sm text-zinc-600 text-center py-4">Add components to see margin calculations.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Total Cost</p>
                          <p className="text-lg font-mono text-white">{fmt(liveCost)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Total Sell</p>
                          <p className="text-lg font-mono text-emerald-400">{fmt(liveSell)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Required Sell</p>
                          <p className="text-lg font-mono text-zinc-400">{fmt(requiredSell)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Target Margin</p>
                          <div className="flex items-center gap-2">
                            <Percent className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-sm font-mono text-zinc-300">{pct(targetPct)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Actual Margin</p>
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`w-3.5 h-3.5 ${isBelowTarget ? "text-amber-500" : "text-emerald-500"}`} />
                            <span className={`text-sm font-mono ${isBelowTarget ? "text-amber-400" : "text-emerald-400"}`}>{pct(actualMargin)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual comparison bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-zinc-600">
                          <span>0%</span>
                          <span>Margin Comparison</span>
                          <span>100%</span>
                        </div>
                        <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden">
                          {/* Target line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 z-10"
                            style={{ left: `${Math.min(targetPct, 100)}%` }}
                          />
                          {/* Actual bar */}
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isBelowTarget ? "bg-amber-500/60" : "bg-emerald-500/60"
                            }`}
                            style={{ width: `${Math.min(Math.max(actualMargin, 0), 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className={isBelowTarget ? "text-amber-400" : "text-emerald-400"}>
                            Actual: {pct(actualMargin)}
                          </span>
                          <span className="text-zinc-500">Target: {pct(targetPct)}</span>
                        </div>
                      </div>

                      {/* Server-side margin math (if available) */}
                      {marginMath && (<div className="border-t border-white/5 pt-3">
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Server Calculated</p>
                          <div className="flex gap-4 text-xs font-mono text-zinc-500">
                            <span>Cost: {fmt(marginMath.total_cost)}</span>
                            <span>Sell: {fmt(marginMath.total_sell)}</span>
                            <span>Margin: {pct(marginMath.actual_margin_pct)}</span>
                          </div>
                        </div>)}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === "builder" && !selectedKit && (<motion.div key="no-kit" {...fadeUp} className="flex flex-col items-center justify-center py-20 text-zinc-600">
            <Layers className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Select a kit from the Kits tab to start building.</p>
          </motion.div>)}

        {tab === "proposals" && (
          <motion.div key="proposals" {...fadeUp} className="space-y-6">
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-8 text-center space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 w-fit mx-auto">
                <Send className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Multi-Option Proposals</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Clients receive a unique link to view tiered options, compare pricing,
                and accept with an e-signature — no account needed.
              </p>
              <div className="bg-zinc-800/50 border border-white/5 rounded-lg p-4 max-w-sm mx-auto">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Proposal Link Format</p>
                <code className="text-sm text-emerald-400 font-mono">/proposal/[token]</code>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-zinc-600 pt-2">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> E-Signatures</span>
                <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Auto-Invoicing</span>
                <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-emerald-500" /> Auto-PO Generation</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
