/**
 * @page /dashboard/finance/invoicing
 * @status COMPLETE
 * @description Billing invoices list with filters, batch actions, and send/export
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Zap, Filter, ChevronRight, X, Edit2, Check, ArrowLeft,
  Download, AlertTriangle, Clock, DollarSign, TrendingUp,
  Mail, CreditCard, Archive, CheckSquare, Square, RotateCcw,
  ArrowRight, Send, FileText, ExternalLink
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import {
  getBillingInvoices,
  getBillingTelemetry,
  runBillingBatch,
  dispatchInvoice,
  bulkDispatchInvoices,
  markInvoicesPaid,
  getInvoiceDetail,
  overrideLineItem,
  type BillingInvoice,
  type InvoiceLineItem,
  type BillingTelemetry,
  type FundingType,
} from "@/app/actions/billing";

// Lazy load the PDF components (heavy, client-only)
const NdisInvoicePdfPreview = dynamic(
  () => import("@/components/finance/ndis-invoice-pdf").then((m) => m.NdisInvoicePdfPreview),
  { ssr: false, loading: () => <div className="h-[300px] bg-zinc-900 rounded flex items-center justify-center text-zinc-500 text-xs">Loading PDF renderer…</div> },
);
const NdisInvoiceDownloadButton = dynamic(
  () => import("@/components/finance/ndis-invoice-pdf").then((m) => m.NdisInvoiceDownloadButton),
  { ssr: false },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number | null | undefined, compact = false): string {
  const n = Number(val ?? 0);
  if (compact && n >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`;
  }
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FUNDING_CONFIG: Record<FundingType, { label: string; classes: string }> = {
  plan_managed:  { label: "Plan Managed", classes: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
  self_managed:  { label: "Self Managed", classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  ndia_managed:  { label: "NDIA Managed", classes: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
};

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft:   { label: "Draft",   classes: "bg-zinc-800 text-zinc-400 border border-zinc-700" },
  sent:    { label: "Sent",    classes: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  viewed:  { label: "Viewed",  classes: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  paid:    { label: "Paid",    classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  overdue: { label: "Overdue", classes: "bg-rose-500/10 text-rose-400 border border-rose-500/20" },
  void:    { label: "Void",    classes: "bg-zinc-800 text-zinc-600 border border-zinc-700" },
};

function GhostBadge({ label, classes }: { label: string; classes: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

type TabKey = "draft" | "sent" | "overdue" | "paid" | "proda";
const TABS: { key: TabKey; label: string }[] = [
  { key: "draft", label: "Ready to Bill" },
  { key: "sent",  label: "Sent / Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "paid",  label: "Paid" },
  { key: "proda", label: "PRODA Queue" },
];

// ─── Telemetry Ribbon ─────────────────────────────────────────────────────────

function TelemetryRibbon({ telemetry, loading }: { telemetry: BillingTelemetry | null; loading: boolean }) {
  const metrics = [
    {
      label: "Unbilled Approved Time",
      value: telemetry?.unbilled_value ?? 0,
      icon: Clock,
      alert: false,
    },
    {
      label: "Draft Value",
      value: telemetry?.draft_value ?? 0,
      icon: FileText,
      alert: false,
    },
    {
      label: "Total Outstanding",
      value: telemetry?.outstanding ?? 0,
      icon: DollarSign,
      alert: false,
    },
    {
      label: "Overdue (>30D)",
      value: telemetry?.overdue ?? 0,
      icon: AlertTriangle,
      alert: (telemetry?.overdue ?? 0) > 0,
    },
    {
      label: "Revenue YTD",
      value: telemetry?.ytd_revenue ?? 0,
      icon: TrendingUp,
      alert: false,
    },
  ];

  return (
    <div className="h-16 w-full flex items-center px-8 border-b border-white/5 bg-zinc-950/30 overflow-x-auto gap-8 shrink-0">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <div key={i} className="flex items-center gap-3 shrink-0">
            <div className={`w-6 h-6 rounded flex items-center justify-center ${m.alert ? "bg-rose-500/20" : "bg-zinc-800/60"}`}>
              <Icon className={`w-3 h-3 ${m.alert ? "text-rose-400" : "text-zinc-500"}`} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest whitespace-nowrap">{m.label}</p>
              {loading ? (
                <div className="w-16 h-4 bg-zinc-800 rounded animate-pulse mt-1" />
              ) : (
                <p
                  className={`text-[20px] leading-none mt-0.5 tracking-tight ${
                    m.alert
                      ? "font-bold text-rose-500 animate-pulse"
                      : "text-white"
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                >
                  {formatAUD(m.value)}
                </p>
              )}
            </div>
            {i < metrics.length - 1 && <div className="w-px h-8 bg-white/5 ml-4" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Invoice Slide-Over ───────────────────────────────────────────────────────

interface SlideOverProps {
  invoice: BillingInvoice | null;
  lineItems: InvoiceLineItem[];
  orgMeta: { name: string; abn: string; ndis_reg: string } | null;
  onClose: () => void;
  onDispatched: () => void;
}

function InvoiceSlideOver({ invoice, lineItems, orgMeta, onClose, onDispatched }: SlideOverProps) {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState<string>("");
  const [editRate, setEditRate] = useState<string>("");
  const [localItems, setLocalItems] = useState<InvoiceLineItem[]>(lineItems);
  const [localTotal, setLocalTotal] = useState(invoice?.total ?? 0);
  const [planEmail, setPlanEmail] = useState(invoice?.plan_manager_email || "");
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(lineItems);
    setLocalTotal(invoice?.total ?? 0);
    setPlanEmail(invoice?.plan_manager_email || "");
  }, [lineItems, invoice]);

  if (!invoice) return null;

  const fundingType = invoice.funding_type as FundingType;
  const funding = FUNDING_CONFIG[fundingType] || FUNDING_CONFIG.plan_managed;

  function startEdit(li: InvoiceLineItem) {
    setEditingId(li.id);
    setEditHours(String(li.hours ?? li.quantity ?? ""));
    setEditRate(String(li.rate ?? li.unit_price ?? ""));
  }

  async function saveOverride(li: InvoiceLineItem) {
    if (!orgId) return;
    startTransition(async () => {
      const h = parseFloat(editHours);
      const r = parseFloat(editRate);
      if (isNaN(h) || isNaN(r)) { addToast("Invalid values", undefined, "error"); return; }
      const { ok, newTotal, error } = await overrideLineItem(li.id, invoice!.id, orgId!, {
        hours: h, rate: r, override_reason: "Manual override by admin",
      });
      if (!ok || error) { addToast(error || "Override failed", undefined, "error"); return; }
      setLocalItems((prev) =>
        prev.map((x) =>
          x.id === li.id
            ? { ...x, hours: h, rate: r, quantity: h, unit_price: r, line_total: Math.round(h * r * 100) / 100, is_override: true }
            : x,
        ),
      );
      setLocalTotal(newTotal);
      setEditingId(null);
      addToast("Line item updated");
    });
  }

  async function handleDispatch() {
    if (!orgId) return;
    setDispatchError(null);
    startTransition(async () => {
      const { ok, error } = await dispatchInvoice(
        invoice!.id,
        orgId,
        fundingType === "plan_managed" ? planEmail : undefined,
      );
      if (!ok) { setDispatchError(error || "Dispatch failed"); addToast(error || "Dispatch failed", undefined, "error"); return; }
      addToast(
        fundingType === "ndia_managed"
          ? "Moved to PRODA Queue"
          : "Invoice dispatched successfully",
      );
      onDispatched();
      onClose();
    });
  }

  const isNdia = fundingType === "ndia_managed";
  const isSelf = fundingType === "self_managed";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" />
      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-[700px] h-full bg-zinc-950 border-l border-white/5 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="text-[16px] text-white tracking-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {invoice.display_id}
            </span>
            <GhostBadge label={funding.label} classes={funding.classes} />
            {invoice.status !== "draft" && (
              <GhostBadge
                label={STATUS_CONFIG[invoice.status]?.label || invoice.status}
                classes={STATUS_CONFIG[invoice.status]?.classes || ""}
              />
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Participant + meta row */}
        <div className="px-6 py-3 border-b border-white/5 bg-zinc-900/30 shrink-0">
          <p className="text-sm text-white font-medium">{invoice.participant_name}</p>
          <div className="flex items-center gap-4 mt-1">
            {invoice.ndis_participant_number && (
              <span className="text-[10px] text-zinc-500 font-mono">
                NDIS # {invoice.ndis_participant_number}
              </span>
            )}
            {invoice.billing_period_start && (
              <span className="text-[10px] text-zinc-500">
                {invoice.billing_period_start}{invoice.billing_period_end ? ` – ${invoice.billing_period_end}` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* PDF Preview */}
          <div className="px-6 pt-4 pb-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Invoice Preview</p>
            {orgMeta && (
              <div className="rounded-lg overflow-hidden border border-white/5">
                <NdisInvoicePdfPreview
                  invoice={{ ...invoice, total: localTotal }}
                  lineItems={localItems}
                  orgMeta={orgMeta}
                />
              </div>
            )}
            <div className="flex justify-end mt-2">
              {orgMeta && (
                <NdisInvoiceDownloadButton
                  invoice={{ ...invoice, total: localTotal }}
                  lineItems={localItems}
                  orgMeta={orgMeta}
                />
              )}
            </div>
          </div>

          {/* Line Item Ledger */}
          <div className="px-6 pb-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 mt-2">Line Items</p>
            <div className="border border-white/5 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60">
                    {["Date", "Support Code", "Description", "Hrs", "Rate", "Total", ""].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {localItems.map((li) => {
                    const isEditing = editingId === li.id;
                    const h = Number(li.hours ?? li.quantity ?? 0);
                    const r = Number(li.rate ?? li.unit_price ?? 0);
                    const total = Number(li.line_total != null ? li.line_total : h * r);
                    return (
                      <tr
                        key={li.id}
                        className="border-t border-white/5 hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-3 py-2 text-[11px] font-mono text-zinc-400">{li.shift_date || "—"}</td>
                        <td className="px-3 py-2 text-[10px] font-mono text-zinc-400 whitespace-nowrap">
                          {li.ndis_support_item_number || "—"}
                          {li.is_override && (
                            <span className="ml-1 text-amber-500" title="Manually overridden">*</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-zinc-300 max-w-[120px] truncate">{li.description}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-300">
                          {isEditing ? (
                            <input
                              value={editHours}
                              onChange={(e) => setEditHours(e.target.value)}
                              className="w-14 bg-zinc-800 border border-emerald-500/50 rounded px-1 py-0.5 text-white text-[11px] font-mono"
                              autoFocus
                            />
                          ) : (
                            `${h.toFixed(2)}`
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-300">
                          {isEditing ? (
                            <input
                              value={editRate}
                              onChange={(e) => setEditRate(e.target.value)}
                              className="w-16 bg-zinc-800 border border-emerald-500/50 rounded px-1 py-0.5 text-white text-[11px] font-mono"
                            />
                          ) : (
                            `$${r.toFixed(4)}/h`
                          )}
                        </td>
                        <td
                          className="px-3 py-2 font-mono text-[11px] text-white text-right"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {formatAUD(total)}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => saveOverride(li)}
                                disabled={isPending}
                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : invoice.status === "draft" ? (
                            <button
                              onClick={() => startEdit(li)}
                              className="p-1 text-zinc-700 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/5 bg-zinc-900/40">
                    <td colSpan={5} className="px-3 py-3 text-[11px] font-semibold text-zinc-400 text-right uppercase tracking-widest">
                      Total Due (AUD)
                    </td>
                    <td
                      className="px-3 py-3 text-[14px] font-bold text-white text-right"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatAUD(localTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Contextual Dispatch Footer */}
        {invoice.status === "draft" && (
          <div className="border-t border-white/5 p-6 bg-zinc-950 shrink-0">
            {dispatchError && (
              <p className="text-rose-400 text-xs mb-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {dispatchError}
              </p>
            )}

            {/* Plan Managed */}
            {!isNdia && !isSelf && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">
                    Plan Manager Email
                  </label>
                  <input
                    value={planEmail}
                    onChange={(e) => setPlanEmail(e.target.value)}
                    placeholder="invoices@myplanmanager.com.au"
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={isPending || !planEmail}
                  className="w-full h-11 bg-white text-zinc-900 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail className="w-4 h-4" />
                  {isPending ? "Dispatching…" : "Email Invoice & PDF"}
                </button>
                <p className="text-[10px] text-zinc-600 text-center">
                  PDF will be generated and attached. Invoice status → Sent.
                </p>
              </div>
            )}

            {/* Self Managed */}
            {isSelf && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">
                  A Stripe payment link will be generated for{" "}
                  <span className="text-white font-mono">{formatAUD(localTotal)}</span> and embedded in the email sent to{" "}
                  <span className="text-white">{invoice.client_email || invoice.participant_name}</span>.
                </p>
                <button
                  onClick={handleDispatch}
                  disabled={isPending}
                  className="w-full h-11 bg-white text-zinc-900 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {isPending ? "Generating Link…" : "Email with Stripe Pay-Link"}
                </button>
              </div>
            )}

            {/* NDIA Managed */}
            {isNdia && (
              <div className="space-y-3">
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                  <p className="text-[11px] text-blue-400 flex items-center gap-1.5">
                    <Archive className="w-3 h-3" />
                    NDIA Managed invoices cannot be emailed individually. Move to the PRODA Queue for bulk CSV export and submission via the government portal.
                  </p>
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={isPending}
                  className="w-full h-11 bg-transparent text-blue-400 border border-blue-500/20 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                  {isPending ? "Queuing…" : "Move to PRODA Queue"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* If already sent/paid — show status */}
        {invoice.status !== "draft" && (
          <div className="border-t border-white/5 p-6 bg-zinc-950 shrink-0">
            <div className={`rounded-lg p-3 ${invoice.status === "paid" ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-zinc-900/50 border border-white/5"}`}>
              <p className="text-xs text-zinc-400">
                Status:{" "}
                <span className={`font-semibold ${invoice.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}>
                  {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                </span>
                {invoice.paid_date && ` — Paid ${invoice.paid_date}`}
                {invoice.dispatch_attempted_at && ` — Dispatched ${new Date(invoice.dispatch_attempted_at).toLocaleDateString("en-AU")}`}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicingPage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<TabKey>("draft");
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [telemetry, setTelemetry] = useState<BillingTelemetry | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [isBatching, setIsBatching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slideOver, setSlideOver] = useState<{
    invoice: BillingInvoice;
    lineItems: InvoiceLineItem[];
    orgMeta: { name: string; abn: string; ndis_reg: string } | null;
  } | null>(null);
  const [loadingSlideOver, setLoadingSlideOver] = useState(false);
  const [bulkDispatching, setBulkDispatching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const fetchInvoices = useCallback(async () => {
    if (!orgId) return;
    setLoadingInvoices(true);
    const { invoices: data } = await getBillingInvoices(orgId, activeTab, search || undefined);
    setInvoices(data);
    setLoadingInvoices(false);
    setSelectedIds(new Set());
  }, [orgId, activeTab, search]);

  const fetchTelemetry = useCallback(async () => {
    if (!orgId) return;
    setLoadingTelemetry(true);
    const { telemetry: data } = await getBillingTelemetry(orgId);
    setTelemetry(data);
    setLoadingTelemetry(false);
  }, [orgId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchTelemetry(); }, [fetchTelemetry]);

  async function handleRunBatch() {
    if (!orgId) return;
    setIsBatching(true);
    const { result, error } = await runBillingBatch(orgId);
    setIsBatching(false);
    if (error) { addToast(error, undefined, "error"); return; }
    if (result) {
      if ((result.batches ?? 0) === 0 && result.shifts_billed === 0) {
        addToast("No unbilled approved shifts found.");
      } else {
        addToast(`Billing batch complete: ${result.batches || 0} invoice(s) created from ${result.shifts_billed} shift(s).`);
      }
    }
    fetchInvoices();
    fetchTelemetry();
  }

  async function handleOpenSlideOver(invoice: BillingInvoice) {
    if (!orgId) return;
    setLoadingSlideOver(true);
    const { invoice: fullInvoice, lineItems, orgMeta, error } = await getInvoiceDetail(invoice.id, orgId);
    setLoadingSlideOver(false);
    if (error || !fullInvoice) { addToast(error || "Failed to load invoice", undefined, "error"); return; }
    setSlideOver({ invoice: fullInvoice, lineItems, orgMeta });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)));
    }
  }

  async function handleBulkDispatch() {
    if (!orgId || selectedIds.size === 0) return;
    setBulkDispatching(true);
    setBulkProgress(0);
    const ids = Array.from(selectedIds);
    const { successCount, error } = await bulkDispatchInvoices(ids, orgId);
    setBulkDispatching(false);
    setBulkProgress(100);
    if (error) { addToast(error, undefined, "error"); return; }
    addToast(`${successCount} of ${ids.length} invoice(s) dispatched successfully.`);
    setSelectedIds(new Set());
    fetchInvoices();
    fetchTelemetry();
  }

  async function handleBulkMarkPaid() {
    if (!orgId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { ok, error } = await markInvoicesPaid(ids, orgId);
    if (!ok) { addToast(error || "Failed", undefined, "error"); return; }
    addToast(`${ids.length} invoice(s) marked as paid.`);
    setSelectedIds(new Set());
    fetchInvoices();
    fetchTelemetry();
  }

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices;
    const s = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.display_id.toLowerCase().includes(s) ||
        inv.participant_name.toLowerCase().includes(s) ||
        inv.funding_type.includes(s),
    );
  }, [invoices, search]);

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white">
      {/* ── Command Header ── */}
      <div className="h-14 px-8 flex items-center justify-between border-b border-white/5 bg-[#050505] shrink-0">
        <div className="flex items-center gap-2">
          {/* Breadcrumb */}
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Financials</span>
          <ChevronRight className="w-3 h-3 text-zinc-700" />
          <span className="text-[10px] text-zinc-300 uppercase tracking-widest font-semibold">
            Participant Invoicing
          </span>
          {/* Pill Tabs */}
          <div className="flex items-center gap-1 ml-4 p-1 bg-zinc-900/60 rounded-lg border border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search INV-XXXX, participant…"
              className="h-8 pl-3 pr-8 bg-zinc-900 border border-white/10 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none w-52"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button className="h-8 px-3 flex items-center gap-1.5 text-[11px] text-zinc-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-all">
            <Filter className="w-3 h-3" />
            Filters
          </button>

          <button
            onClick={handleRunBatch}
            disabled={isBatching}
            className="h-8 px-4 flex items-center gap-1.5 text-[11px] font-semibold bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-60"
          >
            {isBatching ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <RotateCcw className="w-3 h-3" />
              </motion.div>
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {isBatching ? "Running…" : "Run Billing Batch"}
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ── */}
      <TelemetryRibbon telemetry={telemetry} loading={loadingTelemetry} />

      {/* ── Bulk Action Bar ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 44, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="h-11 px-8 flex items-center justify-between bg-emerald-500/10 border-b border-emerald-500/20">
              <span className="text-[11px] text-emerald-400 font-medium">
                {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                {bulkDispatching && (
                  <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      animate={{ width: `${bulkProgress}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={handleBulkDispatch}
                  disabled={bulkDispatching}
                  className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-60"
                >
                  <Send className="w-3 h-3" />
                  {bulkDispatching ? "Dispatching…" : "Dispatch All via Email"}
                </button>
                {activeTab === "sent" && (
                  <button
                    onClick={handleBulkMarkPaid}
                    className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-all"
                  >
                    <Check className="w-3 h-3" />
                    Mark as Paid
                  </button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 px-3 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Master Billing Grid ── */}
      <div className="flex-1 overflow-y-auto">
        {loadingInvoices ? (
          <div className="px-8 mt-4 space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-zinc-900/40 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-sm">
              {activeTab === "draft"
                ? "No unbilled invoices. Run a Billing Batch to generate drafts from approved shifts."
                : `No ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} invoices.`}
            </p>
            {activeTab === "draft" && (
              <button
                onClick={handleRunBatch}
                className="mt-4 h-8 px-4 flex items-center gap-1.5 text-[11px] font-semibold bg-white text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <Zap className="w-3 h-3" />
                Run Billing Batch
              </button>
            )}
          </div>
        ) : (
          <div className="px-8 mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="pb-2 pr-3 w-8">
                    <button
                      onClick={toggleSelectAll}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      {selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  {["Participant", "Funding Type", "Billable Items", "Total Value", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pr-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const funding = FUNDING_CONFIG[inv.funding_type] || FUNDING_CONFIG.plan_managed;
                  const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                  const isSelected = selectedIds.has(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16 ${
                        isSelected ? "bg-emerald-500/5" : ""
                      }`}
                      onClick={() => handleOpenSlideOver(inv)}
                    >
                      {/* Checkbox */}
                      <td
                        className="pr-3 w-8"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(inv.id); }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                        )}
                      </td>
                      {/* Participant */}
                      <td className="pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-semibold text-zinc-400 shrink-0">
                            {inv.participant_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-zinc-100 font-medium">{inv.participant_name}</p>
                            <p
                              className="text-[10px] text-zinc-500"
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            >
                              {inv.display_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Funding Type */}
                      <td className="pr-4">
                        <GhostBadge label={funding.label} classes={funding.classes} />
                      </td>
                      {/* Billable Items */}
                      <td className="pr-4">
                        <span className="text-[12px] text-zinc-300">
                          {inv.line_item_count > 0
                            ? `${inv.line_item_count} shift${inv.line_item_count !== 1 ? "s" : ""}`
                            : "—"}
                        </span>
                      </td>
                      {/* Total Value */}
                      <td className="pr-4">
                        <span
                          className="text-[14px] text-white"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {formatAUD(inv.total)}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="pr-4">
                        <GhostBadge label={statusCfg.label} classes={statusCfg.classes} />
                      </td>
                      {/* Action */}
                      <td>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-white transition-all" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Loading Slide-Over indicator ── */}
      {loadingSlideOver && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-400 flex items-center gap-2 z-40">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
            <RotateCcw className="w-3 h-3" />
          </motion.div>
          Loading invoice…
        </div>
      )}

      {/* ── Invoice Slide-Over ── */}
      <AnimatePresence>
        {slideOver && (
          <InvoiceSlideOver
            invoice={slideOver.invoice}
            lineItems={slideOver.lineItems}
            orgMeta={slideOver.orgMeta}
            onClose={() => setSlideOver(null)}
            onDispatched={() => {
              fetchInvoices();
              fetchTelemetry();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
