"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Send,
  FileText,
  Copy,
  ChevronDown,
  Check,
  Paperclip,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { useToastStore } from "./action-toast";
import { useFinanceStore } from "@/lib/finance-store";
import { useClientsStore } from "@/lib/clients-store";
import { useOrg } from "@/lib/hooks/use-org";
import {
  clients as mockClients,
  type Client,
  type Invoice,
  type LineItem,
  type InvoiceEvent,
} from "@/lib/data";

/* ── Types & Config ───────────────────────────────────────── */

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
}

type PaymentTerms = "due_receipt" | "net_7" | "net_14" | "net_30";

const paymentTerms: { value: PaymentTerms; label: string; days: number }[] = [
  { value: "due_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_14", label: "Net 14", days: 14 },
  { value: "net_30", label: "Net 30", days: 30 },
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
  { name: "Materials — PEX tubing 50m", price: 650 },
  { name: "Materials — copper fittings", price: 180 },
  { name: "Disposal & waste removal", price: 400 },
  { name: "Kitchen repipe — copper to PEX", price: 3800 },
];

const gradients = [
  "from-violet-600/30 to-indigo-800/30",
  "from-emerald-600/30 to-teal-800/30",
  "from-amber-600/30 to-orange-800/30",
  "from-rose-600/30 to-pink-800/30",
  "from-blue-600/30 to-cyan-800/30",
];

function getGrad(initials: string) {
  const c = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return gradients[c % gradients.length];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/* ── Component ────────────────────────────────────────────── */

export function CreateInvoiceModal({ open, onClose }: CreateInvoiceModalProps) {
  /* ── State ──────────────────────────────────────────────── */
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [terms, setTerms] = useState<PaymentTerms>("net_7");
  const [showTerms, setShowTerms] = useState(false);
  const [issueDate] = useState(new Date());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<{ id: string; description: string; qty: number; rate: number }[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [activeCatalogIdx, setActiveCatalogIdx] = useState(0);

  const [attachPdf, setAttachPdf] = useState(true);
  const [splitMenuOpen, setSplitMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const clientInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToastStore();
  const { createInvoiceServer } = useFinanceStore();
  const { orgId } = useOrg();
  const storeClients = useClientsStore((s) => s.clients);
  const allClients = storeClients.length > 0 ? storeClients : mockClients;
  const [saving, setSaving] = useState(false);

  /* ── Derived ────────────────────────────────────────────── */
  const filteredClients = useMemo(
    () =>
      clientQuery.length > 0
        ? allClients.filter(
            (c) =>
              c.name.toLowerCase().includes(clientQuery.toLowerCase()) ||
              (c.email || "").toLowerCase().includes(clientQuery.toLowerCase())
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

  const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.rate, 0);
  const taxRate = 0.1; // 10% GST
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  const dueDate = addDays(issueDate, paymentTerms.find((t) => t.value === terms)?.days || 7);

  const isValid = !!selectedClient && lineItems.length > 0 && total > 0;

  /* ── Reset on open ──────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setClientQuery("");
      setSelectedClient(null);
      setShowClientDropdown(false);
      setTerms("net_7");
      setShowTerms(false);
      setReference("");
      setNotes("");
      setLineItems([]);
      setCatalogQuery("");
      setShowCatalog(false);
      setAttachPdf(true);
      setSplitMenuOpen(false);
      setSent(false);
      setSaving(false);
      setTimeout(() => clientInputRef.current?.focus(), 120);
    }
  }, [open]);

  /* ── Client selection ───────────────────────────────────── */
  function selectClient(client: Client) {
    setSelectedClient(client);
    setClientQuery("");
    setShowClientDropdown(false);
    setTimeout(() => catalogInputRef.current?.focus(), 80);
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
      { id: `li-${Date.now()}-${Math.random()}`, description: name, qty: 1, rate: price },
    ]);
    setCatalogQuery("");
    setShowCatalog(false);
    setActiveCatalogIdx(0);
    setTimeout(() => catalogInputRef.current?.focus(), 50);
  }

  function addCustomItem() {
    if (!catalogQuery.trim()) return;
    setLineItems((prev) => [
      ...prev,
      { id: `li-${Date.now()}`, description: catalogQuery.trim(), qty: 1, rate: 0 },
    ]);
    setCatalogQuery("");
    setShowCatalog(false);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function updateLineItem(id: string, field: "description" | "qty" | "rate", value: string | number) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

  /* ── Save / Send ────────────────────────────────────────── */
  async function handleSubmit(mode: "send" | "draft" | "link") {
    if (!isValid || saving) return;

    // If org is available, persist to server
    if (orgId) {
      setSaving(true);
      const result = await createInvoiceServer({
        organization_id: orgId,
        client_id: selectedClient!.id,
        client_name: selectedClient!.name,
        client_email: selectedClient!.email || null,
        client_address: selectedClient!.address || null,
        status: mode === "send" ? "sent" : "draft",
        issue_date: issueDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        tax_rate: 10,
        notes: notes || null,
        line_items: lineItems.map((li) => ({
          description: li.description,
          quantity: li.qty,
          unit_price: li.rate,
        })),
      });
      setSaving(false);

      if (!result.success) {
        addToast(`Error: ${result.error || "Failed to create invoice"}`);
        return;
      }

      setSent(true);
      const invId = result.displayId || "INV-????";

      if (mode === "send") {
        addToast(`${invId} sent to ${selectedClient!.email} — $${total.toLocaleString()}`);
      } else if (mode === "draft") {
        addToast(`${invId} saved as draft`);
      } else if (mode === "link") {
        const payLink = `https://pay.iworkr.app/${invId.toLowerCase()}`;
        navigator.clipboard?.writeText(payLink);
        addToast(`${invId} created — Payment link copied`);
      }

      setTimeout(() => onClose(), 400);
      return;
    }

    // No org available — cannot persist invoice
    console.error("Cannot create invoice: no organization context");
    addToast("Unable to save — please refresh and try again");
    setSaving(false);
    return;
  }

  /* ── Keys ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit("send");
      }
      if (e.key === "Escape") {
        if (showCatalog) { setShowCatalog(false); return; }
        if (showClientDropdown) { setShowClientDropdown(false); return; }
        if (showTerms) { setShowTerms(false); return; }
        if (splitMenuOpen) { setSplitMenuOpen(false); return; }
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, showCatalog, showClientDropdown, showTerms, splitMenuOpen, selectedClient, lineItems, total]);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-[16px]"
            onClick={onClose}
          />

          {/* Stage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={sent ? { opacity: 0, scale: 0.92 } : { opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[7.5%] left-1/2 z-50 flex w-full max-w-[1100px] -translate-x-1/2 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121212]"
            style={{ height: "85vh", boxShadow: "0 40px 80px -12px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ═══════════════════════════════════════════════ */}
            {/* ZONE A: Constructor (Left Column - 40%)         */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="flex w-[40%] flex-col border-r border-[rgba(255,255,255,0.06)]">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
                <span className="text-[12px] text-zinc-600">
                  Finance <span className="text-zinc-700">/</span>{" "}
                  <span className="text-zinc-500">New Invoice</span>
                </span>
                <div className="flex items-center gap-2">
                  <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                    Esc
                  </kbd>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Scrollable constructor body */}
              <div className="flex-1 overflow-y-auto">
                {/* ── Client selector ─────────────────────── */}
                <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
                  {selectedClient ? (
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-zinc-300 ${getGrad(selectedClient.initials)}`}>
                        {selectedClient.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-zinc-200">
                            {selectedClient.name}
                          </span>
                          {/* Credit badge */}
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Good
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-600">{selectedClient.email}</div>
                      </div>
                      <button
                        onClick={clearClient}
                        className="rounded-md p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
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
                        placeholder="Bill to..."
                        className="w-full bg-transparent text-[18px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
                      />

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
                                  <div className="truncate text-[10px] text-zinc-600">{c.email}</div>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* ── Meta properties grid ────────────────── */}
                <div className="grid grid-cols-2 gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
                  {/* Terms */}
                  <div>
                    <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                      Terms
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowTerms(!showTerms)}
                        className="flex w-full items-center justify-between rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-left text-[12px] text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)]"
                      >
                        {paymentTerms.find((t) => t.value === terms)?.label}
                        <ChevronDown size={10} className="text-zinc-600" />
                      </button>
                      <AnimatePresence>
                        {showTerms && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.1 }}
                            className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
                          >
                            {paymentTerms.map((t) => (
                              <button
                                key={t.value}
                                onClick={() => { setTerms(t.value); setShowTerms(false); }}
                                className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                                  terms === t.value ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Issue date */}
                  <div>
                    <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                      Date
                    </label>
                    <div className="rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[12px] text-zinc-400">
                      {formatDate(issueDate)}
                    </div>
                  </div>

                  {/* Due date (auto-calculated) */}
                  <div>
                    <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                      Due Date
                    </label>
                    <div className="rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[12px] text-zinc-300">
                      {formatDate(dueDate)}
                    </div>
                  </div>

                  {/* Reference */}
                  <div>
                    <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                      Reference
                    </label>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="PO number..."
                      className="w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-2.5 py-1.5 text-[12px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>

                {/* ── Line item engine ────────────────────── */}
                <div className="px-5 py-4">
                  <label className="mb-2 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                    Line Items
                  </label>

                  {/* Existing items */}
                  <div className="mb-3 space-y-1">
                    <AnimatePresence>
                      {lineItems.map((li) => (
                        <motion.div
                          key={li.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.15 }}
                          className="group flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
                        >
                          <input
                            value={li.description}
                            onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-300 outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={li.qty || ""}
                              onChange={(e) => updateLineItem(li.id, "qty", Number(e.target.value) || 0)}
                              className="w-10 bg-transparent text-center text-[11px] text-zinc-400 outline-none"
                              placeholder="Qty"
                              min={1}
                            />
                            <span className="text-[10px] text-zinc-700">×</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[10px] text-zinc-600">$</span>
                              <input
                                type="number"
                                value={li.rate || ""}
                                onChange={(e) => updateLineItem(li.id, "rate", Number(e.target.value) || 0)}
                                className="w-16 bg-transparent text-right text-[12px] font-medium text-zinc-300 outline-none"
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <span className="w-14 text-right text-[11px] font-medium text-zinc-500">
                            ${(li.qty * li.rate).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeLineItem(li.id)}
                            className="rounded-md p-0.5 text-zinc-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          >
                            <Trash2 size={10} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Add item input */}
                  <div className="relative">
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-[rgba(255,255,255,0.08)] px-3 py-2 transition-colors focus-within:border-[#5E6AD2]/40">
                      <Plus size={12} className="shrink-0 text-zinc-600" />
                      <input
                        ref={catalogInputRef}
                        value={catalogQuery}
                        onChange={(e) => {
                          setCatalogQuery(e.target.value);
                          setShowCatalog(e.target.value.length > 0);
                          setActiveCatalogIdx(0);
                        }}
                        onFocus={() => {
                          if (catalogQuery.length > 0) setShowCatalog(true);
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
                        placeholder="Search price book or type description..."
                        className="w-full bg-transparent text-[12px] text-zinc-400 outline-none placeholder:text-zinc-700"
                      />
                    </div>

                    {/* Catalog dropdown */}
                    <AnimatePresence>
                      {showCatalog && filteredCatalog.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 max-h-[180px] overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Notes */}
                  <div className="mt-4">
                    <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-600 uppercase">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Payment instructions, terms..."
                      rows={2}
                      className="w-full resize-none rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-2.5 py-1.5 text-[12px] text-zinc-400 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#5E6AD2]"
                    />
                  </div>
                </div>
              </div>

              {/* ── Action bar (fixed bottom left) ────────── */}
              <div className="flex shrink-0 items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
                {/* Attach PDF toggle */}
                <label className="flex items-center gap-2 text-[11px] text-zinc-600">
                  <button
                    onClick={() => setAttachPdf(!attachPdf)}
                    className={`relative h-[16px] w-[28px] rounded-full transition-colors ${attachPdf ? "bg-[#5E6AD2]" : "bg-zinc-700"}`}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-[2px] h-3 w-3 rounded-full bg-white"
                      style={{ left: attachPdf ? 13 : 2 }}
                    />
                  </button>
                  <Paperclip size={10} className="text-zinc-600" />
                  Attach PDF
                </label>

                {/* Split button */}
                <div className="relative flex items-center">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubmit("send")}
                    disabled={!isValid}
                    className="flex items-center gap-2 rounded-l-md bg-gradient-to-r from-[#5E6AD2] to-[#4F46E5] px-3.5 py-1.5 text-[12px] font-medium text-white transition-all hover:from-[#6E7AE2] hover:to-[#6366F1] disabled:opacity-30"
                  >
                    {sent ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      >
                        <Check size={14} />
                      </motion.div>
                    ) : (
                      <>
                        <Send size={11} />
                        Send Invoice
                      </>
                    )}
                    <kbd className="rounded bg-[rgba(255,255,255,0.15)] px-1 py-0.5 font-mono text-[9px]">
                      ⌘↵
                    </kbd>
                  </motion.button>

                  <button
                    onClick={() => setSplitMenuOpen(!splitMenuOpen)}
                    disabled={!isValid}
                    className="flex h-[32px] items-center rounded-r-md border-l border-[rgba(255,255,255,0.2)] bg-gradient-to-r from-[#5E6AD2] to-[#4F46E5] px-1.5 text-white transition-colors hover:from-[#6E7AE2] hover:to-[#6366F1] disabled:opacity-30"
                  >
                    <ChevronDown size={11} />
                  </button>

                  {/* Split dropdown */}
                  <AnimatePresence>
                    {splitMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute bottom-full right-0 z-20 mb-2 w-[200px] overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
                      >
                        <button
                          onClick={() => { setSplitMenuOpen(false); handleSubmit("send"); }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                          <Send size={12} />
                          Send Invoice
                        </button>
                        <button
                          onClick={() => { setSplitMenuOpen(false); handleSubmit("draft"); }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                          <FileText size={12} />
                          Save Draft
                        </button>
                        <button
                          onClick={() => { setSplitMenuOpen(false); handleSubmit("link"); }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                          <CreditCard size={12} />
                          Get Payment Link
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* ZONE B: Paper Preview (Right Column - 60%)      */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="flex w-[60%] items-start justify-center overflow-y-auto bg-[#0a0a0a] p-6">
              <motion.div
                layout
                className="w-full max-w-[520px] rounded-sm bg-[#F5F5F7] p-8 shadow-2xl"
                style={{ minHeight: 680 }}
              >
                {/* ── Brand header ─────────────────────────── */}
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black text-[10px] font-bold text-white">
                        iW
                      </div>
                      <span className="text-[14px] font-semibold text-zinc-900">Apex Plumbing</span>
                    </div>
                    <div className="text-[10px] leading-relaxed text-zinc-500">
                      ABN 12 345 678 901<br />
                      15 River Terrace, Brisbane 4000<br />
                      hello@apexplumbing.com.au
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-bold tracking-tight text-zinc-900">INVOICE</div>
                    <div className="text-[10px] text-zinc-500">
                      {selectedClient ? `INV-XXXX` : "—"}
                    </div>
                  </div>
                </div>

                {/* ── Bill to / meta ───────────────────────── */}
                <div className="mb-6 flex justify-between">
                  <div>
                    <div className="mb-0.5 text-[8px] font-medium tracking-wider text-zinc-400 uppercase">Bill To</div>
                    {selectedClient ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="text-[11px] font-medium text-zinc-900">{selectedClient.name}</div>
                        <div className="text-[10px] text-zinc-500">{selectedClient.email}</div>
                        {selectedClient.address && (
                          <div className="text-[10px] text-zinc-500">{selectedClient.address}</div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-[11px] italic text-zinc-400">Awaiting client...</div>
                    )}
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="flex justify-end gap-4">
                      <div>
                        <div className="mb-0.5 text-[8px] font-medium tracking-wider text-zinc-400 uppercase">Date</div>
                        <div className="text-zinc-700">{formatDate(issueDate)}</div>
                      </div>
                      <div>
                        <div className="mb-0.5 text-[8px] font-medium tracking-wider text-zinc-400 uppercase">Due</div>
                        <div className="text-zinc-700">{formatDate(dueDate)}</div>
                      </div>
                    </div>
                    {reference && (
                      <div className="mt-1 text-[9px] text-zinc-400">Ref: {reference}</div>
                    )}
                  </div>
                </div>

                {/* ── Line items table ──────────────────────── */}
                <div className="mb-6">
                  {/* Table header */}
                  <div className="flex border-b border-zinc-300 pb-1.5 text-[8px] font-medium tracking-wider text-zinc-400 uppercase">
                    <div className="flex-1">Description</div>
                    <div className="w-10 text-center">Qty</div>
                    <div className="w-16 text-right">Rate</div>
                    <div className="w-16 text-right">Amount</div>
                  </div>

                  {/* Rows */}
                  <AnimatePresence>
                    {lineItems.length > 0 ? (
                      lineItems.map((li) => (
                        <motion.div
                          key={li.id}
                          initial={{ opacity: 0.5, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="flex border-b border-zinc-200 py-2 text-[10px]"
                        >
                          <div className="flex-1 text-zinc-800">{li.description}</div>
                          <div className="w-10 text-center text-zinc-600">{li.qty}</div>
                          <div className="w-16 text-right text-zinc-600">${li.rate.toLocaleString()}</div>
                          <div className="w-16 text-right font-medium text-zinc-800">
                            ${(li.qty * li.rate).toLocaleString()}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-[11px] italic text-zinc-400">
                        Add items on the left...
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Totals block ──────────────────────────── */}
                <div className="flex justify-end">
                  <div className="w-48">
                    <div className="flex items-center justify-between border-b border-zinc-200 py-1.5 text-[10px]">
                      <span className="text-zinc-500">Subtotal</span>
                      <motion.span
                        key={subtotal}
                        initial={{ opacity: 0.5, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-zinc-800"
                      >
                        ${subtotal.toLocaleString()}
                      </motion.span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-200 py-1.5 text-[10px]">
                      <span className="text-zinc-500">GST (10%)</span>
                      <motion.span
                        key={tax}
                        initial={{ opacity: 0.5, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-zinc-800"
                      >
                        ${tax.toLocaleString()}
                      </motion.span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-[11px] font-semibold text-zinc-900">Total Due</span>
                      <motion.span
                        key={total}
                        initial={{ opacity: 0.5, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="text-[16px] font-bold text-zinc-900"
                      >
                        ${total.toLocaleString()}
                      </motion.span>
                    </div>
                  </div>
                </div>

                {/* ── Notes ─────────────────────────────────── */}
                {notes && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 border-t border-zinc-200 pt-3"
                  >
                    <div className="mb-0.5 text-[8px] font-medium tracking-wider text-zinc-400 uppercase">Notes</div>
                    <div className="text-[10px] leading-relaxed text-zinc-600">{notes}</div>
                  </motion.div>
                )}

                {/* ── Footer ────────────────────────────────── */}
                <div className="mt-8 border-t border-zinc-200 pt-3 text-center text-[8px] text-zinc-400">
                  Thank you for your business — Apex Plumbing Pty Ltd
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
