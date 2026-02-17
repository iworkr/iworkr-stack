"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ArrowRight,
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
} from "lucide-react";
import { useToastStore } from "@/components/app/action-toast";
import { useShellStore } from "@/lib/shell-store";
import { useClientsStore } from "@/lib/clients-store";
// deleteClientAction is now called inside archiveClientServer in the store
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";

/* ── Status config ────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-400/80" },
  lead: { label: "Lead", dot: "bg-[#00E676]", text: "text-[rgba(0,230,118,0.8)]" },
  churned: { label: "Churned", dot: "bg-red-400", text: "text-red-400/70" },
  inactive: { label: "Inactive", dot: "bg-zinc-500", text: "text-zinc-500" },
};

const contextItems: ContextMenuItem[] = [
  { id: "open", label: "Open Dossier", icon: <Pencil size={13} />, shortcut: "↵" },
  { id: "email", label: "Send Email", icon: <Mail size={13} /> },
  { id: "call", label: "Call", icon: <Phone size={13} /> },
  { id: "copy", label: "Copy Email", icon: <Copy size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "archive", label: "Archive", icon: <Trash2 size={13} />, danger: true },
];

/* ── Avatar gradient based on initials ────────────────────── */

const gradients = [
  "from-zinc-600/30 to-zinc-800/30",
  "from-emerald-600/30 to-teal-800/30",
  "from-amber-600/30 to-orange-800/30",
  "from-rose-600/30 to-pink-800/30",
  "from-zinc-500/30 to-zinc-700/30",
  "from-zinc-700/30 to-zinc-900/30",
];

function getGradient(initials: string): string {
  const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[charCode % gradients.length];
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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number; clientId: string }>({
    open: false, x: 0, y: 0, clientId: "",
  });

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  const filtered = clientsList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !filterStatus || c.status === filterStatus;
    const matchesType = !filterType || c.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const hasActiveFilters = !!filterStatus || !!filterType;

  /* ── Keyboard ───────────────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
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
    } else if (actionId === "email") {
      if (!client.email) {
        addToast("No email configured");
        return;
      }
      window.location.href = `mailto:${client.email}`;
    } else if (actionId === "call") {
      if (!client.phone) {
        addToast("No phone number configured");
        return;
      }
      window.location.href = `tel:${client.phone}`;
    } else if (actionId === "copy") {
      navigator.clipboard?.writeText(client.email);
      addToast("Email copied to clipboard");
    } else if (actionId === "archive") {
      archiveClientServer(client.id);
      addToast(`${client.name} archived`);
    }
  }

  /* ── Active / total stats ───────────────────────────────── */
  const activeCount = clientsList.filter((c) => c.status === "active").length;
  const totalLTV = clientsList.reduce((sum, c) => sum + (c.lifetimeValueNum || 0), 0);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-medium text-zinc-200">Clients</h1>
          <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[11px] text-zinc-500">
            {clientsList.length} total
          </span>
          <span className="text-[11px] text-zinc-600">
            {activeCount} active
          </span>
          <span className="font-mono text-[11px] text-zinc-600">
            ${totalLTV.toLocaleString()} LTV
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 transition-colors focus-within:border-[rgba(255,255,255,0.15)]">
            <Search size={12} className="text-zinc-600" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setFocusedIndex(0); }}
              placeholder="Search clients..."
              className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                hasActiveFilters
                  ? "border-[#00E676]/40 text-[#00E676] hover:border-[#00E676]/60"
                  : "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
              }`}
            >
              <SlidersHorizontal size={12} />
              Filter
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#00E676] text-[9px] font-medium text-white">
                  {(filterStatus ? 1 : 0) + (filterType ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Filter Popover */}
            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] p-3 shadow-2xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">Filters</span>
                    {hasActiveFilters && (
                      <button
                        onClick={() => { setFilterStatus(null); setFilterType(null); }}
                        className="text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Status */}
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
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                              isActive
                                ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-zinc-200"
                                : "border-[rgba(255,255,255,0.06)] text-zinc-500 hover:border-[rgba(255,255,255,0.12)] hover:text-zinc-300"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                            {isActive && <Check size={8} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <span className="mb-1.5 block text-[10px] font-medium text-zinc-600">Type</span>
                    <div className="flex gap-1">
                      {([{ value: "residential", label: "Residential", icon: <User size={9} /> }, { value: "commercial", label: "Commercial", icon: <Building2 size={9} /> }] as const).map(({ value, label, icon }) => {
                        const isActive = filterType === value;
                        return (
                          <button
                            key={value}
                            onClick={() => setFilterType(isActive ? null : value)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                              isActive
                                ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] text-zinc-200"
                                : "border-[rgba(255,255,255,0.06)] text-zinc-500 hover:border-[rgba(255,255,255,0.12)] hover:text-zinc-300"
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
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setCreateClientModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
          >
            <Plus size={12} />
            Add Client
          </motion.button>
        </div>
      </div>

      {/* ── Column headers ─────────────────────────────────── */}
      <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-2">
        <div className="w-52 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Client</div>
        <div className="w-28 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Status</div>
        <div className="min-w-0 flex-1 px-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Email</div>
        <div className="w-20 px-2 text-right text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Jobs</div>
        <div className="w-28 px-2 text-right text-[11px] font-medium tracking-wider text-zinc-600 uppercase">LTV</div>
        <div className="w-24 px-2 text-right text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Last Active</div>
        <div className="w-8" />
      </div>

      {/* ── Rows ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state */}
        {filtered.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
              <Users size={22} strokeWidth={1} className="text-zinc-700" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-300">No clients found</h3>
            <p className="mt-1 text-[12px] text-zinc-600">
              {hasActiveFilters || search
                ? "Try adjusting your filters or search terms."
                : "Add your first client to get started."}
            </p>
            {(hasActiveFilters || search) && (
              <button
                onClick={() => { setSearch(""); setFilterStatus(null); setFilterType(null); }}
                className="mt-3 rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[11px] text-zinc-500 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {filtered.map((client, i) => {
            const isFocused = i === focusedIndex;
            const sc = statusConfig[client.status] || statusConfig.inactive;
            const isHighLTV = (client.lifetimeValueNum || 0) >= 10000;

            return (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.015, duration: 0.2 }}
                onClick={() => {
                  setFocusedIndex(i);
                  router.push(`/dashboard/clients/${client.id}`);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ open: true, x: e.clientX, y: e.clientY, clientId: client.id });
                }}
                className={`group flex cursor-pointer items-center border-b border-[rgba(255,255,255,0.04)] px-5 transition-colors ${
                  isFocused ? "bg-[rgba(255,255,255,0.04)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                }`}
                style={{ height: 56 }}
              >
                {/* Avatar + Name */}
                <div className="flex w-52 items-center gap-3 px-2">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-zinc-300 ${getGradient(client.initials)}`}
                  >
                    {client.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-zinc-200">
                      {client.name}
                    </div>
                    {client.type && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                        {client.type === "commercial" ? (
                          <Building2 size={8} />
                        ) : (
                          <User size={8} />
                        )}
                        {client.type.charAt(0).toUpperCase() + client.type.slice(1)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="w-28 px-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] px-2 py-0.5 text-[10px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    <span className={sc.text}>{sc.label}</span>
                  </span>
                </div>

                {/* Email */}
                <div className="min-w-0 flex-1 px-2">
                  <span className="truncate text-[12px] text-zinc-500">{client.email}</span>
                </div>

                {/* Jobs */}
                <div className="w-20 px-2 text-right">
                  <span className="text-[12px] text-zinc-500">{client.totalJobs}</span>
                </div>

                {/* LTV */}
                <div className="w-28 px-2 text-right">
                  <span
                    className={`text-[12px] font-medium ${
                      isHighLTV ? "text-amber-300" : "text-zinc-400"
                    }`}
                    style={
                      isHighLTV
                        ? {
                            background: "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
                            backgroundSize: "200% 100%",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "shimmer 3s infinite",
                          }
                        : undefined
                    }
                  >
                    {client.lifetimeValue}
                  </span>
                </div>

                {/* Last Active */}
                <div className="w-24 px-2 text-right">
                  <span className={`text-[12px] ${client.lastJob === "Today" ? "text-zinc-400" : "text-zinc-600"}`}>
                    {client.lastJob}
                  </span>
                </div>

                {/* Hover arrow / Quick actions */}
                <div className="w-8 text-right">
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight size={13} className="text-zinc-600" />
                  </div>
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
