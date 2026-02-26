"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Send,
  Download,
  MoreHorizontal,
  Check,
  Copy,
  Trash2,
  FileText,
  Eye,
  Clock,
  CreditCard,
  Plus,
  X,
  ExternalLink,
  Printer,
  Ban,
} from "lucide-react";
import { useFinanceStore } from "@/lib/finance-store";
import { useToastStore } from "@/components/app/action-toast";
import { ContextMenu, type ContextMenuItem } from "@/components/app/context-menu";
import { downloadInvoicePDF } from "@/lib/pdf/generate-invoice";
import { useOrg } from "@/lib/hooks/use-org";
import { getOrgSettings } from "@/app/actions/finance";

async function downloadReactPdf(invoiceId: string) {
  const resp = await fetch("/api/invoices/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  if (!resp.ok) throw new Error("PDF generation failed");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
import { ForensicTimeline } from "@/components/finance/forensic-timeline";

/* ── Constants ────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-600/30" },
  sent: { label: "Sent", dot: "bg-[#00E676]", text: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]", border: "border-[rgba(0,230,118,0.3)]" },
  viewed: { label: "Viewed", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  paid: { label: "Paid", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  overdue: { label: "Overdue", dot: "bg-red-400", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  voided: { label: "Voided", dot: "bg-zinc-600", text: "text-zinc-600", bg: "bg-zinc-600/10", border: "border-zinc-700/30" },
};

const eventIcons: Record<string, typeof Check> = {
  created: FileText,
  sent: Send,
  viewed: Eye,
  paid: Check,
  voided: Ban,
  reminder: Clock,
};

const eventColors: Record<string, string> = {
  created: "text-zinc-500",
  sent: "text-[#00E676]",
  viewed: "text-amber-400",
  paid: "text-emerald-400",
  voided: "text-red-400",
  reminder: "text-amber-400",
};

const headerContextItems: ContextMenuItem[] = [
  { id: "copy_link", label: "Copy Payment Link", icon: <Copy size={13} /> },
  { id: "download", label: "Download PDF", icon: <Download size={13} /> },
  { id: "print", label: "Print", icon: <Printer size={13} /> },
  { id: "divider", label: "", divider: true },
  { id: "void", label: "Void Invoice", icon: <Ban size={13} />, danger: true },
];

/* ── Page Component ───────────────────────────────────────── */

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const { invoices, updateInvoice, updateLineItem, addLineItem, removeLineItem, updateInvoiceStatusServer, recalcInvoice, syncLineItemToServer } = useFinanceStore();
  const { addToast } = useToastStore();
  const { orgId } = useOrg();

  const [orgSettings, setOrgSettings] = useState<{ name: string; settings: Record<string, any> } | null>(null);

  useEffect(() => {
    if (orgId) {
      getOrgSettings(orgId).then((res) => {
        if (res.data) setOrgSettings(res.data);
      });
    }
  }, [orgId]);

  const invoice = invoices.find((i) => i.id === invoiceId);

  /* ── Editing state ──────────────────────────────────────── */
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savedField, setSavedField] = useState<string | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false, x: 0, y: 0,
  });

  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell) editRef.current?.focus();
  }, [editingCell]);

  function flashSaved(field: string) {
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  }

  /* ── Keyboard ───────────────────────────────────────────── */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingCell) setEditingCell(null);
        else router.push("/dashboard/finance");
      }
    },
    [editingCell, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ── Context menu ───────────────────────────────────────── */
  function handleHeaderContextAction(actionId: string) {
    if (!invoice) return;
    if (actionId === "copy_link") {
      const payLink = invoice.paymentLink || `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/pay/${invoice.dbId || invoice.id}`;
      navigator.clipboard?.writeText(payLink);
      addToast("Payment link copied");
    } else if (actionId === "download") {
      downloadReactPdf(invoice.dbId || invoice.id).then(() => {
        addToast("PDF downloaded");
      }).catch(() => {
        downloadInvoicePDF(
          invoice,
          orgSettings?.name || "iWorkr",
          orgSettings?.settings?.tax_id,
          orgSettings?.settings?.address || "",
          orgSettings?.settings?.email || "",
        );
        addToast("PDF downloaded (legacy)");
      });
    } else if (actionId === "print") {
      window.print();
    } else if (actionId === "void") {
      updateInvoiceStatusServer(invoice.id, invoice.dbId || invoice.id, "voided");
      addToast(`${invoice.id} voided`);
    }
  }

  /* ── Mark paid ──────────────────────────────────────────── */
  function handleMarkPaid() {
    if (!invoice) return;
    updateInvoiceStatusServer(invoice.id, invoice.dbId || invoice.id, "paid");
    setShowStamp(true);
    setTimeout(() => setShowStamp(false), 2500);
    addToast(`${invoice.id} marked as paid`);
  }

  /* ── Send invoice ───────────────────────────────────────── */
  function handleSend() {
    if (!invoice) return;
    updateInvoiceStatusServer(invoice.id, invoice.dbId || invoice.id, "sent");
    addToast(`${invoice.id} sent to ${invoice.clientEmail}`);
  }

  /* ── Line item editing ──────────────────────────────────── */
  function startEditing(cellId: string, currentValue: string | number) {
    if (invoice?.status !== "draft") return;
    setEditingCell(cellId);
    setEditValue(String(currentValue));
  }

  function saveEdit(invoiceId: string, lineItemId: string, field: string) {
    let patch: Partial<{ description: string; quantity: number; unitPrice: number }> = {};
    if (field === "description") {
      patch = { description: editValue };
    } else if (field === "quantity") {
      patch = { quantity: Number(editValue) || 1 };
    } else if (field === "unitPrice") {
      patch = { unitPrice: Number(editValue) || 0 };
    }
    updateLineItem(invoiceId, lineItemId, patch);
    recalcInvoice(invoiceId);
    syncLineItemToServer(invoiceId, lineItemId, patch);
    setEditingCell(null);
    flashSaved(lineItemId + field);
  }

  /* ── Not found ──────────────────────────────────────────── */
  if (!invoice) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-lg font-medium text-zinc-300">Invoice not found</h2>
          <button onClick={() => router.push("/dashboard/finance")} className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-300">
            Back to Finance
          </button>
        </div>
      </div>
    );
  }

  /* ── Computed ────────────────────────────────────────────── */
  const sc = statusConfig[invoice.status] || statusConfig.draft;
  const isDraft = invoice.status === "draft";
  const isVoided = invoice.status === "voided";
  const isPaid = invoice.status === "paid";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="flex h-full flex-col"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.06)] bg-black/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push("/dashboard/finance")}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
            >
              <ArrowLeft size={12} />
              Finance
            </button>
            <ChevronRight size={12} className="text-zinc-700" />
            <span className="font-mono text-[12px] text-zinc-400">{invoice.id}</span>
            <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] ${sc.border} ${sc.bg} ${sc.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => setCtxMenu({ open: true, x: e.clientX, y: e.clientY })}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
            >
              <MoreHorizontal size={14} />
            </button>

            {isDraft && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleSend}
                className="flex items-center gap-1.5 rounded-md bg-[#00E676] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#00C853]"
              >
                <Send size={12} />
                Send Invoice
              </motion.button>
            )}

            {(invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "overdue") && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleMarkPaid}
                className="relative flex items-center gap-1.5 overflow-hidden rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-400"
              >
                <span className="relative flex items-center gap-1.5">
                  <Check size={12} />
                  Mark Paid
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-Column Body ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Invoice Paper (Left 65%) ──────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 pr-3">
          <div className="relative mx-auto max-w-2xl">
            {/* Paper surface */}
            <div className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#121212] p-8 shadow-2xl shadow-black/40">
              {/* VOID watermark */}
              {isVoided && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.5, rotate: -15 }}
                  animate={{ opacity: 0.08, scale: 1, rotate: -15 }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-[120px] font-black tracking-widest text-red-500">
                    VOID
                  </span>
                </motion.div>
              )}

              {/* PAID stamp */}
              <AnimatePresence>
                {showStamp && (
                  <motion.div
                    initial={{ opacity: 0, scale: 2, rotate: -12 }}
                    animate={{ opacity: 0.15, scale: 1, rotate: -12 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  >
                    <div className="rounded-xl border-4 border-emerald-400 px-8 py-4">
                      <span className="text-[80px] font-black tracking-widest text-emerald-400">
                        PAID
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header */}
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <img
                      src="/logos/logo-dark-streamline.png"
                      alt="iWorkr"
                      className="h-8 w-8 object-contain"
                    />
                    <span className="text-[14px] font-semibold text-zinc-200">{orgSettings?.name || "iWorkr"}</span>
                  </div>
                  <div className="text-[10px] leading-relaxed text-zinc-600">
                    {(() => {
                      const s = orgSettings?.settings;
                      const taxId = s?.tax_id;
                      const addr = s?.address;
                      const email = s?.email;
                      return (
                        <>
                          {taxId ? <>{taxId}<br /></> : <span className="text-zinc-700 italic">Add Tax ID in Settings<br /></span>}
                          {addr && <>{addr}<br /></>}
                          {email && <>{email}</>}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 font-mono text-[20px] font-semibold text-zinc-200">
                    {invoice.id}
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    Issued: {invoice.issueDate}<br />
                    Due: {invoice.dueDate}
                    {invoice.paidDate && (
                      <>
                        <br />
                        <span className="text-emerald-400">Paid: {invoice.paidDate}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-6 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                <div className="mb-1 text-[9px] tracking-wider text-zinc-600 uppercase">Bill To</div>
                <div className="text-[13px] font-medium text-zinc-300">{invoice.clientName}</div>
                <div className="text-[11px] text-zinc-500">{invoice.clientAddress}</div>
                <div className="text-[11px] text-zinc-600">{invoice.clientEmail}</div>
              </div>

              {/* Line Items Table */}
              <div className="mb-6">
                {/* Header */}
                <div className="flex items-center border-b border-[rgba(255,255,255,0.08)] pb-2">
                  <div className="min-w-0 flex-1 text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Description</div>
                  <div className="w-16 text-center text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Qty</div>
                  <div className="w-24 text-right text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Unit Price</div>
                  <div className="w-24 text-right text-[9px] font-medium tracking-wider text-zinc-600 uppercase">Amount</div>
                  {isDraft && <div className="w-8" />}
                </div>

                {/* Rows */}
                {invoice.lineItems.map((li) => {
                  const lineTotal = li.quantity * li.unitPrice;
                  return (
                    <div key={li.id} className="group flex items-center border-b border-[rgba(255,255,255,0.04)] py-3">
                      {/* Description */}
                      <div className="min-w-0 flex-1 pr-2">
                        {editingCell === `${li.id}-desc` ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(invoice.id, li.id, "description")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(invoice.id, li.id, "description"); }}
                            className="w-full bg-transparent text-[12px] text-zinc-300 outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(`${li.id}-desc`, li.description)}
                            className={`text-[12px] ${isDraft ? "cursor-text hover:text-zinc-200" : ""} text-zinc-400`}
                          >
                            {li.description}
                          </span>
                        )}
                      </div>

                      {/* Qty */}
                      <div className="w-16 text-center">
                        {editingCell === `${li.id}-qty` ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(invoice.id, li.id, "quantity")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(invoice.id, li.id, "quantity"); }}
                            className="w-12 bg-transparent text-center text-[12px] text-zinc-300 outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(`${li.id}-qty`, li.quantity)}
                            className={`text-[12px] ${isDraft ? "cursor-text hover:text-zinc-200" : ""} text-zinc-500`}
                          >
                            {li.quantity}
                          </span>
                        )}
                      </div>

                      {/* Unit Price */}
                      <div className="w-24 text-right">
                        {editingCell === `${li.id}-price` ? (
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(invoice.id, li.id, "unitPrice")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(invoice.id, li.id, "unitPrice"); }}
                            className="w-20 bg-transparent text-right text-[12px] text-zinc-300 outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(`${li.id}-price`, li.unitPrice)}
                            className={`text-[12px] ${isDraft ? "cursor-text hover:text-zinc-200" : ""} text-zinc-500`}
                          >
                            ${li.unitPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="w-24 text-right text-[12px] font-medium text-zinc-300">
                        ${lineTotal.toLocaleString()}
                      </div>

                      {/* Remove */}
                      {isDraft && (
                        <div className="w-8 text-right">
                          <button
                            onClick={() => {
                              removeLineItem(invoice.id, li.id);
                              recalcInvoice(invoice.id);
                            }}
                            className="rounded p-0.5 text-zinc-700 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add line item */}
                {isDraft && (
                  <button
                    onClick={() => {
                      addLineItem(invoice.id, {
                        id: `li-${Date.now()}`,
                        description: "New item",
                        quantity: 1,
                        unitPrice: 0,
                      });
                    }}
                    className="mt-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400"
                  >
                    <Plus size={10} />
                    Add line item
                  </button>
                )}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-56">
                  <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] py-2">
                    <span className="text-[11px] text-zinc-600">Subtotal</span>
                    <span className="text-[12px] text-zinc-400">${invoice.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] py-2">
                    <span className="text-[11px] text-zinc-600">GST (10%)</span>
                    <span className="text-[12px] text-zinc-400">${invoice.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-[13px] font-medium text-zinc-300">Total</span>
                    <span className="text-[20px] font-semibold tracking-tight text-zinc-100">
                      ${invoice.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="mt-6 border-t border-[rgba(255,255,255,0.06)] pt-4">
                  <div className="text-[9px] tracking-wider text-zinc-600 uppercase">Notes</div>
                  <div className="mt-1 text-[11px] text-zinc-500">{invoice.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Controls (Right 35%) ──────────────────────────── */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
          <div className="p-5">
            {/* Status Timeline */}
            <div className="mb-6">
              <h4 className="mb-4 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Timeline
              </h4>
              <div className="relative pl-6">
                <div className="absolute top-1 bottom-1 left-[7px] w-px bg-[rgba(255,255,255,0.06)]" />
                <div className="space-y-4">
                  {invoice.events.map((event, i) => {
                    const Icon = eventIcons[event.type] || FileText;
                    const color = eventColors[event.type] || "text-zinc-500";
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative"
                      >
                        <div className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]`}>
                          <Icon size={7} className={color} />
                        </div>
                        <div className="text-[12px] text-zinc-400">{event.text}</div>
                        <div className="text-[10px] text-zinc-700">{event.time}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Forensic Audit Trail */}
            <div className="mb-6">
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Audit Trail
              </h4>
              <ForensicTimeline docType="invoice" docId={invoice.dbId || invoice.id} />
            </div>

            {/* Payment Link */}
            {!isVoided && (
              <div className="mb-6">
                <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  Payment Link
                </h4>
                {(() => {
                  const payLink = invoice.paymentLink || `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/pay/${invoice.dbId || invoice.id}`;
                  return (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                        <CreditCard size={12} className="shrink-0 text-zinc-600" />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">
                          {payLink}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(payLink);
                            addToast("Payment link copied");
                          }}
                          className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(payLink);
                          addToast("Payment link copied");
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-400"
                      >
                        <Copy size={11} />
                        Copy Payment Link
                      </button>
                      <button
                        onClick={() => window.open(payLink, "_blank")}
                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
                      >
                        <ExternalLink size={11} />
                        Open Payment Portal
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Quick Stats */}
            <div className="mb-6">
              <h4 className="mb-3 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Details
              </h4>
              <div className="space-y-1">
                <DetailRow label="Client" value={invoice.clientName} />
                <DetailRow label="Email" value={invoice.clientEmail} />
                <DetailRow label="Items" value={`${invoice.lineItems.length} line items`} />
                <DetailRow label="Subtotal" value={`$${invoice.subtotal.toLocaleString()}`} />
                <DetailRow label="GST" value={`$${invoice.tax.toLocaleString()}`} />
                <DetailRow
                  label="Total"
                  value={`$${invoice.total.toLocaleString()}`}
                  bold
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {isDraft && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSend}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00E676] py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#00C853]"
                >
                  <Send size={12} />
                  Send Invoice
                </motion.button>
              )}

              {(invoice.status === "sent" || invoice.status === "viewed" || invoice.status === "overdue") && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkPaid}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-400"
                >
                  <Check size={12} />
                  Mark as Paid
                </motion.button>
              )}

              {invoice.status === "overdue" && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    addToast(`Reminder sent to ${invoice.clientEmail}`);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-200"
                >
                  <Send size={12} />
                  Send Reminder
                </motion.button>
              )}

              <button
                onClick={() => {
                  if (!invoice) return;
                  downloadReactPdf(invoice.dbId || invoice.id).then(() => {
                    addToast("PDF downloaded");
                  }).catch(() => {
                    downloadInvoicePDF(
                      invoice,
                      orgSettings?.name || "iWorkr",
                      orgSettings?.settings?.tax_id,
                      orgSettings?.settings?.address || "",
                      orgSettings?.settings?.email || "",
                    );
                    addToast("PDF downloaded (legacy)");
                  });
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] py-2.5 text-[12px] text-zinc-500 transition-colors hover:border-[rgba(255,255,255,0.1)] hover:text-zinc-400"
              >
                <Download size={12} />
                Download PDF
              </button>

              {!isVoided && !isPaid && (
                <button
                  onClick={() => {
                    updateInvoiceStatusServer(invoice.id, invoice.dbId || invoice.id, "voided");
                    addToast(`${invoice.id} voided`);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] text-zinc-600 transition-colors hover:text-red-400"
                >
                  <Ban size={12} />
                  Void Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        items={headerContextItems}
        onSelect={handleHeaderContextAction}
        onClose={() => setCtxMenu((p) => ({ ...p, open: false }))}
      />
    </motion.div>
  );
}

/* ── Detail Row ───────────────────────────────────────────── */

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <span className={`text-[12px] ${bold ? "font-medium text-zinc-200" : "text-zinc-400"}`}>
        {value}
      </span>
    </div>
  );
}
