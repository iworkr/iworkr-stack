"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  FileText,
  CreditCard,
  ChevronDown,
  Check,
  CheckCircle,
  GripVertical,
  Save,
  Eye,
  X,
  Search,
  Percent,
  DollarSign,
  Loader2,
  Copy,
  ExternalLink,
  Link2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/lib/auth-store";
import { useClientsStore } from "@/lib/clients-store";
import { useFinanceStore } from "@/lib/finance-store";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import type { InvoiceData, InvoiceLineItemData, WorkspaceBrand } from "@/components/pdf/invoice-types";
import { calcInvoiceTotals, formatCurrency } from "@/components/pdf/invoice-types";
import { InvoiceDocument } from "@/components/pdf/invoice-document";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <PDFSkeleton /> },
);

/* ── Config ───────────────────────────────────────────────── */

type PaymentTerms = "due_receipt" | "net_7" | "net_14" | "net_30";

const TERMS: { value: PaymentTerms; label: string; days: number }[] = [
  { value: "due_receipt", label: "Due on Receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_14", label: "Net 14", days: 14 },
  { value: "net_30", label: "Net 30", days: 30 },
];

const CATALOG = [
  { name: "Standard Callout Fee", price: 120 },
  { name: "Boiler Service — Annual", price: 450 },
  { name: "Hot Water System Inspection", price: 180 },
  { name: "Blocked Drain — CCTV & Jetting", price: 680 },
  { name: "Pipe Repair — Copper", price: 350 },
  { name: "Tap Replacement", price: 220 },
  { name: "Toilet Replacement", price: 480 },
  { name: "Gas Compliance Certificate", price: 200 },
  { name: "Emergency Call-out Surcharge", price: 110 },
  { name: "Kitchen Repipe — Copper to PEX", price: 3800 },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ── Skeleton ─────────────────────────────────────────────── */

function PDFSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950/50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
        <span className="text-xs text-zinc-600">Loading preview…</span>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function InvoiceBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId } = useOrg();
  const { currentOrg } = useAuthStore();
  const storeClients = useClientsStore((s) => s.clients);
  const { createInvoiceServer } = useFinanceStore();
  const { addToast } = useToastStore();

  /* Pre-fill from job if passed via query param */
  const prefillJobId = searchParams.get("job_id");
  const prefillClientId = searchParams.get("client_id");

  /* ── Form State ─────────────────────────────────────────── */
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    email?: string | null;
    address?: string | null;
  } | null>(null);
  const [showClientDD, setShowClientDD] = useState(false);
  const clientRef = useRef<HTMLInputElement>(null);

  const [terms, setTerms] = useState<PaymentTerms>("net_7");
  const [showTerms, setShowTerms] = useState(false);
  const [issueDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(10);

  const [discountType, setDiscountType] = useState<"percent" | "fixed" | null>(null);
  const [discountValue, setDiscountValue] = useState(0);

  const [lineItems, setLineItems] = useState<
    { id: string; description: string; qty: number; rate: number; taxOverride: number | null }[]
  >([]);

  const [catalogQuery, setCatalogQuery] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const catalogRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<{ displayId: string; invoiceId: string; paymentLink: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  /* ── Auto-select client from query ──────────────────────── */
  useEffect(() => {
    if (prefillClientId && storeClients.length > 0 && !selectedClient) {
      const c = storeClients.find((cl: any) => cl.id === prefillClientId);
      if (c) setSelectedClient({ id: c.id, name: c.name, email: c.email, address: c.address });
    }
  }, [prefillClientId, storeClients, selectedClient]);

  /* PDF preview becomes ready after initial render */
  useEffect(() => {
    const t = setTimeout(() => setPdfReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  /* ── Derived ────────────────────────────────────────────── */
  const filteredClients = useMemo(
    () =>
      clientQuery.length > 0
        ? storeClients.filter(
            (c: any) =>
              c.name?.toLowerCase().includes(clientQuery.toLowerCase()) ||
              (c.email || "").toLowerCase().includes(clientQuery.toLowerCase()),
          )
        : [],
    [clientQuery, storeClients],
  );

  const filteredCatalog = useMemo(
    () =>
      catalogQuery.length > 0
        ? CATALOG.filter((ci) => ci.name.toLowerCase().includes(catalogQuery.toLowerCase()))
        : CATALOG,
    [catalogQuery],
  );

  const dueDate = addDays(issueDate, TERMS.find((t) => t.value === terms)?.days || 7);

  const pdfLineItems: InvoiceLineItemData[] = useMemo(
    () =>
      lineItems.map((li, i) => ({
        id: li.id,
        description: li.description || "Untitled item",
        quantity: li.qty || 0,
        unit_price: li.rate || 0,
        tax_rate_percent: li.taxOverride,
        sort_order: i,
      })),
    [lineItems],
  );

  const totals = useMemo(
    () => calcInvoiceTotals(pdfLineItems, taxRate, discountType, discountValue),
    [pdfLineItems, taxRate, discountType, discountValue],
  );

  const invoiceData: InvoiceData = useMemo(
    () => ({
      display_id: "INV-DRAFT",
      status: "draft",
      issue_date: dateStr(issueDate),
      due_date: dateStr(dueDate),
      paid_date: null,
      client_name: selectedClient?.name || "Select a client…",
      client_email: selectedClient?.email || null,
      client_address: selectedClient?.address || null,
      line_items: pdfLineItems,
      subtotal: totals.subtotal,
      tax_rate: taxRate,
      tax: totals.taxTotal,
      discount_type: discountType,
      discount_value: discountValue,
      discount_total: totals.discountTotal,
      total: totals.total,
      notes: notes || null,
      payment_link: null,
    }),
    [selectedClient, pdfLineItems, totals, issueDate, dueDate, taxRate, discountType, discountValue, notes],
  );

  const workspace: WorkspaceBrand = useMemo(
    () => ({
      name: currentOrg?.name || "Your Company",
      logo_url: (currentOrg as any)?.brand_logo_url || (currentOrg as any)?.logo_url || null,
      brand_color_hex: (currentOrg as any)?.brand_color_hex || "#10B981",
      tax_id: (currentOrg as any)?.settings?.tax_id || null,
      address: (currentOrg as any)?.settings?.address || null,
      email: (currentOrg as any)?.settings?.email || null,
      phone: (currentOrg as any)?.settings?.phone || null,
    }),
    [currentOrg],
  );

  const isValid = !!selectedClient && lineItems.length > 0 && totals.total > 0;

  /* ── Actions ────────────────────────────────────────────── */
  function addItem(desc: string, price: number) {
    setLineItems((prev) => [
      ...prev,
      { id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, description: desc, qty: 1, rate: price, taxOverride: null },
    ]);
    setCatalogQuery("");
    setShowCatalog(false);
  }

  function addCustomItem() {
    if (!catalogQuery.trim()) return;
    addItem(catalogQuery.trim(), 0);
  }

  function removeItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function updateItem(id: string, field: string, value: string | number | null) {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  }

  const handleSave = useCallback(
    async (mode: "draft" | "send") => {
      if (!isValid || saving || !orgId) return;
      setSaving(true);
      try {
        const result = await createInvoiceServer({
          organization_id: orgId,
          client_id: selectedClient!.id,
          client_name: selectedClient!.name,
          client_email: selectedClient!.email || null,
          client_address: selectedClient!.address || null,
          job_id: prefillJobId || null,
          status: mode === "send" ? "sent" : "draft",
          issue_date: dateStr(issueDate),
          due_date: dateStr(dueDate),
          tax_rate: taxRate,
          notes: notes || null,
          line_items: lineItems.map((li) => ({
            description: li.description,
            quantity: li.qty,
            unit_price: li.rate,
          })),
        });
        if (result.success && result.invoiceId) {
          const payLink = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/pay/${result.invoiceId}`;
          setSavedInvoice({
            displayId: result.displayId || "Invoice",
            invoiceId: result.invoiceId,
            paymentLink: payLink,
          });
          addToast(mode === "send" ? "Invoice sent" : "Invoice saved as draft");
        } else if (result.success) {
          addToast(mode === "send" ? "Invoice sent" : "Invoice saved as draft");
          router.push("/dashboard/finance");
        } else {
          addToast(`Error: ${result.error || "Failed to save"}`);
        }
      } finally {
        setSaving(false);
      }
    },
    [isValid, saving, orgId, selectedClient, prefillJobId, issueDate, dueDate, taxRate, notes, lineItems, createInvoiceServer, addToast, router],
  );

  function handleCopyLink() {
    if (!savedInvoice) return;
    navigator.clipboard?.writeText(savedInvoice.paymentLink);
    setLinkCopied(true);
    addToast("Payment link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  /* ── Render ─────────────────────────────────────────────── */

  if (savedInvoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0a0a0a] px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-zinc-100">
            {savedInvoice.displayId} Created
          </h2>
          <p className="mb-6 text-sm text-zinc-500">
            Your invoice is ready. Share the payment link with your client.
          </p>

          <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <label className="mb-2 block text-left font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Payment Link
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-950 px-3 py-2.5">
              <Link2 size={13} className="shrink-0 text-zinc-600" />
              <span className="min-w-0 flex-1 truncate text-left text-[12px] text-zinc-400">
                {savedInvoice.paymentLink}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
              >
                {linkCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
            <button
              onClick={handleCopyLink}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <Copy size={13} />
              {linkCopied ? "Copied!" : "Copy Payment Link"}
            </button>
            <button
              onClick={() => window.open(savedInvoice.paymentLink, "_blank")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <ExternalLink size={13} />
              Preview Payment Portal
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/finance/invoices/${savedInvoice.displayId}`)}
              className="flex-1 rounded-lg border border-white/[0.06] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              View Invoice
            </button>
            <button
              onClick={() => router.push("/dashboard/finance")}
              className="flex-1 rounded-lg border border-white/[0.06] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              Back to Finance
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0a]">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/finance")}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-zinc-200">New Invoice</h1>
            <p className="text-[10px] text-zinc-600">WYSIWYG Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!isValid || saving}
            onClick={() => handleSave("draft")}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-40"
          >
            <Save size={12} />
            Save Draft
          </button>
          <button
            disabled={!isValid || saving}
            onClick={() => handleSave("send")}
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-[11px] font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send Invoice
          </button>
        </div>
      </div>

      {/* ── Split Pane ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Form ────────────────────────────────────── */}
        <div className="w-[480px] shrink-0 overflow-y-auto border-r border-white/[0.06] p-5">
          {/* Client Selector */}
          <div className="mb-6">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Bill To
            </label>
            {selectedClient ? (
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-zinc-200">{selectedClient.name}</div>
                  {selectedClient.email && (
                    <div className="text-[10px] text-zinc-600">{selectedClient.email}</div>
                  )}
                </div>
                <button onClick={() => setSelectedClient(null)} className="text-zinc-600 hover:text-zinc-400">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  ref={clientRef}
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                    setShowClientDD(true);
                  }}
                  onFocus={() => setShowClientDD(true)}
                  placeholder="Search clients…"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30"
                />
                <AnimatePresence>
                  {showClientDD && filteredClients.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/[0.08] bg-zinc-900 shadow-2xl"
                    >
                      {filteredClients.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedClient({ id: c.id, name: c.name, email: c.email, address: c.address });
                            setClientQuery("");
                            setShowClientDD(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                            {c.name?.[0] || "?"}
                          </div>
                          <div>
                            <div className="text-xs font-medium">{c.name}</div>
                            {c.email && <div className="text-[10px] text-zinc-600">{c.email}</div>}
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Dates & Terms */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
                Issue Date
              </label>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">
                {issueDate.toLocaleDateString("en-AU")}
              </div>
            </div>
            <div className="relative">
              <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
                Payment Terms
              </label>
              <button
                onClick={() => setShowTerms(!showTerms)}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300"
              >
                {TERMS.find((t) => t.value === terms)?.label}
                <ChevronDown size={12} className="text-zinc-600" />
              </button>
              <AnimatePresence>
                {showTerms && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/[0.08] bg-zinc-900 shadow-2xl"
                  >
                    {TERMS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => {
                          setTerms(t.value);
                          setShowTerms(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]"
                      >
                        {t.label}
                        {t.value === terms && <Check size={12} className="text-emerald-400" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tax Rate */}
          <div className="mb-6">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Tax Rate (%)
            </label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value)))}
              className="w-24 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
            />
          </div>

          {/* ── Line Items ──────────────────────────────────── */}
          <div className="mb-4">
            <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Line Items
            </label>
            <div className="space-y-2">
              {lineItems.map((li) => (
                <motion.div
                  key={li.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className="mt-1 shrink-0 cursor-grab text-zinc-700" />
                    <div className="flex-1 space-y-2">
                      <input
                        value={li.description}
                        onChange={(e) => updateItem(li.id, "description", e.target.value)}
                        placeholder="Description"
                        className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                      />
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-600">Qty</span>
                          <input
                            type="number"
                            value={li.qty}
                            onChange={(e) => updateItem(li.id, "qty", Math.max(0, Number(e.target.value)))}
                            className="w-16 rounded border border-white/[0.06] bg-transparent px-2 py-1 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-600">$</span>
                          <input
                            type="number"
                            value={li.rate}
                            onChange={(e) => updateItem(li.id, "rate", Math.max(0, Number(e.target.value)))}
                            className="w-24 rounded border border-white/[0.06] bg-transparent px-2 py-1 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
                          />
                        </div>
                        <div className="ml-auto font-mono text-xs font-semibold text-zinc-300">
                          {formatCurrency(Math.round(li.qty * li.rate * 100) / 100)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(li.id)}
                      className="shrink-0 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Add Item */}
          <div className="relative mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  ref={catalogRef}
                  value={catalogQuery}
                  onChange={(e) => {
                    setCatalogQuery(e.target.value);
                    setShowCatalog(true);
                  }}
                  onFocus={() => setShowCatalog(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomItem();
                  }}
                  placeholder="Add item from catalog or type custom…"
                  className="w-full rounded-lg border border-dashed border-white/[0.08] bg-transparent py-2 pl-9 pr-3 text-xs text-zinc-400 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30"
                />
              </div>
              <button
                onClick={addCustomItem}
                className="shrink-0 rounded-lg border border-white/[0.06] p-2 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              >
                <Plus size={14} />
              </button>
            </div>
            <AnimatePresence>
              {showCatalog && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/[0.08] bg-zinc-900 shadow-2xl"
                >
                  {filteredCatalog.map((ci) => (
                    <button
                      key={ci.name}
                      onClick={() => addItem(ci.name, ci.price)}
                      className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.04]"
                    >
                      <span>{ci.name}</span>
                      <span className="font-mono text-zinc-500">{formatCurrency(ci.price)}</span>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && catalogQuery && (
                    <div className="px-3 py-2 text-xs text-zinc-600">
                      Press Enter to add &quot;{catalogQuery}&quot; as custom item
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Discount */}
          <div className="mb-6">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Discount
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDiscountType(discountType === "percent" ? null : "percent")}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  discountType === "percent"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Percent size={11} /> Percentage
              </button>
              <button
                onClick={() => setDiscountType(discountType === "fixed" ? null : "fixed")}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  discountType === "fixed"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <DollarSign size={11} /> Fixed Amount
              </button>
              {discountType && (
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                  placeholder={discountType === "percent" ? "%" : "$"}
                  className="w-20 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
                />
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment instructions, warranty info, thank-you message…"
              className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30"
            />
          </div>

          {/* Totals Summary */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-zinc-500">Subtotal</span>
              <span className="font-mono text-xs text-zinc-300">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-500">
                  Discount {discountType === "percent" ? `(${discountValue}%)` : ""}
                </span>
                <span className="font-mono text-xs text-red-400">-{formatCurrency(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-zinc-500">GST ({taxRate}%)</span>
              <span className="font-mono text-xs text-zinc-300">{formatCurrency(totals.taxTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-sm font-bold text-zinc-200">Total</span>
              <span className="font-mono text-lg font-bold text-emerald-400">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Right: PDF Preview ────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950/30">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
            <Eye size={13} className="text-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-zinc-600">
              Live Preview
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {pdfReady && (
              <div className="rounded-lg bg-zinc-900/50" style={{ height: "100%", minHeight: 720 }}>
                <PDFViewer
                  width="100%"
                  height="100%"
                  showToolbar={false}
                >
                <InvoiceDocument data={invoiceData} workspace={workspace} />
                </PDFViewer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
