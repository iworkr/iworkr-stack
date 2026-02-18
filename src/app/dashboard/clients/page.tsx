"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Building2,
  User,
  Trash2,
  Copy,
  Pencil,
  SlidersHorizontal,
  Users,
  X,
  Check,
  Briefcase,
  ChevronRight,
  Upload,
} from "lucide-react";
import { useToastStore } from "@/components/app/action-toast";
import { useShellStore } from "@/lib/shell-store";
import { useClientsStore } from "@/lib/clients-store";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";

/* ── Status config ────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
  lead: { label: "Lead", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/15" },
  churned: { label: "Churned", dot: "bg-rose-400", text: "text-rose-400", bg: "bg-rose-500/15" },
  inactive: { label: "Inactive", dot: "bg-zinc-500", text: "text-zinc-500", bg: "bg-zinc-500/15" },
};

type TabId = "all" | "vip" | "leads" | "churned";

const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "All Clients" },
  { id: "vip", label: "VIP" },
  { id: "leads", label: "Leads" },
  { id: "churned", label: "Churned" },
];

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Dossier", icon: <Pencil size={13} />, shortcut: "↵" },
  { id: "newjob", label: "New Job", icon: <Briefcase size={13} /> },
  { id: "email", label: "Send Email", icon: <Mail size={13} /> },
  { id: "call", label: "Call", icon: <Phone size={13} /> },
  { id: "copy", label: "Copy Email", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "archive", label: "Archive", icon: <Trash2 size={13} />, danger: true },
];

/* ── Avatar gradient ──────────────────────────────────────── */

const gradients = [
  "from-zinc-600/30 to-zinc-800/30",
  "from-emerald-600/30 to-teal-800/30",
  "from-amber-600/30 to-orange-800/30",
  "from-rose-600/30 to-pink-800/30",
  "from-zinc-500/30 to-zinc-700/30",
  "from-sky-600/30 to-indigo-800/30",
];

function getGradient(initials: string): string {
  const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[charCode % gradients.length];
}

/* ── LTV Count-Up Hook ────────────────────────────────────── */

function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = 0;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

/* ── Page ─────────────────────────────────────────────────── */

export default function ClientsPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { setCreateClientModalOpen } = useShellStore();
  const {
    clients: clientsList,
    loading,
    archiveClientServer,
    restoreClient,
    filterStatus,
    filterType,
    setFilterStatus,
    setFilterType,
  } = useClientsStore();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const filterRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; clientId: string }>({
    open: false, x: 0, y: 0, clientId: "",
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  /* ── Filter pipeline ───────────────────────────────────── */
  const filtered = useMemo(() => {
    return clientsList.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = !filterStatus || c.status === filterStatus;
      const matchesType = !filterType || c.type === filterType;

      let matchesTab = true;
      if (activeTab === "vip") matchesTab = (c.lifetimeValueNum || 0) >= 5000;
      else if (activeTab === "leads") matchesTab = c.status === "lead";
      else if (activeTab === "churned") matchesTab = c.status === "churned";

      return matchesSearch && matchesStatus && matchesType && matchesTab;
    });
  }, [clientsList, search, filterStatus, filterType, activeTab]);

  const hasActiveFilters = !!filterStatus || !!filterType;

  /* ── Aggregate stats ─────────────────────────────────────── */
  const totalLTV = useMemo(() => clientsList.reduce((sum, c) => sum + (c.lifetimeValueNum || 0), 0), [clientsList]);
  const animatedLTV = useCountUp(totalLTV);
  const vipCount = useMemo(() => clientsList.filter((c) => (c.lifetimeValueNum || 0) >= 5000).length, [clientsList]);
  const leadCount = useMemo(() => clientsList.filter((c) => c.status === "lead").length, [clientsList]);

  /* ── Keyboard shortcuts ─────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;

      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const client = filtered[focusedIndex];
        if (client) router.push(`/dashboard/clients/${client.id}`);
      }
    },
    [filtered, focusedIndex, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Context menu ───────────────────────────────────────── */
  function handleContextAction(actionId: string) {
    const client = clientsList.find((c) => c.id === ctxMenu.clientId);
    if (!client) return;

    if (actionId === "open") {
      router.push(`/dashboard/clients/${client.id}`);
    } else if (actionId === "newjob") {
      router.push(`/dashboard/jobs?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`);
    } else if (actionId === "email") {
      if (!client.email) { addToast("No email configured"); return; }
      window.location.href = `mailto:${client.email}`;
    } else if (actionId === "call") {
      if (!client.phone) { addToast("No phone number configured"); return; }
      window.location.href = `tel:${client.phone}`;
    } else if (actionId === "copy") {
      navigator.clipboard?.writeText(client.email);
      addToast("Email copied to clipboard");
    } else if (actionId === "archive") {
      const archived = client;
      archiveClientServer(client.id);
      addToast(`${client.name} archived`, () => restoreClient(archived));
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Command Bar Header ────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRight size={10} className="text-zinc-700" />
              <span className="font-medium text-white">Clients</span>
            </div>

            {/* Tabs with Emerald dot indicator */}
            <div className="ml-4 flex items-center gap-0.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = tab.id === "vip" ? vipCount : tab.id === "leads" ? leadCount : tab.id === "churned" ? clientsList.filter((c) => c.status === "churned").length : clientsList.length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setFocusedIndex(0); }}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="clients-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search clients, emails, phones..."
                  className="w-44 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !search && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  hasActiveFilters
                    ? "bg-emerald-500/[0.06] text-emerald-400"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <SlidersHorizontal size={12} />
                Filter
                {hasActiveFilters && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                    {(filterStatus ? 1 : 0) + (filterType ? 1 : 0)}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/95 p-3 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Filters</span>
                      {hasActiveFilters && (
                        <button
                          onClick={() => { setFilterStatus(null); setFilterType(null); }}
                          className="text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div className="mb-3">
                      <span className="mb-1.5 block text-[10px] font-medium text-zinc-600">Status</span>
                      <div className="flex flex-wrap gap-1">
                        {(["active", "lead", "churned", "inactive"] as const).map((s) => {
                          const cfg = statusConfig[s];
                          const isActive = filterStatus === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setFilterStatus(isActive ? null : s)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
                                isActive
                                  ? `${cfg.bg} ${cfg.text}`
                                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-[10px] font-medium text-zinc-600">Type</span>
                      <div className="flex gap-1">
                        {([{ value: "residential", label: "Residential", icon: <User size={9} /> }, { value: "commercial", label: "Commercial", icon: <Building2 size={9} /> }] as const).map(({ value, label, icon }) => {
                          const isActive = filterType === value;
                          return (
                            <button
                              key={value}
                              onClick={() => setFilterType(isActive ? null : value)}
                              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
                                isActive
                                  ? "bg-white/[0.06] text-zinc-200"
                                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                              }`}
                            >
                              {icon}
                              {label}
                              {isActive && <Check size={8} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Import ghost button */}
            <button
              onClick={() => addToast("CSV import coming soon")}
              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400"
              title="Import CSV"
            >
              <Upload size={13} />
            </button>

            {/* Add Client — solid Emerald */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setCreateClientModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-900/30"
            >
              <Plus size={12} />
              Add Client
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.03] bg-[#080808] px-5 py-2">
        <div className="w-64 px-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Client</div>
        <div className="w-24 px-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Status</div>
        <div className="w-20 px-2 text-center text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Contact</div>
        <div className="min-w-0 flex-1 px-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Email</div>
        <div className="w-16 px-2 text-right text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Jobs</div>
        <div className="w-28 px-2 text-right text-[10px] font-bold tracking-widest text-zinc-500 uppercase">LTV</div>
        <div className="w-24 px-2 text-right text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Last Active</div>
        <div className="w-24" />
      </div>

      {/* ── Rows ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Empty state */}
        {filtered.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[60px]" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              <LottieIcon
                animationData={radarScanAnimation}
                size={120}
                loop
                autoplay
                className="opacity-50"
              />
              <div className="absolute inset-0 rounded-full border border-emerald-500/[0.06] animate-signal-pulse" />
            </motion.div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {hasActiveFilters || search || activeTab !== "all"
                ? "No clients match"
                : "No clients yet"}
            </h3>
            <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">
              {hasActiveFilters || search || activeTab !== "all"
                ? "Try adjusting your filters or search terms."
                : "Add your first client to start building your CRM."}
            </p>
            {(hasActiveFilters || search || activeTab !== "all") ? (
              <button
                onClick={() => { setSearch(""); setFilterStatus(null); setFilterType(null); setActiveTab("all"); }}
                className="mt-4 rounded-md border border-white/[0.06] px-3 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
              >
                Clear all filters
              </button>
            ) : (
              <button
                onClick={() => setCreateClientModalOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500"
              >
                <Plus size={14} />
                Add First Client
              </button>
            )}
          </motion.div>
        )}

        {/* LTV Summary Bar */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-6 border-b border-white/[0.02] bg-white/[0.01] px-7 py-2">
            <span className="text-[10px] text-zinc-600">
              {filtered.length} client{filtered.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
              ${animatedLTV.toLocaleString()}
              <span className="text-[9px] text-zinc-600">total LTV</span>
            </span>
          </div>
        )}

        <AnimatePresence>
          {filtered.map((client, i) => {
            const isFocused = i === focusedIndex;
            const sc = statusConfig[client.status] || statusConfig.inactive;
            const isVIP = (client.lifetimeValueNum || 0) >= 10000;
            const hasMultipleContacts = (client.contacts?.length || 0) > 1;

            return (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                data-client-row
                onClick={() => {
                  setFocusedIndex(i);
                  router.push(`/dashboard/clients/${client.id}`);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ open: true, x: e.clientX, y: e.clientY, clientId: client.id });
                }}
                className={`group relative flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 ${
                  isFocused ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"
                }`}
                style={{ height: 64 }}
              >
                {/* Focus indicator */}
                {isFocused && (
                  <motion.div
                    layoutId="client-focus-spine"
                    className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Avatar + Name + Company */}
                <div className="flex w-64 items-center gap-3 px-2">
                  <div className="relative">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold tracking-wide text-zinc-300 ${getGradient(client.initials)}`}
                    >
                      {client.initials}
                    </div>
                    {isVIP && (
                      <div className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-[#050505]">
                        <span className="text-[6px] font-bold text-black">★</span>
                      </div>
                    )}
                    {hasMultipleContacts && (
                      <div className="absolute -bottom-0.5 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-700 text-[7px] font-bold text-zinc-300 ring-1 ring-[#050505]">
                        {client.contacts!.length}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`truncate text-[13px] font-medium ${isVIP ? "text-amber-200" : "text-zinc-200"}`}>
                      {client.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                      {client.type === "commercial" ? (
                        <Building2 size={8} />
                      ) : (
                        <User size={8} />
                      )}
                      {client.type ? client.type.charAt(0).toUpperCase() + client.type.slice(1) : "Client"}
                    </div>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="w-24 px-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>

                {/* Contact icons (reveal on hover) */}
                <div className="flex w-20 items-center justify-center gap-1 px-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!client.email) { addToast("No email configured"); return; }
                      window.location.href = `mailto:${client.email}`;
                    }}
                    className="rounded-md p-1 text-zinc-700 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.04] hover:text-zinc-400"
                    title="Email"
                  >
                    <Mail size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!client.phone) { addToast("No phone configured"); return; }
                      window.location.href = `tel:${client.phone}`;
                    }}
                    className="rounded-md p-1 text-zinc-700 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.04] hover:text-zinc-400"
                    title="Call"
                  >
                    <Phone size={12} />
                  </button>
                </div>

                {/* Email */}
                <div className="min-w-0 flex-1 px-2">
                  <span className="truncate text-[12px] text-zinc-500">{client.email || "—"}</span>
                </div>

                {/* Jobs count */}
                <div className="w-16 px-2 text-right">
                  <span className="font-mono text-[12px] text-zinc-400">{client.totalJobs}</span>
                </div>

                {/* LTV — Emerald-400 monospace */}
                <div className="w-28 px-2 text-right">
                  <LTVCell value={client.lifetimeValueNum || 0} formatted={client.lifetimeValue} isVIP={isVIP} />
                </div>

                {/* Last Active */}
                <div className="w-24 px-2 text-right">
                  <span className={`text-[11px] ${
                    client.lastJob === "Today" || client.lastJob === "Yesterday"
                      ? "text-zinc-400"
                      : "text-zinc-600"
                  }`}>
                    {client.lastJob}
                  </span>
                </div>

                {/* Quick Actions (hover) */}
                <div className="flex w-24 items-center justify-end gap-0.5 px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/jobs?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`);
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                    title="New Job"
                  >
                    <Briefcase size={10} />
                    Job
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/clients/${client.id}`);
                    }}
                    className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                    title="Edit"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              </motion.div>
            );
          })}
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

/* ── LTV Cell with count-up effect ────────────────────────── */

function LTVCell({ value, formatted, isVIP }: { value: number; formatted: string; isVIP: boolean }) {
  const displayed = useCountUp(value, 500);

  if (value === 0) {
    return <span className="font-mono text-[12px] text-zinc-700">$0</span>;
  }

  return (
    <span
      className={`font-mono text-[12px] font-medium ${isVIP ? "text-emerald-400" : "text-emerald-400/70"}`}
      style={
        isVIP
          ? {
              textShadow: "0 0 12px rgba(16, 185, 129, 0.3)",
            }
          : undefined
      }
    >
      ${displayed.toLocaleString()}
    </span>
  );
}
