"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Check,
  X,
  ChevronLeft,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchPlanManagerInvoicesAction,
  approvePlanManagerInvoiceAction,
  rejectPlanManagerInvoiceAction,
} from "@/app/actions/care";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type InvoiceStatus = "received" | "processing" | "review_required" | "approved" | "rejected" | "claimed";

interface ExtractedLineItem {
  ndis_item: string;
  description: string;
  amount: number;
  confidence: number;
}

interface PlanManagerInvoice {
  id: string;
  organization_id: string;
  source_email: string | null;
  source_abn: string | null;
  provider_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  participant_id: string | null;
  matched_participant_confidence: number | null;
  extracted_line_items: ExtractedLineItem[];
  pdf_url: string | null;
  ocr_raw_output: unknown | null;
  status: InvoiceStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

type FilterTab = "all" | "review_required" | "approved" | "rejected";

const FILTER_TABS: { key: FilterTab; label: string; countKey?: InvoiceStatus }[] = [
  { key: "all", label: "All" },
  { key: "review_required", label: "Review Required", countKey: "review_required" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string; border: string }> = {
  received: { label: "Received", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  processing: { label: "Processing", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  review_required: { label: "Review Required", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rejected: { label: "Rejected", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  claimed: { label: "Claimed", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

/* ── Confidence Indicator ───────────────────────────────────────────────────── */

function ConfidenceDot({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const color =
    confidence >= 95
      ? "bg-emerald-400"
      : confidence >= 80
        ? "bg-amber-400"
        : "bg-rose-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="font-mono text-[10px] text-zinc-500">{confidence.toFixed(0)}%</span>
    </div>
  );
}

function confidenceBorder(confidence: number | null): string {
  if (confidence === null) return "border-white/[0.08]";
  if (confidence >= 95) return "border-emerald-500/30";
  if (confidence >= 80) return "border-amber-500/30";
  return "border-rose-500/30";
}

/* ── Skeleton ───────────────────────────────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.03]">
          <div className="h-3.5 w-28 rounded skeleton-shimmer" />
          <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          <div className="h-3.5 w-16 rounded skeleton-shimmer" />
          <div className="h-4 w-24 rounded-full skeleton-shimmer" />
          <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          <div className="h-3.5 w-12 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* ── PDF Viewer Placeholder ─────────────────────────────────────────────────── */

function PdfViewer({ invoice }: { invoice: PlanManagerInvoice }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          DOCUMENT PREVIEW
        </span>
        {invoice.pdf_url && (
          <a
            href={invoice.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Open PDF <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[280px] text-center">
          <div className="r-card border border-white/[0.06] bg-white/[0.02] p-8 mb-4">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-[14px] font-medium text-zinc-300 mb-1">
              {invoice.provider_name ?? "Unknown Provider"}
            </p>
            {invoice.invoice_number && (
              <p className="font-mono text-[12px] text-zinc-500 mb-3">
                #{invoice.invoice_number}
              </p>
            )}
            {invoice.total_amount !== null && (
              <p className="font-mono text-[24px] font-semibold text-zinc-100 tabular-nums">
                ${invoice.total_amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          {invoice.pdf_url ? (
            <p className="text-[11px] text-zinc-600">
              PDF available at stored location
            </p>
          ) : (
            <p className="text-[11px] text-zinc-600">
              No PDF attached to this invoice
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Detail Form (Right Pane) ───────────────────────────────────────────────── */

function InvoiceDetailForm({
  invoice,
  onApprove,
  onReject,
  onBack,
}: {
  invoice: PlanManagerInvoice;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onBack: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const lineItems = useMemo(() => {
    if (!invoice.extracted_line_items) return [];
    if (Array.isArray(invoice.extracted_line_items)) return invoice.extracted_line_items;
    return [];
  }, [invoice.extracted_line_items]);

  const handleApprove = async () => {
    setActionLoading("approve");
    await onApprove(invoice.id);
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading("reject");
    await onReject(invoice.id, rejectReason);
    setRejecting(false);
    setRejectReason("");
    setActionLoading(null);
  };

  const isReviewable = invoice.status === "review_required" || invoice.status === "received";

  /* Extracted confidence — average across provider + participant match */
  const avgConfidence = invoice.matched_participant_confidence;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="p-1 rounded-md hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-300 transition-colors lg:hidden"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-medium text-zinc-100 truncate">
            {invoice.provider_name ?? "Unknown Provider"}
          </h2>
          <p className="text-[11px] text-zinc-500">
            {invoice.invoice_number ? `#${invoice.invoice_number}` : "No invoice number"}{" "}
            · {new Date(invoice.created_at).toLocaleDateString("en-AU")}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${STATUS_CONFIG[invoice.status].bg} ${STATUS_CONFIG[invoice.status].color} border ${STATUS_CONFIG[invoice.status].border}`}
        >
          {STATUS_CONFIG[invoice.status].label}
        </span>
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Total amount — prominent */}
        <div className="text-center py-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            TOTAL AMOUNT
          </p>
          <p className="font-mono text-[32px] font-semibold text-zinc-100 tabular-nums tracking-tight">
            {invoice.total_amount !== null
              ? `$${invoice.total_amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4">
          {/* Provider Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Provider Name
              </label>
              <ConfidenceDot confidence={avgConfidence ? Math.min(avgConfidence + 5, 100) : null} />
            </div>
            <input
              readOnly
              value={invoice.provider_name ?? ""}
              className={`w-full px-3 py-2 r-input bg-white/[0.03] border ${confidenceBorder(avgConfidence ? Math.min(avgConfidence + 5, 100) : null)} text-[13px] text-zinc-200 outline-none`}
            />
          </div>

          {/* ABN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                ABN
              </label>
              <ConfidenceDot confidence={invoice.source_abn ? 92 : null} />
            </div>
            <input
              readOnly
              value={invoice.source_abn ?? ""}
              className={`w-full px-3 py-2 r-input bg-white/[0.03] border ${confidenceBorder(invoice.source_abn ? 92 : null)} text-[13px] text-zinc-200 font-mono outline-none`}
            />
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Invoice Number
            </label>
            <input
              readOnly
              value={invoice.invoice_number ?? ""}
              className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[13px] text-zinc-200 font-mono outline-none"
            />
          </div>

          {/* Invoice Date */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Invoice Date
            </label>
            <input
              readOnly
              value={
                invoice.invoice_date
                  ? new Date(invoice.invoice_date).toLocaleDateString("en-AU")
                  : ""
              }
              className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[13px] text-zinc-200 outline-none"
            />
          </div>
        </div>

        {/* Participant Match */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Participant Match
            </label>
            <ConfidenceDot confidence={invoice.matched_participant_confidence} />
          </div>
          <div
            className={`px-3 py-2 r-input bg-white/[0.03] border ${confidenceBorder(invoice.matched_participant_confidence)} text-[13px] text-zinc-300`}
          >
            {invoice.participant_id ? (
              <span className="font-mono text-[12px]">{invoice.participant_id.slice(0, 12)}…</span>
            ) : (
              <span className="text-zinc-600">No participant matched</span>
            )}
          </div>
        </div>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
              LINE ITEMS
            </p>
            <div className="r-card border border-white/[0.06] bg-white/[0.01] overflow-hidden">
              {/* Table header */}
              <div className="stealth-table-header grid grid-cols-12 gap-2">
                <span className="col-span-3">NDIS Item</span>
                <span className="col-span-5">Description</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-2 text-right">Conf.</span>
              </div>
              {/* Table rows */}
              {lineItems.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/[0.03] text-[12px] last:border-b-0"
                >
                  <span className="col-span-3 font-mono text-zinc-300 truncate">
                    {item.ndis_item}
                  </span>
                  <span className="col-span-5 text-zinc-400 truncate">
                    {item.description}
                  </span>
                  <span className="col-span-2 font-mono text-zinc-200 text-right tabular-nums">
                    ${item.amount?.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-right">
                    <ConfidenceDot confidence={item.confidence} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection reason (if rejected) */}
        {invoice.status === "rejected" && invoice.rejection_reason && (
          <div className="r-card border border-rose-500/20 bg-rose-500/[0.04] p-4">
            <p className="text-[11px] font-medium text-rose-400 mb-1">Rejection Reason</p>
            <p className="text-[13px] text-zinc-300">{invoice.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Action bar — sticky bottom */}
      {isReviewable && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          {!rejecting ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setRejecting(true)}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 r-button border border-rose-500/20 text-[13px] font-medium text-rose-400 hover:bg-rose-500/[0.08] transition-colors disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-5 py-2 r-button bg-emerald-500 hover:bg-emerald-400 text-[13px] font-medium text-white transition-colors disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                {actionLoading === "approve" ? "Approving…" : "Approve & Queue for PRODA"}
                <kbd className="ml-2 rounded border border-white/[0.15] bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-white/60">
                  ⌘↵
                </kbd>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
                  Rejection Reason
                </label>
                <input
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReject();
                    if (e.key === "Escape") {
                      setRejecting(false);
                      setRejectReason("");
                    }
                  }}
                  placeholder="Why is this invoice being rejected?"
                  className="w-full px-3 py-2 r-input bg-white/[0.04] border border-rose-500/20 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-rose-500/40 transition-colors"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason("");
                  }}
                  className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || actionLoading !== null}
                  className="inline-flex items-center gap-1 px-4 py-1.5 r-button bg-rose-500 text-white text-[12px] font-medium hover:bg-rose-600 transition-colors disabled:opacity-40"
                >
                  {actionLoading === "reject" ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ── Empty State ────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="stealth-empty-state">
      <div className="relative mb-6">
        <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
        <div className="stealth-empty-state-icon animate-zen-breathe">
          <Inbox className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
      <h3 className="stealth-empty-state-title">Inbox empty</h3>
      <p className="stealth-empty-state-desc">
        No invoices in your inbox.
      </p>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function PlanManagerInboxPage() {
  const { orgId } = useOrg();
  const [invoices, setInvoices] = useState<PlanManagerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── Load invoices ───── */
  const loadInvoices = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const data = await fetchPlanManagerInvoicesAction(orgId, status);
      setInvoices((data as PlanManagerInvoice[]) ?? []);
    } catch (err) {
      console.error("Failed to load plan manager invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, activeTab]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  /* ── Keyboard shortcut: Cmd+Enter to approve ───── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && selectedInvoice) {
        if (selectedInvoice.status === "review_required" || selectedInvoice.status === "received") {
          handleApprove(selectedInvoice.id);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  /* ── Actions ───── */
  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await approvePlanManagerInvoiceAction(id);
        await loadInvoices();
        setSelectedId(null);
      } catch (err) {
        console.error("Failed to approve invoice:", err);
      }
    },
    [loadInvoices],
  );

  const handleReject = useCallback(
    async (id: string, reason: string) => {
      try {
        await rejectPlanManagerInvoiceAction(id, reason);
        await loadInvoices();
        setSelectedId(null);
      } catch (err) {
        console.error("Failed to reject invoice:", err);
      }
    },
    [loadInvoices],
  );

  /* ── Stats ───── */
  const reviewCount = useMemo(
    () => invoices.filter((inv) => inv.status === "review_required").length,
    [invoices],
  );

  /* ── Filtered list ───── */
  const filtered = useMemo(() => {
    if (activeTab === "all") return invoices;
    return invoices.filter((inv) => inv.status === activeTab);
  }, [invoices, activeTab]);

  /* ── Selected invoice ───── */
  const selectedInvoice = useMemo(
    () => (selectedId ? invoices.find((inv) => inv.id === selectedId) ?? null : null),
    [invoices, selectedId],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative min-h-screen bg-[var(--background)] flex flex-col"
    >
      {/* Noise */}
      <div className="stealth-noise" />

      {/* Atmospheric glow — emerald tint for finance */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-72 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(16,185,129,0.025) 0%, transparent 60%)",
        }}
      />

      {/* Header section */}
      <div className="relative z-10 px-6 pt-8 pb-0 max-w-[1400px] mx-auto w-full space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            PLAN MANAGER INBOX
          </p>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
            Invoice Review
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Review OCR-extracted invoices from providers, verify NDIS line items, and queue approved claims for PRODA submission.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="stealth-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedId(null);
              }}
              data-active={activeTab === tab.key}
              className="stealth-tab"
            >
              {tab.label}
              {tab.key === "review_required" && reviewCount > 0 && (
                <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500/15 px-1 font-mono text-[9px] font-medium text-amber-400 animate-pulse">
                  {reviewCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 px-6 pb-8 max-w-[1400px] mx-auto w-full mt-5">
        {loading && <TableSkeleton />}

        {!loading && filtered.length === 0 && <EmptyState />}

        {!loading && filtered.length > 0 && !selectedInvoice && (
          /* ── Invoice Table View ────── */
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="r-card border border-white/[0.06] bg-white/[0.01] overflow-hidden"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            {/* Table header */}
            <div className="stealth-table-header grid grid-cols-12 gap-2">
              <span className="col-span-3">Provider</span>
              <span className="col-span-2">Invoice #</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-1 text-right">Conf.</span>
            </div>

            {/* Table rows */}
            <AnimatePresence mode="popLayout">
              {filtered.map((inv, idx) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => setSelectedId(inv.id)}
                  className="stealth-table-row grid grid-cols-12 gap-2 cursor-pointer"
                >
                  <span className="col-span-3 text-[13px] text-zinc-200 truncate">
                    {inv.provider_name ?? "Unknown"}
                  </span>
                  <span className="col-span-2 font-mono text-[12px] text-zinc-400 truncate">
                    {inv.invoice_number ?? "—"}
                  </span>
                  <span className="col-span-2 font-mono text-[13px] text-zinc-200 text-right tabular-nums">
                    {inv.total_amount !== null
                      ? `$${inv.total_amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                  <span className="col-span-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${STATUS_CONFIG[inv.status].bg} ${STATUS_CONFIG[inv.status].color} border ${STATUS_CONFIG[inv.status].border}`}
                    >
                      {STATUS_CONFIG[inv.status].label}
                    </span>
                  </span>
                  <span className="col-span-2 text-[12px] text-zinc-500">
                    {inv.invoice_date
                      ? new Date(inv.invoice_date).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : new Date(inv.created_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                  </span>
                  <span className="col-span-1 flex justify-end">
                    <ConfidenceDot confidence={inv.matched_participant_confidence} />
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Split View (Invoice Selected) ────── */}
        {!loading && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex gap-0 r-card border border-white/[0.06] bg-white/[0.01] overflow-hidden"
            style={{ boxShadow: "var(--shadow-inset-bevel)", height: "calc(100vh - 280px)", minHeight: 500 }}
          >
            {/* Left pane — PDF viewer (40%) */}
            <div className="w-[40%] border-r border-white/[0.06] bg-white/[0.01] flex-shrink-0 hidden lg:flex flex-col">
              <PdfViewer invoice={selectedInvoice} />
            </div>

            {/* Right pane — Form (60%) */}
            <div className="flex-1 flex flex-col">
              <InvoiceDetailForm
                invoice={selectedInvoice}
                onApprove={handleApprove}
                onReject={handleReject}
                onBack={() => setSelectedId(null)}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
