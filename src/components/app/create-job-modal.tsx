"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  X,
  MapPin,
  Calendar,
  User,
  DollarSign,
  Plus,
  Trash2,
  Send,
  Sparkles,
  Clock,
  AlertTriangle,
  CreditCard,
  Check,
} from "lucide-react";
import { PriorityIcon } from "./priority-icon";
import { StatusIcon } from "./status-icon";
import { PopoverMenu } from "./popover-menu";
import { useToastStore } from "./action-toast";
import { useJobsStore } from "@/lib/jobs-store";
import { useClientsStore } from "@/lib/clients-store";
import { useOrg } from "@/lib/hooks/use-org";
import { team, type Client, type Priority, type JobStatus, type Job } from "@/lib/data";

/* ── Types & Config ───────────────────────────────────────── */

interface CreateJobModalProps {
  open: boolean;
  onClose: () => void;
}

interface QuoteLineItem {
  id: string;
  description: string;
  cost: number;
}

const priorities: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No priority" },
];

const statuses: { value: JobStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
];

const catalogItems = [
  { name: "Boiler service — annual", price: 450 },
  { name: "Boiler installation — gas", price: 3200 },
  { name: "Hot water system inspection", price: 180 },
  { name: "Blocked drain — CCTV & jetting", price: 680 },
  { name: "Pipe repair — copper", price: 350 },
  { name: "Pipe repair — PEX", price: 280 },
  { name: "Tap replacement", price: 220 },
  { name: "Toilet replacement", price: 480 },
  { name: "Gas compliance certificate", price: 200 },
  { name: "Emergency call-out surcharge", price: 110 },
];

const gradients = [
  "from-zinc-600/30 to-zinc-800/30",
  "from-zinc-500/30 to-zinc-700/30",
  "from-zinc-700/30 to-zinc-900/30",
  "from-zinc-600/30 to-zinc-800/30",
  "from-zinc-500/30 to-zinc-700/30",
];

function getGrad(initials: string) {
  const c = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[c % gradients.length];
}

/* ── Component ────────────────────────────────────────────── */

export function CreateJobModal({ open, onClose }: CreateJobModalProps) {
  /* ── State ──────────────────────────────────────────────── */
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [status, setStatus] = useState<JobStatus>("backlog");
  const [assignee, setAssignee] = useState("Unassigned");
  const [targetDate, setTargetDate] = useState("");
  const [activePill, setActivePill] = useState<string | null>(null);

  const [estimateMode, setEstimateMode] = useState(false);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeCatalogIdx, setActiveCatalogIdx] = useState(0);
  const [catalogDropdownPos, setCatalogDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const [createMore, setCreateMore] = useState(false);

  const clientInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToastStore();
  const { createJobServer } = useJobsStore();
  const storeClients = useClientsStore((s) => s.clients);
  const { orgId } = useOrg();
  const [saving, setSaving] = useState(false);
  const searchParams = useSearchParams();

  /* ── Derived ────────────────────────────────────────────── */
  const allClients = storeClients;
  const filteredClients = useMemo(
    () =>
      clientQuery.length > 0
        ? allClients.filter(
            (c) =>
              c.name.toLowerCase().includes(clientQuery.toLowerCase()) ||
              (c.address || "").toLowerCase().includes(clientQuery.toLowerCase())
          )
        : [],
    [clientQuery, allClients]
  );

  const filteredCatalog = useMemo(
    () =>
      catalogQuery.length > 0
        ? catalogItems.filter((ci) =>
            ci.name.toLowerCase().includes(catalogQuery.toLowerCase())
          )
        : [],
    [catalogQuery]
  );

  const quoteTotal = lineItems.reduce((sum, li) => sum + li.cost, 0);

  const assigneeTeam = team.map((t) => ({
    value: t.name,
    label: t.name,
    icon: (
      <div className={`flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br text-[6px] font-bold text-zinc-300 ${getGrad(t.initials)}`}>
        {t.initials}
      </div>
    ),
  }));
  assigneeTeam.push({ value: "Unassigned", label: "Unassigned", icon: <User size={12} className="text-zinc-600" /> });

  /* Days until target date */
  const daysUntilDue = targetDate
    ? Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)
    : null;

  /* ── Catalog dropdown positioning ─────────────────────── */
  const updateCatalogPos = useCallback(() => {
    if (catalogInputRef.current) {
      const rect = catalogInputRef.current.getBoundingClientRect();
      setCatalogDropdownPos({
        top: rect.bottom + 4,
        left: rect.left - 16,
        width: rect.width + 32,
      });
    }
  }, []);

  /* ── Reset on open ──────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setClientQuery("");
      setSelectedClient(null);
      setShowClientDropdown(false);
      setTitle("");
      setDescription("");
      setPriority("none");
      setStatus("backlog");
      setAssignee("Unassigned");
      setTargetDate("");
      setActivePill(null);
      setEstimateMode(false);
      setLineItems([]);
      setCatalogQuery("");
      setShowCatalog(false);

      // Pre-fill client from URL search params (e.g. from Client detail → Create Job)
      const urlClientId = searchParams.get("clientId");
      if (urlClientId) {
        const preClient = storeClients.find((c) => c.id === urlClientId);
        if (preClient) {
          setSelectedClient(preClient);
          setTimeout(() => titleRef.current?.focus(), 120);
          return;
        }
      }

      setTimeout(() => clientInputRef.current?.focus(), 120);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Client selection ───────────────────────────────────── */
  function selectClient(client: Client) {
    setSelectedClient(client);
    setClientQuery("");
    setShowClientDropdown(false);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function clearClient() {
    setSelectedClient(null);
    setClientQuery("");
    setTimeout(() => clientInputRef.current?.focus(), 50);
  }

  /* ── Line items ─────────────────────────────────────────── */
  function addCatalogItem(name: string, price: number) {
    setLineItems((prev) => [
      ...prev,
      { id: `qi-${Date.now()}-${Math.random()}`, description: name, cost: price },
    ]);
    setCatalogQuery("");
    setShowCatalog(false);
    setTimeout(() => catalogInputRef.current?.focus(), 50);
  }

  function addCustomItem() {
    if (!catalogQuery.trim()) return;
    setLineItems((prev) => [
      ...prev,
      { id: `qi-${Date.now()}`, description: catalogQuery.trim(), cost: 0 },
    ]);
    setCatalogQuery("");
    setShowCatalog(false);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function updateLineItemCost(id: string, cost: number) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, cost } : li))
    );
  }

  /* ── Save ───────────────────────────────────────────────── */
  async function handleSave() {
    if (!title.trim() || saving) return;

    // Find the team member to get their profile id for assignment
    const assigneeMember = assignee !== "Unassigned" ? team.find((t) => t.name === assignee) : null;

    if (orgId) {
      // Server-synced path
      setSaving(true);
      try {
        const serverLineItems = estimateMode
          ? lineItems.map((li) => ({
              description: li.description,
              quantity: 1,
              unit_price_cents: Math.round(li.cost * 100),
            }))
          : [];

        const result = await createJobServer({
          organization_id: orgId,
          title: title.trim(),
          description: description.trim() || null,
          status: (estimateMode ? "backlog" : status) as "urgent" | "backlog" | "todo" | "in_progress" | "done" | "cancelled",
          priority,
          client_id: selectedClient?.id || null,
          assignee_id: (assigneeMember as any)?.id || null,
          due_date: targetDate || null,
          location: selectedClient?.address || null,
          location_lat: selectedClient?.addressCoords?.lat || null,
          location_lng: selectedClient?.addressCoords?.lng || null,
          labels: [],
          revenue: estimateMode && quoteTotal > 0 ? quoteTotal : null,
          line_items: serverLineItems,
        });

        if (result.success) {
          const displayId = result.displayId || "New Job";
          if (estimateMode && quoteTotal > 0) {
            addToast(`${displayId} created — Quote $${quoteTotal.toLocaleString()} sent`);
          } else {
            addToast(`${displayId} created`);
          }
        } else {
          addToast(`Error: ${result.error || "Failed to create job"}`);
        }
      } finally {
        setSaving(false);
      }
    } else {
      // No org available — cannot persist job
      console.error("Cannot create job: no organization context");
      addToast("Unable to save — please refresh and try again");
      setSaving(false);
      return;
    }

    if (createMore) {
      setTitle("");
      setDescription("");
      setPriority("none");
      setStatus("backlog");
      setAssignee("Unassigned");
      setTargetDate("");
      setEstimateMode(false);
      setLineItems([]);
      setTimeout(() => titleRef.current?.focus(), 50);
    } else {
      onClose();
    }
  }

  /* ── Keys ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        if (showCatalog) { setShowCatalog(false); return; }
        if (showClientDropdown) { setShowClientDropdown(false); return; }
        if (activePill) { setActivePill(null); return; }
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, activePill, title, createMore, showCatalog, showClientDropdown, estimateMode, quoteTotal]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — PRD: no heavy blur, focus on modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
            aria-hidden
          />

          {/* Stage — PRD: 840px, #141414, 1px border, 24px 48px shadow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            layout
            className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-[840px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header — PRD: breadcrumb left, minimize/close right ── */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-3.5">
              <span className="text-[12px] text-zinc-500">
                Apex Plumbing <span className="text-zinc-600">&gt;</span> New Job
              </span>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                  Esc
                </kbd>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Scrollable body ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 1: Context (Who & Where)                 */}
              {/* ══════════════════════════════════════════════ */}
              <div className="px-6 pt-5">
                {selectedClient ? (
                  /* Client pill + map */
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-semibold text-zinc-300 ${getGrad(selectedClient.initials)}`}>
                        {selectedClient.initials}
                      </div>
                      <span className="text-[14px] font-medium text-zinc-200">
                        {selectedClient.name}
                      </span>
                      <button
                        onClick={clearClient}
                        className="rounded-md p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Map + Client snapshot */}
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="mb-4 flex gap-3 overflow-hidden"
                    >
                      {/* Map card */}
                      {selectedClient.address && (
                        <div className="flex-1 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)]">
                          <div className="relative h-[100px] bg-[#0a0a0a]">
                            <div className="absolute inset-0 opacity-[0.03]">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={`h-${i}`} className="absolute left-0 right-0 border-t border-white" style={{ top: `${i * 25}%` }} />
                              ))}
                              {Array.from({ length: 7 }).map((_, i) => (
                                <div key={`v-${i}`} className="absolute top-0 bottom-0 border-l border-white" style={{ left: `${i * 16.6}%` }} />
                              ))}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <motion.div
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                              >
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00E676] shadow-lg shadow-[#00E676]/30">
                                  <MapPin size={10} className="text-white" />
                                </div>
                                <motion.div
                                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="absolute inset-0 rounded-full border border-[#00E676]"
                                />
                              </motion.div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[10px] text-zinc-500">
                            <MapPin size={9} className="text-zinc-600" />
                            {selectedClient.address}
                          </div>
                        </div>
                      )}

                      {/* Client health snapshot */}
                      <div className="w-[200px] shrink-0 space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                        <div className="text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                          Client Health
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">Outstanding</span>
                          <span className="text-[10px] font-medium text-emerald-400">$0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">Last Job</span>
                          <span className="text-[10px] text-zinc-400">{selectedClient.lastJob}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">Credit</span>
                          <span className="text-[10px] text-emerald-400">Good</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">LTV</span>
                          <span className="text-[10px] text-zinc-400">{selectedClient.lifetimeValue}</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  /* Magic Input */
                  <div className="relative mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="shrink-0 text-zinc-700" />
                      <input
                        ref={clientInputRef}
                        value={clientQuery}
                        onChange={(e) => {
                          setClientQuery(e.target.value);
                          setShowClientDropdown(e.target.value.length > 0);
                        }}
                        onFocus={() => {
                          if (clientQuery.length > 0) setShowClientDropdown(true);
                        }}
                        placeholder="Client name or address..."
                        className="w-full bg-transparent text-[20px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
                      />
                    </div>

                    {/* Client dropdown */}
                    <AnimatePresence>
                      {showClientDropdown && filteredClients.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-2 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
                        >
                          {filteredClients.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => selectClient(c)}
                              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-zinc-800"
                            >
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[8px] font-semibold text-zinc-300 ${getGrad(c.initials)}`}>
                                {c.initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-medium text-zinc-300">{c.name}</div>
                                {c.address && (
                                  <div className="truncate text-[10px] text-zinc-600">{c.address}</div>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-600">{c.lifetimeValue}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 2: Scope (What)                          */}
              {/* ══════════════════════════════════════════════ */}
              <div className="px-6">
                {/* Title */}
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Job Title..."
                  className="mb-2 w-full bg-transparent text-[24px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-600"
                />

                {/* Description */}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description..."
                  rows={3}
                  className="mb-4 w-full resize-none bg-transparent text-[13px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
                />

                {/* Property pills */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {/* Status */}
                  <div className="relative">
                    <button
                      onClick={() => setActivePill(activePill === "status" ? null : "status")}
                      className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
                    >
                      <StatusIcon status={status} size={12} />
                      {statuses.find((s) => s.value === status)?.label}
                      <ChevronDown size={10} className="text-zinc-600" />
                    </button>
                    <div className="absolute bottom-full left-0 mb-1">
                      <PopoverMenu
                        open={activePill === "status"}
                        onClose={() => setActivePill(null)}
                        items={statuses.map((s) => ({
                          value: s.value,
                          label: s.label,
                          icon: <StatusIcon status={s.value} size={12} />,
                        }))}
                        selected={status}
                        onSelect={(v) => setStatus(v)}
                        width={180}
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="relative">
                    <button
                      onClick={() => setActivePill(activePill === "priority" ? null : "priority")}
                      className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
                    >
                      <PriorityIcon priority={priority} size={12} />
                      {priorities.find((p) => p.value === priority)?.label || "Priority"}
                      <ChevronDown size={10} className="text-zinc-600" />
                    </button>
                    <div className="absolute bottom-full left-0 mb-1">
                      <PopoverMenu
                        open={activePill === "priority"}
                        onClose={() => setActivePill(null)}
                        items={priorities.map((p) => ({
                          value: p.value,
                          label: p.label,
                          icon: <PriorityIcon priority={p.value} size={12} />,
                        }))}
                        selected={priority}
                        onSelect={(v) => setPriority(v)}
                        width={180}
                        searchable={false}
                      />
                    </div>
                  </div>

                  {/* Lead Tech */}
                  <div className="relative">
                    <button
                      onClick={() => setActivePill(activePill === "assignee" ? null : "assignee")}
                      className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
                    >
                      <User size={11} className="text-zinc-600" />
                      {assignee}
                      <ChevronDown size={10} className="text-zinc-600" />
                    </button>
                    <div className="absolute bottom-full left-0 mb-1">
                      <PopoverMenu
                        open={activePill === "assignee"}
                        onClose={() => setActivePill(null)}
                        items={assigneeTeam}
                        selected={assignee}
                        onSelect={(v) => setAssignee(v)}
                        width={220}
                      />
                    </div>
                  </div>

                  {/* Target Date */}
                  <div className="relative flex items-center gap-1.5">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300">
                      <Calendar size={11} className="text-zinc-600" />
                      {targetDate ? (
                        <span className="text-zinc-300">
                          {new Date(targetDate).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
                        </span>
                      ) : (
                        "Target Date"
                      )}
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="absolute h-0 w-0 opacity-0"
                      />
                    </label>
                    {daysUntilDue !== null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          daysUntilDue <= 1
                            ? "bg-red-500/10 text-red-400"
                            : daysUntilDue <= 3
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        <Clock size={8} className="mr-0.5 inline" />
                        {daysUntilDue <= 0 ? "Today" : `In ${daysUntilDue}d`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════ */}
              {/* ZONE 3: Financials (The Quote Engine)          */}
              {/* ══════════════════════════════════════════════ */}
              <div className="border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
                {/* Toggle */}
                <div className="mb-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[12px] text-zinc-400">
                    <button
                      onClick={() => setEstimateMode(!estimateMode)}
                      className={`relative h-[18px] w-[32px] rounded-full transition-colors ${estimateMode ? "bg-[#00E676]" : "bg-zinc-700"}`}
                    >
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white"
                        style={{ left: estimateMode ? 15 : 2 }}
                      />
                    </button>
                    <DollarSign size={12} className="text-zinc-600" />
                    Generate Estimate
                  </label>
                  {estimateMode && quoteTotal > 0 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[16px] font-semibold tracking-tight text-zinc-100"
                    >
                      ${quoteTotal.toLocaleString()}
                    </motion.span>
                  )}
                </div>

                <AnimatePresence>
                  {estimateMode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="overflow-hidden"
                    >
                      {/* Receipt UI */}
                      <div className="mb-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                        {/* Line items */}
                        {lineItems.length > 0 && (
                          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                            {lineItems.map((li) => (
                              <motion.div
                                key={li.id}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group flex items-center gap-3 px-4 py-2.5"
                              >
                                <span className="min-w-0 flex-1 text-[12px] text-zinc-400">
                                  {li.description}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[10px] text-zinc-600">$</span>
                                  <input
                                    type="number"
                                    value={li.cost || ""}
                                    onChange={(e) => updateLineItemCost(li.id, Number(e.target.value) || 0)}
                                    className="w-16 bg-transparent text-right text-[12px] font-medium text-zinc-300 outline-none"
                                    placeholder="0"
                                  />
                                </div>
                                <button
                                  onClick={() => removeLineItem(li.id)}
                                  className="rounded-md p-0.5 text-zinc-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Add item input */}
                        <div className="relative border-t border-[rgba(255,255,255,0.04)] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Plus size={12} className="shrink-0 text-zinc-600" />
                            <input
                              ref={catalogInputRef}
                              value={catalogQuery}
                              onChange={(e) => {
                                setCatalogQuery(e.target.value);
                                setShowCatalog(e.target.value.length > 0);
                                setActiveCatalogIdx(0);
                                updateCatalogPos();
                              }}
                              onFocus={() => {
                                if (catalogQuery.length > 0) {
                                  setShowCatalog(true);
                                  updateCatalogPos();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") { e.preventDefault(); setActiveCatalogIdx((i) => Math.min(i + 1, filteredCatalog.length - 1)); }
                                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveCatalogIdx((i) => Math.max(i - 1, 0)); }
                                else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (filteredCatalog[activeCatalogIdx]) {
                                    addCatalogItem(filteredCatalog[activeCatalogIdx].name, filteredCatalog[activeCatalogIdx].price);
                                  } else if (catalogQuery.trim()) {
                                    addCustomItem();
                                  }
                                }
                              }}
                              placeholder="Add service from catalog..."
                              className="w-full bg-transparent text-[12px] text-zinc-400 outline-none placeholder:text-zinc-700"
                            />
                          </div>

                          {/* Catalog dropdown renders via portal below */}
                        </div>
                      </div>

                      {/* Quote total */}
                      {lineItems.length > 0 && (
                        <motion.div
                          layout
                          className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                        >
                          <span className="text-[11px] font-medium text-zinc-500">Estimated Total</span>
                          <motion.span
                            key={quoteTotal}
                            initial={{ y: -4, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-[18px] font-semibold tracking-tight text-zinc-100"
                          >
                            ${quoteTotal.toLocaleString()}
                          </motion.span>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Footer / Action Row ───────────────────────── */}
            <div className="flex shrink-0 items-center justify-between gap-6 px-6 py-4">
              {/* Create more toggle — monochrome */}
              <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                <button
                  type="button"
                  onClick={() => setCreateMore(!createMore)}
                  className={`relative h-[16px] w-[28px] rounded-full transition-colors ${createMore ? "bg-white" : "bg-zinc-700"}`}
                >
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-[2px] h-3 w-3 rounded-full ${createMore ? "bg-black" : "bg-white"}`}
                    style={{ left: createMore ? 13 : 2 }}
                  />
                </button>
                Create more
              </label>

              {/* Submit — PRD: "Create Issue" #5E6AD2 (Blurple) */}
              {estimateMode && quoteTotal > 0 ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={!title.trim() || saving}
                  className="flex items-center gap-2 rounded-md bg-[#5E6AD2] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#4f5bc4] disabled:opacity-50"
                >
                  <Send size={12} />
                  {saving ? "Saving..." : "Send Quote & Save"}
                  <kbd className="rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={!title.trim() || saving}
                  className="flex items-center gap-2 rounded-md bg-[#5E6AD2] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#4f5bc4] disabled:opacity-50"
                >
                  <Check size={12} />
                  {saving ? "Saving..." : "Create Issue"}
                  <kbd className="rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Catalog dropdown — rendered via portal to escape overflow clipping */}
          {showCatalog && filteredCatalog.length > 0 && catalogDropdownPos &&
            createPortal(
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="fixed z-[100] overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
                style={{
                  top: catalogDropdownPos.top,
                  left: catalogDropdownPos.left,
                  width: catalogDropdownPos.width,
                }}
              >
                {filteredCatalog.map((ci, i) => (
                  <button
                    key={ci.name}
                    onClick={() => addCatalogItem(ci.name, ci.price)}
                    onMouseEnter={() => setActiveCatalogIdx(i)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      i === activeCatalogIdx ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="text-[12px]">{ci.name}</span>
                    <span className="text-[11px] text-zinc-500">${ci.price}</span>
                  </button>
                ))}
              </motion.div>,
              document.body
            )
          }
        </>
      )}
    </AnimatePresence>
  );
}
